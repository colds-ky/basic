let decoder;
try {
  decoder = new TextDecoder();
} catch (error) {}
let src$3;
let srcEnd;
let position$1 = 0;
const LEGACY_RECORD_INLINE_ID = 105;
const RECORD_DEFINITIONS_ID = 0xdffe;
const RECORD_INLINE_ID = 0xdfff; // temporary first-come first-serve tag // proposed tag: 0x7265 // 're'
const BUNDLED_STRINGS_ID = 0xdff9;
const PACKED_REFERENCE_TAG_ID = 6;
const STOP_CODE = {};
let maxArraySize = 112810000; // This is the maximum array size in V8. We would potentially detect and set it higher
// for JSC, but this is pretty large and should be sufficient for most use cases
let maxMapSize = 16810000; // JavaScript has a fixed maximum map size of about 16710000, but JS itself enforces this,
let currentDecoder = {};
let currentStructures;
let srcString;
let srcStringStart = 0;
let srcStringEnd = 0;
let bundledStrings$1;
let referenceMap;
let currentExtensions = [];
let currentExtensionRanges = [];
let packedValues;
let dataView$1;
let restoreMapsAsObject;
let defaultOptions = {
  useRecords: false,
  mapsAsObjects: true
};
let sequentialMode = false;
let inlineObjectReadThreshold = 2;
// no-eval build
try {
  new Function('');
} catch (error) {
  // if eval variants are not supported, do not create inline object readers ever
  inlineObjectReadThreshold = Infinity;
}
let Decoder$3 = class Decoder {
  constructor(options) {
    if (options) {
      if ((options.keyMap || options._keyMap) && !options.useRecords) {
        options.useRecords = false;
        options.mapsAsObjects = true;
      }
      if (options.useRecords === false && options.mapsAsObjects === undefined) options.mapsAsObjects = true;
      if (options.getStructures) options.getShared = options.getStructures;
      if (options.getShared && !options.structures) (options.structures = []).uninitialized = true; // this is what we use to denote an uninitialized structures
      if (options.keyMap) {
        this.mapKey = new Map();
        for (let [k, v] of Object.entries(options.keyMap)) this.mapKey.set(v, k);
      }
    }
    Object.assign(this, options);
  }
  /*
  decodeKey(key) {
  	return this.keyMap
  		? Object.keys(this.keyMap)[Object.values(this.keyMap).indexOf(key)] || key
  		: key
  }
  */
  decodeKey(key) {
    return this.keyMap ? this.mapKey.get(key) || key : key;
  }
  encodeKey(key) {
    return this.keyMap && this.keyMap.hasOwnProperty(key) ? this.keyMap[key] : key;
  }
  encodeKeys(rec) {
    if (!this._keyMap) return rec;
    let map = new Map();
    for (let [k, v] of Object.entries(rec)) map.set(this._keyMap.hasOwnProperty(k) ? this._keyMap[k] : k, v);
    return map;
  }
  decodeKeys(map) {
    if (!this._keyMap || map.constructor.name != 'Map') return map;
    if (!this._mapKey) {
      this._mapKey = new Map();
      for (let [k, v] of Object.entries(this._keyMap)) this._mapKey.set(v, k);
    }
    let res = {};
    //map.forEach((v,k) => res[Object.keys(this._keyMap)[Object.values(this._keyMap).indexOf(k)] || k] = v)
    map.forEach((v, k) => res[safeKey(this._mapKey.has(k) ? this._mapKey.get(k) : k)] = v);
    return res;
  }
  mapDecode(source, end) {
    let res = this.decode(source);
    if (this._keyMap) {
      //Experiemntal support for Optimised KeyMap  decoding 
      switch (res.constructor.name) {
        case 'Array':
          return res.map(r => this.decodeKeys(r));
        //case 'Map': return this.decodeKeys(res)
      }
    }
    return res;
  }
  decode(source, end) {
    if (src$3) {
      // re-entrant execution, save the state and restore it after we do this decode
      return saveState(() => {
        clearSource();
        return this ? this.decode(source, end) : Decoder.prototype.decode.call(defaultOptions, source, end);
      });
    }
    srcEnd = end > -1 ? end : source.length;
    position$1 = 0;
    srcStringEnd = 0;
    srcString = null;
    bundledStrings$1 = null;
    src$3 = source;
    // this provides cached access to the data view for a buffer if it is getting reused, which is a recommend
    // technique for getting data from a database where it can be copied into an existing buffer instead of creating
    // new ones
    try {
      dataView$1 = source.dataView || (source.dataView = new DataView(source.buffer, source.byteOffset, source.byteLength));
    } catch (error) {
      // if it doesn't have a buffer, maybe it is the wrong type of object
      src$3 = null;
      if (source instanceof Uint8Array) throw error;
      throw new Error('Source must be a Uint8Array or Buffer but was a ' + (source && typeof source == 'object' ? source.constructor.name : typeof source));
    }
    if (this instanceof Decoder) {
      currentDecoder = this;
      packedValues = this.sharedValues && (this.pack ? new Array(this.maxPrivatePackedValues || 16).concat(this.sharedValues) : this.sharedValues);
      if (this.structures) {
        currentStructures = this.structures;
        return checkedRead();
      } else if (!currentStructures || currentStructures.length > 0) {
        currentStructures = [];
      }
    } else {
      currentDecoder = defaultOptions;
      if (!currentStructures || currentStructures.length > 0) currentStructures = [];
      packedValues = null;
    }
    return checkedRead();
  }
  decodeMultiple(source, forEach) {
    let values,
      lastPosition = 0;
    try {
      let size = source.length;
      sequentialMode = true;
      let value = this ? this.decode(source, size) : defaultDecoder.decode(source, size);
      if (forEach) {
        if (forEach(value) === false) {
          return;
        }
        while (position$1 < size) {
          lastPosition = position$1;
          if (forEach(checkedRead()) === false) {
            return;
          }
        }
      } else {
        values = [value];
        while (position$1 < size) {
          lastPosition = position$1;
          values.push(checkedRead());
        }
        return values;
      }
    } catch (error) {
      error.lastPosition = lastPosition;
      error.values = values;
      throw error;
    } finally {
      sequentialMode = false;
      clearSource();
    }
  }
};
function checkedRead() {
  try {
    let result = read$3();
    if (bundledStrings$1) {
      if (position$1 >= bundledStrings$1.postBundlePosition) {
        let error = new Error('Unexpected bundle position');
        error.incomplete = true;
        throw error;
      }
      // bundled strings to skip past
      position$1 = bundledStrings$1.postBundlePosition;
      bundledStrings$1 = null;
    }
    if (position$1 == srcEnd) {
      // finished reading this source, cleanup references
      currentStructures = null;
      src$3 = null;
      if (referenceMap) referenceMap = null;
    } else if (position$1 > srcEnd) {
      // over read
      let error = new Error('Unexpected end of CBOR data');
      error.incomplete = true;
      throw error;
    } else if (!sequentialMode) {
      throw new Error('Data read, but end of buffer not reached');
    }
    // else more to read, but we are reading sequentially, so don't clear source yet
    return result;
  } catch (error) {
    clearSource();
    if (error instanceof RangeError || error.message.startsWith('Unexpected end of buffer')) {
      error.incomplete = true;
    }
    throw error;
  }
}
function read$3() {
  let token = src$3[position$1++];
  let majorType = token >> 5;
  token = token & 0x1f;
  if (token > 0x17) {
    switch (token) {
      case 0x18:
        token = src$3[position$1++];
        break;
      case 0x19:
        if (majorType == 7) {
          return getFloat16();
        }
        token = dataView$1.getUint16(position$1);
        position$1 += 2;
        break;
      case 0x1a:
        if (majorType == 7) {
          let value = dataView$1.getFloat32(position$1);
          if (currentDecoder.useFloat32 > 2) {
            // this does rounding of numbers that were encoded in 32-bit float to nearest significant decimal digit that could be preserved
            let multiplier = mult10[(src$3[position$1] & 0x7f) << 1 | src$3[position$1 + 1] >> 7];
            position$1 += 4;
            return (multiplier * value + (value > 0 ? 0.5 : -0.5) >> 0) / multiplier;
          }
          position$1 += 4;
          return value;
        }
        token = dataView$1.getUint32(position$1);
        position$1 += 4;
        break;
      case 0x1b:
        if (majorType == 7) {
          let value = dataView$1.getFloat64(position$1);
          position$1 += 8;
          return value;
        }
        if (majorType > 1) {
          if (dataView$1.getUint32(position$1) > 0) throw new Error('JavaScript does not support arrays, maps, or strings with length over 4294967295');
          token = dataView$1.getUint32(position$1 + 4);
        } else if (currentDecoder.int64AsNumber) {
          token = dataView$1.getUint32(position$1) * 0x100000000;
          token += dataView$1.getUint32(position$1 + 4);
        } else token = dataView$1.getBigUint64(position$1);
        position$1 += 8;
        break;
      case 0x1f:
        // indefinite length
        switch (majorType) {
          case 2: // byte string
          case 3:
            // text string
            throw new Error('Indefinite length not supported for byte or text strings');
          case 4:
            // array
            let array = [];
            let value,
              i = 0;
            while ((value = read$3()) != STOP_CODE) {
              if (i >= maxArraySize) throw new Error(`Array length exceeds ${maxArraySize}`);
              array[i++] = value;
            }
            return majorType == 4 ? array : majorType == 3 ? array.join('') : Buffer.concat(array);
          case 5:
            // map
            let key;
            if (currentDecoder.mapsAsObjects) {
              let object = {};
              let i = 0;
              if (currentDecoder.keyMap) {
                while ((key = read$3()) != STOP_CODE) {
                  if (i++ >= maxMapSize) throw new Error(`Property count exceeds ${maxMapSize}`);
                  object[safeKey(currentDecoder.decodeKey(key))] = read$3();
                }
              } else {
                while ((key = read$3()) != STOP_CODE) {
                  if (i++ >= maxMapSize) throw new Error(`Property count exceeds ${maxMapSize}`);
                  object[safeKey(key)] = read$3();
                }
              }
              return object;
            } else {
              if (restoreMapsAsObject) {
                currentDecoder.mapsAsObjects = true;
                restoreMapsAsObject = false;
              }
              let map = new Map();
              if (currentDecoder.keyMap) {
                let i = 0;
                while ((key = read$3()) != STOP_CODE) {
                  if (i++ >= maxMapSize) {
                    throw new Error(`Map size exceeds ${maxMapSize}`);
                  }
                  map.set(currentDecoder.decodeKey(key), read$3());
                }
              } else {
                let i = 0;
                while ((key = read$3()) != STOP_CODE) {
                  if (i++ >= maxMapSize) {
                    throw new Error(`Map size exceeds ${maxMapSize}`);
                  }
                  map.set(key, read$3());
                }
              }
              return map;
            }
          case 7:
            return STOP_CODE;
          default:
            throw new Error('Invalid major type for indefinite length ' + majorType);
        }
      default:
        throw new Error('Unknown token ' + token);
    }
  }
  switch (majorType) {
    case 0:
      // positive int
      return token;
    case 1:
      // negative int
      return ~token;
    case 2:
      // buffer
      return readBin(token);
    case 3:
      // string
      if (srcStringEnd >= position$1) {
        return srcString.slice(position$1 - srcStringStart, (position$1 += token) - srcStringStart);
      }
      if (srcStringEnd == 0 && srcEnd < 140 && token < 32) {
        // for small blocks, avoiding the overhead of the extract call is helpful
        let string = token < 16 ? shortStringInJS(token) : longStringInJS(token);
        if (string != null) return string;
      }
      return readFixedString(token);
    case 4:
      // array
      if (token >= maxArraySize) throw new Error(`Array length exceeds ${maxArraySize}`);
      let array = new Array(token);
      //if (currentDecoder.keyMap) for (let i = 0; i < token; i++) array[i] = currentDecoder.decodeKey(read())	
      //else 
      for (let i = 0; i < token; i++) array[i] = read$3();
      return array;
    case 5:
      // map
      if (token >= maxMapSize) throw new Error(`Map size exceeds ${maxArraySize}`);
      if (currentDecoder.mapsAsObjects) {
        let object = {};
        if (currentDecoder.keyMap) for (let i = 0; i < token; i++) object[safeKey(currentDecoder.decodeKey(read$3()))] = read$3();else for (let i = 0; i < token; i++) object[safeKey(read$3())] = read$3();
        return object;
      } else {
        if (restoreMapsAsObject) {
          currentDecoder.mapsAsObjects = true;
          restoreMapsAsObject = false;
        }
        let map = new Map();
        if (currentDecoder.keyMap) for (let i = 0; i < token; i++) map.set(currentDecoder.decodeKey(read$3()), read$3());else for (let i = 0; i < token; i++) map.set(read$3(), read$3());
        return map;
      }
    case 6:
      // extension
      if (token >= BUNDLED_STRINGS_ID) {
        let structure = currentStructures[token & 0x1fff]; // check record structures first
        // At some point we may provide an option for dynamic tag assignment with a range like token >= 8 && (token < 16 || (token > 0x80 && token < 0xc0) || (token > 0x130 && token < 0x4000))
        if (structure) {
          if (!structure.read) structure.read = createStructureReader(structure);
          return structure.read();
        }
        if (token < 0x10000) {
          if (token == RECORD_INLINE_ID) {
            // we do a special check for this so that we can keep the
            // currentExtensions as densely stored array (v8 stores arrays densely under about 3000 elements)
            let length = readJustLength();
            let id = read$3();
            let structure = read$3();
            recordDefinition(id, structure);
            let object = {};
            if (currentDecoder.keyMap) for (let i = 2; i < length; i++) {
              let key = currentDecoder.decodeKey(structure[i - 2]);
              object[safeKey(key)] = read$3();
            } else for (let i = 2; i < length; i++) {
              let key = structure[i - 2];
              object[safeKey(key)] = read$3();
            }
            return object;
          } else if (token == RECORD_DEFINITIONS_ID) {
            let length = readJustLength();
            let id = read$3();
            for (let i = 2; i < length; i++) {
              recordDefinition(id++, read$3());
            }
            return read$3();
          } else if (token == BUNDLED_STRINGS_ID) {
            return readBundleExt();
          }
          if (currentDecoder.getShared) {
            loadShared();
            structure = currentStructures[token & 0x1fff];
            if (structure) {
              if (!structure.read) structure.read = createStructureReader(structure);
              return structure.read();
            }
          }
        }
      }
      let extension = currentExtensions[token];
      if (extension) {
        if (extension.handlesRead) return extension(read$3);else return extension(read$3());
      } else {
        let input = read$3();
        for (let i = 0; i < currentExtensionRanges.length; i++) {
          let value = currentExtensionRanges[i](token, input);
          if (value !== undefined) return value;
        }
        return new Tag(input, token);
      }
    case 7:
      // fixed value
      switch (token) {
        case 0x14:
          return false;
        case 0x15:
          return true;
        case 0x16:
          return null;
        case 0x17:
          return;
        // undefined
        case 0x1f:
        default:
          let packedValue = (packedValues || getPackedValues())[token];
          if (packedValue !== undefined) return packedValue;
          throw new Error('Unknown token ' + token);
      }
    default:
      // negative int
      if (isNaN(token)) {
        let error = new Error('Unexpected end of CBOR data');
        error.incomplete = true;
        throw error;
      }
      throw new Error('Unknown CBOR token ' + token);
  }
}
const validName = /^[a-zA-Z_$][a-zA-Z\d_$]*$/;
function createStructureReader(structure) {
  if (!structure) throw new Error('Structure is required in record definition');
  function readObject() {
    // get the array size from the header
    let length = src$3[position$1++];
    //let majorType = token >> 5
    length = length & 0x1f;
    if (length > 0x17) {
      switch (length) {
        case 0x18:
          length = src$3[position$1++];
          break;
        case 0x19:
          length = dataView$1.getUint16(position$1);
          position$1 += 2;
          break;
        case 0x1a:
          length = dataView$1.getUint32(position$1);
          position$1 += 4;
          break;
        default:
          throw new Error('Expected array header, but got ' + src$3[position$1 - 1]);
      }
    }
    // This initial function is quick to instantiate, but runs slower. After several iterations pay the cost to build the faster function
    let compiledReader = this.compiledReader; // first look to see if we have the fast compiled function
    while (compiledReader) {
      // we have a fast compiled object literal reader
      if (compiledReader.propertyCount === length) return compiledReader(read$3); // with the right length, so we use it
      compiledReader = compiledReader.next; // see if there is another reader with the right length
    }
    if (this.slowReads++ >= inlineObjectReadThreshold) {
      // create a fast compiled reader
      let array = this.length == length ? this : this.slice(0, length);
      compiledReader = currentDecoder.keyMap ? new Function('r', 'return {' + array.map(k => currentDecoder.decodeKey(k)).map(k => validName.test(k) ? safeKey(k) + ':r()' : '[' + JSON.stringify(k) + ']:r()').join(',') + '}') : new Function('r', 'return {' + array.map(key => validName.test(key) ? safeKey(key) + ':r()' : '[' + JSON.stringify(key) + ']:r()').join(',') + '}');
      if (this.compiledReader) compiledReader.next = this.compiledReader; // if there is an existing one, we store multiple readers as a linked list because it is usually pretty rare to have multiple readers (of different length) for the same structure
      compiledReader.propertyCount = length;
      this.compiledReader = compiledReader;
      return compiledReader(read$3);
    }
    let object = {};
    if (currentDecoder.keyMap) for (let i = 0; i < length; i++) object[safeKey(currentDecoder.decodeKey(this[i]))] = read$3();else for (let i = 0; i < length; i++) {
      object[safeKey(this[i])] = read$3();
    }
    return object;
  }
  structure.slowReads = 0;
  return readObject;
}
function safeKey(key) {
  // protect against prototype pollution
  if (typeof key === 'string') return key === '__proto__' ? '__proto_' : key;
  if (typeof key === 'number' || typeof key === 'boolean' || typeof key === 'bigint') return key.toString();
  if (key == null) return key + '';
  // protect against expensive (DoS) string conversions
  throw new Error('Invalid property name type ' + typeof key);
}
let readFixedString = readStringJS;
function readStringJS(length) {
  let result;
  if (length < 16) {
    if (result = shortStringInJS(length)) return result;
  }
  if (length > 64 && decoder) return decoder.decode(src$3.subarray(position$1, position$1 += length));
  const end = position$1 + length;
  const units = [];
  result = '';
  while (position$1 < end) {
    const byte1 = src$3[position$1++];
    if ((byte1 & 0x80) === 0) {
      // 1 byte
      units.push(byte1);
    } else if ((byte1 & 0xe0) === 0xc0) {
      // 2 bytes
      const byte2 = src$3[position$1++] & 0x3f;
      units.push((byte1 & 0x1f) << 6 | byte2);
    } else if ((byte1 & 0xf0) === 0xe0) {
      // 3 bytes
      const byte2 = src$3[position$1++] & 0x3f;
      const byte3 = src$3[position$1++] & 0x3f;
      units.push((byte1 & 0x1f) << 12 | byte2 << 6 | byte3);
    } else if ((byte1 & 0xf8) === 0xf0) {
      // 4 bytes
      const byte2 = src$3[position$1++] & 0x3f;
      const byte3 = src$3[position$1++] & 0x3f;
      const byte4 = src$3[position$1++] & 0x3f;
      let unit = (byte1 & 0x07) << 0x12 | byte2 << 0x0c | byte3 << 0x06 | byte4;
      if (unit > 0xffff) {
        unit -= 0x10000;
        units.push(unit >>> 10 & 0x3ff | 0xd800);
        unit = 0xdc00 | unit & 0x3ff;
      }
      units.push(unit);
    } else {
      units.push(byte1);
    }
    if (units.length >= 0x1000) {
      result += fromCharCode.apply(String, units);
      units.length = 0;
    }
  }
  if (units.length > 0) {
    result += fromCharCode.apply(String, units);
  }
  return result;
}
let fromCharCode = String.fromCharCode;
function longStringInJS(length) {
  let start = position$1;
  let bytes = new Array(length);
  for (let i = 0; i < length; i++) {
    const byte = src$3[position$1++];
    if ((byte & 0x80) > 0) {
      position$1 = start;
      return;
    }
    bytes[i] = byte;
  }
  return fromCharCode.apply(String, bytes);
}
function shortStringInJS(length) {
  if (length < 4) {
    if (length < 2) {
      if (length === 0) return '';else {
        let a = src$3[position$1++];
        if ((a & 0x80) > 1) {
          position$1 -= 1;
          return;
        }
        return fromCharCode(a);
      }
    } else {
      let a = src$3[position$1++];
      let b = src$3[position$1++];
      if ((a & 0x80) > 0 || (b & 0x80) > 0) {
        position$1 -= 2;
        return;
      }
      if (length < 3) return fromCharCode(a, b);
      let c = src$3[position$1++];
      if ((c & 0x80) > 0) {
        position$1 -= 3;
        return;
      }
      return fromCharCode(a, b, c);
    }
  } else {
    let a = src$3[position$1++];
    let b = src$3[position$1++];
    let c = src$3[position$1++];
    let d = src$3[position$1++];
    if ((a & 0x80) > 0 || (b & 0x80) > 0 || (c & 0x80) > 0 || (d & 0x80) > 0) {
      position$1 -= 4;
      return;
    }
    if (length < 6) {
      if (length === 4) return fromCharCode(a, b, c, d);else {
        let e = src$3[position$1++];
        if ((e & 0x80) > 0) {
          position$1 -= 5;
          return;
        }
        return fromCharCode(a, b, c, d, e);
      }
    } else if (length < 8) {
      let e = src$3[position$1++];
      let f = src$3[position$1++];
      if ((e & 0x80) > 0 || (f & 0x80) > 0) {
        position$1 -= 6;
        return;
      }
      if (length < 7) return fromCharCode(a, b, c, d, e, f);
      let g = src$3[position$1++];
      if ((g & 0x80) > 0) {
        position$1 -= 7;
        return;
      }
      return fromCharCode(a, b, c, d, e, f, g);
    } else {
      let e = src$3[position$1++];
      let f = src$3[position$1++];
      let g = src$3[position$1++];
      let h = src$3[position$1++];
      if ((e & 0x80) > 0 || (f & 0x80) > 0 || (g & 0x80) > 0 || (h & 0x80) > 0) {
        position$1 -= 8;
        return;
      }
      if (length < 10) {
        if (length === 8) return fromCharCode(a, b, c, d, e, f, g, h);else {
          let i = src$3[position$1++];
          if ((i & 0x80) > 0) {
            position$1 -= 9;
            return;
          }
          return fromCharCode(a, b, c, d, e, f, g, h, i);
        }
      } else if (length < 12) {
        let i = src$3[position$1++];
        let j = src$3[position$1++];
        if ((i & 0x80) > 0 || (j & 0x80) > 0) {
          position$1 -= 10;
          return;
        }
        if (length < 11) return fromCharCode(a, b, c, d, e, f, g, h, i, j);
        let k = src$3[position$1++];
        if ((k & 0x80) > 0) {
          position$1 -= 11;
          return;
        }
        return fromCharCode(a, b, c, d, e, f, g, h, i, j, k);
      } else {
        let i = src$3[position$1++];
        let j = src$3[position$1++];
        let k = src$3[position$1++];
        let l = src$3[position$1++];
        if ((i & 0x80) > 0 || (j & 0x80) > 0 || (k & 0x80) > 0 || (l & 0x80) > 0) {
          position$1 -= 12;
          return;
        }
        if (length < 14) {
          if (length === 12) return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l);else {
            let m = src$3[position$1++];
            if ((m & 0x80) > 0) {
              position$1 -= 13;
              return;
            }
            return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m);
          }
        } else {
          let m = src$3[position$1++];
          let n = src$3[position$1++];
          if ((m & 0x80) > 0 || (n & 0x80) > 0) {
            position$1 -= 14;
            return;
          }
          if (length < 15) return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m, n);
          let o = src$3[position$1++];
          if ((o & 0x80) > 0) {
            position$1 -= 15;
            return;
          }
          return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o);
        }
      }
    }
  }
}
function readBin(length) {
  return currentDecoder.copyBuffers ?
  // specifically use the copying slice (not the node one)
  Uint8Array.prototype.slice.call(src$3, position$1, position$1 += length) : src$3.subarray(position$1, position$1 += length);
}
let f32Array = new Float32Array(1);
let u8Array = new Uint8Array(f32Array.buffer, 0, 4);
function getFloat16() {
  let byte0 = src$3[position$1++];
  let byte1 = src$3[position$1++];
  let exponent = (byte0 & 0x7f) >> 2;
  if (exponent === 0x1f) {
    // specials
    if (byte1 || byte0 & 3) return NaN;
    return byte0 & 0x80 ? -Infinity : Infinity;
  }
  if (exponent === 0) {
    // sub-normals
    // significand with 10 fractional bits and divided by 2^14
    let abs = ((byte0 & 3) << 8 | byte1) / (1 << 24);
    return byte0 & 0x80 ? -abs : abs;
  }
  u8Array[3] = byte0 & 0x80 |
  // sign bit
  (exponent >> 1) + 56; // 4 of 5 of the exponent bits, re-offset-ed
  u8Array[2] = (byte0 & 7) << 5 |
  // last exponent bit and first two mantissa bits
  byte1 >> 3; // next 5 bits of mantissa
  u8Array[1] = byte1 << 5; // last three bits of mantissa
  u8Array[0] = 0;
  return f32Array[0];
}
new Array(4096);
class Tag {
  constructor(value, tag) {
    this.value = value;
    this.tag = tag;
  }
}
currentExtensions[0] = dateString => {
  // string date extension
  return new Date(dateString);
};
currentExtensions[1] = epochSec => {
  // numeric date extension
  return new Date(Math.round(epochSec * 1000));
};
currentExtensions[2] = buffer => {
  // bigint extension
  let value = BigInt(0);
  for (let i = 0, l = buffer.byteLength; i < l; i++) {
    value = BigInt(buffer[i]) + (value << BigInt(8));
  }
  return value;
};
currentExtensions[3] = buffer => {
  // negative bigint extension
  return BigInt(-1) - currentExtensions[2](buffer);
};
currentExtensions[4] = fraction => {
  // best to reparse to maintain accuracy
  return +(fraction[1] + 'e' + fraction[0]);
};
currentExtensions[5] = fraction => {
  // probably not sufficiently accurate
  return fraction[1] * Math.exp(fraction[0] * Math.log(2));
};

// the registration of the record definition extension
const recordDefinition = (id, structure) => {
  id = id - 0xe000;
  let existingStructure = currentStructures[id];
  if (existingStructure && existingStructure.isShared) {
    (currentStructures.restoreStructures || (currentStructures.restoreStructures = []))[id] = existingStructure;
  }
  currentStructures[id] = structure;
  structure.read = createStructureReader(structure);
};
currentExtensions[LEGACY_RECORD_INLINE_ID] = data => {
  let length = data.length;
  let structure = data[1];
  recordDefinition(data[0], structure);
  let object = {};
  for (let i = 2; i < length; i++) {
    let key = structure[i - 2];
    object[safeKey(key)] = data[i];
  }
  return object;
};
currentExtensions[14] = value => {
  if (bundledStrings$1) return bundledStrings$1[0].slice(bundledStrings$1.position0, bundledStrings$1.position0 += value);
  return new Tag(value, 14);
};
currentExtensions[15] = value => {
  if (bundledStrings$1) return bundledStrings$1[1].slice(bundledStrings$1.position1, bundledStrings$1.position1 += value);
  return new Tag(value, 15);
};
let glbl = {
  Error,
  RegExp
};
currentExtensions[27] = data => {
  // http://cbor.schmorp.de/generic-object
  return (glbl[data[0]] || Error)(data[1], data[2]);
};
const packedTable = read => {
  if (src$3[position$1++] != 0x84) {
    let error = new Error('Packed values structure must be followed by a 4 element array');
    if (src$3.length < position$1) error.incomplete = true;
    throw error;
  }
  let newPackedValues = read(); // packed values
  if (!newPackedValues || !newPackedValues.length) {
    let error = new Error('Packed values structure must be followed by a 4 element array');
    error.incomplete = true;
    throw error;
  }
  packedValues = packedValues ? newPackedValues.concat(packedValues.slice(newPackedValues.length)) : newPackedValues;
  packedValues.prefixes = read();
  packedValues.suffixes = read();
  return read(); // read the rump
};
packedTable.handlesRead = true;
currentExtensions[51] = packedTable;
currentExtensions[PACKED_REFERENCE_TAG_ID] = data => {
  // packed reference
  if (!packedValues) {
    if (currentDecoder.getShared) loadShared();else return new Tag(data, PACKED_REFERENCE_TAG_ID);
  }
  if (typeof data == 'number') return packedValues[16 + (data >= 0 ? 2 * data : -2 * data - 1)];
  let error = new Error('No support for non-integer packed references yet');
  if (data === undefined) error.incomplete = true;
  throw error;
};

// The following code is an incomplete implementation of http://cbor.schmorp.de/stringref
// the real thing would need to implemennt more logic to populate the stringRefs table and
// maintain a stack of stringRef "namespaces".
//
// currentExtensions[25] = (id) => {
// 	return stringRefs[id]
// }
// currentExtensions[256] = (read) => {
// 	stringRefs = []
// 	try {
// 		return read()
// 	} finally {
// 		stringRefs = null
// 	}
// }
// currentExtensions[256].handlesRead = true

currentExtensions[28] = read => {
  // shareable http://cbor.schmorp.de/value-sharing (for structured clones)
  if (!referenceMap) {
    referenceMap = new Map();
    referenceMap.id = 0;
  }
  let id = referenceMap.id++;
  let startingPosition = position$1;
  let token = src$3[position$1];
  let target;
  // TODO: handle Maps, Sets, and other types that can cycle; this is complicated, because you potentially need to read
  // ahead past references to record structure definitions
  if (token >> 5 == 4) target = [];else target = {};
  let refEntry = {
    target
  }; // a placeholder object
  referenceMap.set(id, refEntry);
  let targetProperties = read(); // read the next value as the target object to id
  if (refEntry.used) {
    // there is a cycle, so we have to assign properties to original target
    if (Object.getPrototypeOf(target) !== Object.getPrototypeOf(targetProperties)) {
      // this means that the returned target does not match the targetProperties, so we need rerun the read to
      // have the correctly create instance be assigned as a reference, then we do the copy the properties back to the
      // target
      // reset the position so that the read can be repeated
      position$1 = startingPosition;
      // the returned instance is our new target for references
      target = targetProperties;
      referenceMap.set(id, {
        target
      });
      targetProperties = read();
    }
    return Object.assign(target, targetProperties);
  }
  refEntry.target = targetProperties; // the placeholder wasn't used, replace with the deserialized one
  return targetProperties; // no cycle, can just use the returned read object
};
currentExtensions[28].handlesRead = true;
currentExtensions[29] = id => {
  // sharedref http://cbor.schmorp.de/value-sharing (for structured clones)
  let refEntry = referenceMap.get(id);
  refEntry.used = true;
  return refEntry.target;
};
currentExtensions[258] = array => new Set(array); // https://github.com/input-output-hk/cbor-sets-spec/blob/master/CBOR_SETS.md
(currentExtensions[259] = read => {
  // https://github.com/shanewholloway/js-cbor-codec/blob/master/docs/CBOR-259-spec
  // for decoding as a standard Map
  if (currentDecoder.mapsAsObjects) {
    currentDecoder.mapsAsObjects = false;
    restoreMapsAsObject = true;
  }
  return read();
}).handlesRead = true;
function combine(a, b) {
  if (typeof a === 'string') return a + b;
  if (a instanceof Array) return a.concat(b);
  return Object.assign({}, a, b);
}
function getPackedValues() {
  if (!packedValues) {
    if (currentDecoder.getShared) loadShared();else throw new Error('No packed values available');
  }
  return packedValues;
}
const SHARED_DATA_TAG_ID = 0x53687264; // ascii 'Shrd'
currentExtensionRanges.push((tag, input) => {
  if (tag >= 225 && tag <= 255) return combine(getPackedValues().prefixes[tag - 224], input);
  if (tag >= 28704 && tag <= 32767) return combine(getPackedValues().prefixes[tag - 28672], input);
  if (tag >= 1879052288 && tag <= 2147483647) return combine(getPackedValues().prefixes[tag - 1879048192], input);
  if (tag >= 216 && tag <= 223) return combine(input, getPackedValues().suffixes[tag - 216]);
  if (tag >= 27647 && tag <= 28671) return combine(input, getPackedValues().suffixes[tag - 27639]);
  if (tag >= 1811940352 && tag <= 1879048191) return combine(input, getPackedValues().suffixes[tag - 1811939328]);
  if (tag == SHARED_DATA_TAG_ID) {
    // we do a special check for this so that we can keep the currentExtensions as densely stored array (v8 stores arrays densely under about 3000 elements)
    return {
      packedValues: packedValues,
      structures: currentStructures.slice(0),
      version: input
    };
  }
  if (tag == 55799)
    // self-descriptive CBOR tag, just return input value
    return input;
});
const isLittleEndianMachine$1 = new Uint8Array(new Uint16Array([1]).buffer)[0] == 1;
const typedArrays = [Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, typeof BigUint64Array == 'undefined' ? {
  name: 'BigUint64Array'
} : BigUint64Array, Int8Array, Int16Array, Int32Array, typeof BigInt64Array == 'undefined' ? {
  name: 'BigInt64Array'
} : BigInt64Array, Float32Array, Float64Array];
const typedArrayTags = [64, 68, 69, 70, 71, 72, 77, 78, 79, 85, 86];
for (let i = 0; i < typedArrays.length; i++) {
  registerTypedArray(typedArrays[i], typedArrayTags[i]);
}
function registerTypedArray(TypedArray, tag) {
  let dvMethod = 'get' + TypedArray.name.slice(0, -5);
  let bytesPerElement;
  if (typeof TypedArray === 'function') bytesPerElement = TypedArray.BYTES_PER_ELEMENT;else TypedArray = null;
  for (let littleEndian = 0; littleEndian < 2; littleEndian++) {
    if (!littleEndian && bytesPerElement == 1) continue;
    let sizeShift = bytesPerElement == 2 ? 1 : bytesPerElement == 4 ? 2 : bytesPerElement == 8 ? 3 : 0;
    currentExtensions[littleEndian ? tag : tag - 4] = bytesPerElement == 1 || littleEndian == isLittleEndianMachine$1 ? buffer => {
      if (!TypedArray) throw new Error('Could not find typed array for code ' + tag);
      if (!currentDecoder.copyBuffers) {
        // try provide a direct view, but will only work if we are byte-aligned
        if (bytesPerElement === 1 || bytesPerElement === 2 && !(buffer.byteOffset & 1) || bytesPerElement === 4 && !(buffer.byteOffset & 3) || bytesPerElement === 8 && !(buffer.byteOffset & 7)) return new TypedArray(buffer.buffer, buffer.byteOffset, buffer.byteLength >> sizeShift);
      }
      // we have to slice/copy here to get a new ArrayBuffer, if we are not word/byte aligned
      return new TypedArray(Uint8Array.prototype.slice.call(buffer, 0).buffer);
    } : buffer => {
      if (!TypedArray) throw new Error('Could not find typed array for code ' + tag);
      let dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      let elements = buffer.length >> sizeShift;
      let ta = new TypedArray(elements);
      let method = dv[dvMethod];
      for (let i = 0; i < elements; i++) {
        ta[i] = method.call(dv, i << sizeShift, littleEndian);
      }
      return ta;
    };
  }
}
function readBundleExt() {
  let length = readJustLength();
  let bundlePosition = position$1 + read$3();
  for (let i = 2; i < length; i++) {
    // skip past bundles that were already read
    let bundleLength = readJustLength(); // this will increment position, so must add to position afterwards
    position$1 += bundleLength;
  }
  let dataPosition = position$1;
  position$1 = bundlePosition;
  bundledStrings$1 = [readStringJS(readJustLength()), readStringJS(readJustLength())];
  bundledStrings$1.position0 = 0;
  bundledStrings$1.position1 = 0;
  bundledStrings$1.postBundlePosition = position$1;
  position$1 = dataPosition;
  return read$3();
}
function readJustLength() {
  let token = src$3[position$1++] & 0x1f;
  if (token > 0x17) {
    switch (token) {
      case 0x18:
        token = src$3[position$1++];
        break;
      case 0x19:
        token = dataView$1.getUint16(position$1);
        position$1 += 2;
        break;
      case 0x1a:
        token = dataView$1.getUint32(position$1);
        position$1 += 4;
        break;
    }
  }
  return token;
}
function loadShared() {
  if (currentDecoder.getShared) {
    let sharedData = saveState(() => {
      // save the state in case getShared modifies our buffer
      src$3 = null;
      return currentDecoder.getShared();
    }) || {};
    let updatedStructures = sharedData.structures || [];
    currentDecoder.sharedVersion = sharedData.version;
    packedValues = currentDecoder.sharedValues = sharedData.packedValues;
    if (currentStructures === true) currentDecoder.structures = currentStructures = updatedStructures;else currentStructures.splice.apply(currentStructures, [0, updatedStructures.length].concat(updatedStructures));
  }
}
function saveState(callback) {
  let savedSrcEnd = srcEnd;
  let savedPosition = position$1;
  let savedSrcStringStart = srcStringStart;
  let savedSrcStringEnd = srcStringEnd;
  let savedSrcString = srcString;
  let savedReferenceMap = referenceMap;
  let savedBundledStrings = bundledStrings$1;

  // TODO: We may need to revisit this if we do more external calls to user code (since it could be slow)
  let savedSrc = new Uint8Array(src$3.slice(0, srcEnd)); // we copy the data in case it changes while external data is processed
  let savedStructures = currentStructures;
  let savedDecoder = currentDecoder;
  let savedSequentialMode = sequentialMode;
  let value = callback();
  srcEnd = savedSrcEnd;
  position$1 = savedPosition;
  srcStringStart = savedSrcStringStart;
  srcStringEnd = savedSrcStringEnd;
  srcString = savedSrcString;
  referenceMap = savedReferenceMap;
  bundledStrings$1 = savedBundledStrings;
  src$3 = savedSrc;
  sequentialMode = savedSequentialMode;
  currentStructures = savedStructures;
  currentDecoder = savedDecoder;
  dataView$1 = new DataView(src$3.buffer, src$3.byteOffset, src$3.byteLength);
  return value;
}
function clearSource() {
  src$3 = null;
  referenceMap = null;
  currentStructures = null;
}
function addExtension$1(extension) {
  currentExtensions[extension.tag] = extension.decode;
}
const mult10 = new Array(147); // this is a table matching binary exponents to the multiplier to determine significant digit rounding
for (let i = 0; i < 256; i++) {
  mult10[i] = +('1e' + Math.floor(45.15 - i * 0.30103));
}
let defaultDecoder = new Decoder$3({
  useRecords: false
});
const decode$f = defaultDecoder.decode;
const decodeMultiple = defaultDecoder.decodeMultiple;

let textEncoder$1;
try {
  textEncoder$1 = new TextEncoder();
} catch (error) {}
let extensions, extensionClasses;
const Buffer$1 = typeof globalThis === 'object' && globalThis.Buffer;
const hasNodeBuffer = typeof Buffer$1 !== 'undefined';
const ByteArrayAllocate = hasNodeBuffer ? Buffer$1.allocUnsafeSlow : Uint8Array;
const ByteArray = hasNodeBuffer ? Buffer$1 : Uint8Array;
const MAX_STRUCTURES = 0x100;
const MAX_BUFFER_SIZE = hasNodeBuffer ? 0x100000000 : 0x7fd00000;
let throwOnIterable;
let target;
let targetView;
let position = 0;
let safeEnd;
let bundledStrings = null;
const MAX_BUNDLE_SIZE = 0xf000;
const hasNonLatin = /[\u0080-\uFFFF]/;
const RECORD_SYMBOL = Symbol('record-id');
let Encoder$3 = class Encoder extends Decoder$3 {
  constructor(options) {
    super(options);
    this.offset = 0;
    let start;
    let sharedStructures;
    let hasSharedUpdate;
    let structures;
    let referenceMap;
    options = options || {};
    let encodeUtf8 = ByteArray.prototype.utf8Write ? function (string, position, maxBytes) {
      return target.utf8Write(string, position, maxBytes);
    } : textEncoder$1 && textEncoder$1.encodeInto ? function (string, position) {
      return textEncoder$1.encodeInto(string, target.subarray(position)).written;
    } : false;
    let encoder = this;
    let hasSharedStructures = options.structures || options.saveStructures;
    let maxSharedStructures = options.maxSharedStructures;
    if (maxSharedStructures == null) maxSharedStructures = hasSharedStructures ? 128 : 0;
    if (maxSharedStructures > 8190) throw new Error('Maximum maxSharedStructure is 8190');
    let isSequential = options.sequential;
    if (isSequential) {
      maxSharedStructures = 0;
    }
    if (!this.structures) this.structures = [];
    if (this.saveStructures) this.saveShared = this.saveStructures;
    let samplingPackedValues,
      packedObjectMap,
      sharedValues = options.sharedValues;
    let sharedPackedObjectMap;
    if (sharedValues) {
      sharedPackedObjectMap = Object.create(null);
      for (let i = 0, l = sharedValues.length; i < l; i++) {
        sharedPackedObjectMap[sharedValues[i]] = i;
      }
    }
    let recordIdsToRemove = [];
    let transitionsCount = 0;
    let serializationsSinceTransitionRebuild = 0;
    this.mapEncode = function (value, encodeOptions) {
      // Experimental support for premapping keys using _keyMap instad of keyMap - not optiimised yet)
      if (this._keyMap && !this._mapped) {
        //console.log('encoding ', value)
        switch (value.constructor.name) {
          case 'Array':
            value = value.map(r => this.encodeKeys(r));
            break;
          //case 'Map': 
          //	value = this.encodeKeys(value)
          //	break
        }
        //this._mapped = true
      }
      return this.encode(value, encodeOptions);
    };
    this.encode = function (value, encodeOptions) {
      if (!target) {
        target = new ByteArrayAllocate(8192);
        targetView = new DataView(target.buffer, 0, 8192);
        position = 0;
      }
      safeEnd = target.length - 10;
      if (safeEnd - position < 0x800) {
        // don't start too close to the end, 
        target = new ByteArrayAllocate(target.length);
        targetView = new DataView(target.buffer, 0, target.length);
        safeEnd = target.length - 10;
        position = 0;
      } else if (encodeOptions === REUSE_BUFFER_MODE) position = position + 7 & 0x7ffffff8; // Word align to make any future copying of this buffer faster
      start = position;
      if (encoder.useSelfDescribedHeader) {
        targetView.setUint32(position, 0xd9d9f700); // tag two byte, then self-descriptive tag
        position += 3;
      }
      referenceMap = encoder.structuredClone ? new Map() : null;
      if (encoder.bundleStrings && typeof value !== 'string') {
        bundledStrings = [];
        bundledStrings.size = Infinity; // force a new bundle start on first string
      } else bundledStrings = null;
      sharedStructures = encoder.structures;
      if (sharedStructures) {
        if (sharedStructures.uninitialized) {
          let sharedData = encoder.getShared() || {};
          encoder.structures = sharedStructures = sharedData.structures || [];
          encoder.sharedVersion = sharedData.version;
          let sharedValues = encoder.sharedValues = sharedData.packedValues;
          if (sharedValues) {
            sharedPackedObjectMap = {};
            for (let i = 0, l = sharedValues.length; i < l; i++) sharedPackedObjectMap[sharedValues[i]] = i;
          }
        }
        let sharedStructuresLength = sharedStructures.length;
        if (sharedStructuresLength > maxSharedStructures && !isSequential) sharedStructuresLength = maxSharedStructures;
        if (!sharedStructures.transitions) {
          // rebuild our structure transitions
          sharedStructures.transitions = Object.create(null);
          for (let i = 0; i < sharedStructuresLength; i++) {
            let keys = sharedStructures[i];
            //console.log('shared struct keys:', keys)
            if (!keys) continue;
            let nextTransition,
              transition = sharedStructures.transitions;
            for (let j = 0, l = keys.length; j < l; j++) {
              if (transition[RECORD_SYMBOL] === undefined) transition[RECORD_SYMBOL] = i;
              let key = keys[j];
              nextTransition = transition[key];
              if (!nextTransition) {
                nextTransition = transition[key] = Object.create(null);
              }
              transition = nextTransition;
            }
            transition[RECORD_SYMBOL] = i | 0x100000;
          }
        }
        if (!isSequential) sharedStructures.nextId = sharedStructuresLength;
      }
      if (hasSharedUpdate) hasSharedUpdate = false;
      structures = sharedStructures || [];
      packedObjectMap = sharedPackedObjectMap;
      if (options.pack) {
        let packedValues = new Map();
        packedValues.values = [];
        packedValues.encoder = encoder;
        packedValues.maxValues = options.maxPrivatePackedValues || (sharedPackedObjectMap ? 16 : Infinity);
        packedValues.objectMap = sharedPackedObjectMap || false;
        packedValues.samplingPackedValues = samplingPackedValues;
        findRepetitiveStrings(value, packedValues);
        if (packedValues.values.length > 0) {
          target[position++] = 0xd8; // one-byte tag
          target[position++] = 51; // tag 51 for packed shared structures https://www.potaroo.net/ietf/ids/draft-ietf-cbor-packed-03.txt
          writeArrayHeader(4);
          let valuesArray = packedValues.values;
          encode(valuesArray);
          writeArrayHeader(0); // prefixes
          writeArrayHeader(0); // suffixes
          packedObjectMap = Object.create(sharedPackedObjectMap || null);
          for (let i = 0, l = valuesArray.length; i < l; i++) {
            packedObjectMap[valuesArray[i]] = i;
          }
        }
      }
      throwOnIterable = encodeOptions & THROW_ON_ITERABLE;
      try {
        if (throwOnIterable) return;
        encode(value);
        if (bundledStrings) {
          writeBundles(start, encode);
        }
        encoder.offset = position; // update the offset so next serialization doesn't write over our buffer, but can continue writing to same buffer sequentially
        if (referenceMap && referenceMap.idsToInsert) {
          position += referenceMap.idsToInsert.length * 2;
          if (position > safeEnd) makeRoom(position);
          encoder.offset = position;
          let serialized = insertIds(target.subarray(start, position), referenceMap.idsToInsert);
          referenceMap = null;
          return serialized;
        }
        if (encodeOptions & REUSE_BUFFER_MODE) {
          target.start = start;
          target.end = position;
          return target;
        }
        return target.subarray(start, position); // position can change if we call encode again in saveShared, so we get the buffer now
      } finally {
        if (sharedStructures) {
          if (serializationsSinceTransitionRebuild < 10) serializationsSinceTransitionRebuild++;
          if (sharedStructures.length > maxSharedStructures) sharedStructures.length = maxSharedStructures;
          if (transitionsCount > 10000) {
            // force a rebuild occasionally after a lot of transitions so it can get cleaned up
            sharedStructures.transitions = null;
            serializationsSinceTransitionRebuild = 0;
            transitionsCount = 0;
            if (recordIdsToRemove.length > 0) recordIdsToRemove = [];
          } else if (recordIdsToRemove.length > 0 && !isSequential) {
            for (let i = 0, l = recordIdsToRemove.length; i < l; i++) {
              recordIdsToRemove[i][RECORD_SYMBOL] = undefined;
            }
            recordIdsToRemove = [];
            //sharedStructures.nextId = maxSharedStructures
          }
        }
        if (hasSharedUpdate && encoder.saveShared) {
          if (encoder.structures.length > maxSharedStructures) {
            encoder.structures = encoder.structures.slice(0, maxSharedStructures);
          }
          // we can't rely on start/end with REUSE_BUFFER_MODE since they will (probably) change when we save
          let returnBuffer = target.subarray(start, position);
          if (encoder.updateSharedData() === false) return encoder.encode(value); // re-encode if it fails
          return returnBuffer;
        }
        if (encodeOptions & RESET_BUFFER_MODE) position = start;
      }
    };
    this.findCommonStringsToPack = () => {
      samplingPackedValues = new Map();
      if (!sharedPackedObjectMap) sharedPackedObjectMap = Object.create(null);
      return options => {
        let threshold = options && options.threshold || 4;
        let position = this.pack ? options.maxPrivatePackedValues || 16 : 0;
        if (!sharedValues) sharedValues = this.sharedValues = [];
        for (let [key, status] of samplingPackedValues) {
          if (status.count > threshold) {
            sharedPackedObjectMap[key] = position++;
            sharedValues.push(key);
            hasSharedUpdate = true;
          }
        }
        while (this.saveShared && this.updateSharedData() === false) {}
        samplingPackedValues = null;
      };
    };
    const encode = value => {
      if (position > safeEnd) target = makeRoom(position);
      var type = typeof value;
      var length;
      if (type === 'string') {
        if (packedObjectMap) {
          let packedPosition = packedObjectMap[value];
          if (packedPosition >= 0) {
            if (packedPosition < 16) target[position++] = packedPosition + 0xe0; // simple values, defined in https://www.potaroo.net/ietf/ids/draft-ietf-cbor-packed-03.txt
            else {
              target[position++] = 0xc6; // tag 6 defined in https://www.potaroo.net/ietf/ids/draft-ietf-cbor-packed-03.txt
              if (packedPosition & 1) encode(15 - packedPosition >> 1);else encode(packedPosition - 16 >> 1);
            }
            return;
            /*						} else if (packedStatus.serializationId != serializationId) {
            							packedStatus.serializationId = serializationId
            							packedStatus.count = 1
            							if (options.sharedPack) {
            								let sharedCount = packedStatus.sharedCount = (packedStatus.sharedCount || 0) + 1
            								if (shareCount > (options.sharedPack.threshold || 5)) {
            									let sharedPosition = packedStatus.position = packedStatus.nextSharedPosition
            									hasSharedUpdate = true
            									if (sharedPosition < 16)
            										target[position++] = sharedPosition + 0xc0
            
            								}
            							}
            						} // else any in-doc incrementation?*/
          } else if (samplingPackedValues && !options.pack) {
            let status = samplingPackedValues.get(value);
            if (status) status.count++;else samplingPackedValues.set(value, {
              count: 1
            });
          }
        }
        let strLength = value.length;
        if (bundledStrings && strLength >= 4 && strLength < 0x400) {
          if ((bundledStrings.size += strLength) > MAX_BUNDLE_SIZE) {
            let extStart;
            let maxBytes = (bundledStrings[0] ? bundledStrings[0].length * 3 + bundledStrings[1].length : 0) + 10;
            if (position + maxBytes > safeEnd) target = makeRoom(position + maxBytes);
            target[position++] = 0xd9; // tag 16-bit
            target[position++] = 0xdf; // tag 0xdff9
            target[position++] = 0xf9;
            // TODO: If we only have one bundle with any string data, only write one string bundle
            target[position++] = bundledStrings.position ? 0x84 : 0x82; // array of 4 or 2 elements depending on if we write bundles
            target[position++] = 0x1a; // 32-bit unsigned int
            extStart = position - start;
            position += 4; // reserve for writing bundle reference
            if (bundledStrings.position) {
              writeBundles(start, encode); // write the last bundles
            }
            bundledStrings = ['', '']; // create new ones
            bundledStrings.size = 0;
            bundledStrings.position = extStart;
          }
          let twoByte = hasNonLatin.test(value);
          bundledStrings[twoByte ? 0 : 1] += value;
          target[position++] = twoByte ? 0xce : 0xcf;
          encode(strLength);
          return;
        }
        let headerSize;
        // first we estimate the header size, so we can write to the correct location
        if (strLength < 0x20) {
          headerSize = 1;
        } else if (strLength < 0x100) {
          headerSize = 2;
        } else if (strLength < 0x10000) {
          headerSize = 3;
        } else {
          headerSize = 5;
        }
        let maxBytes = strLength * 3;
        if (position + maxBytes > safeEnd) target = makeRoom(position + maxBytes);
        if (strLength < 0x40 || !encodeUtf8) {
          let i,
            c1,
            c2,
            strPosition = position + headerSize;
          for (i = 0; i < strLength; i++) {
            c1 = value.charCodeAt(i);
            if (c1 < 0x80) {
              target[strPosition++] = c1;
            } else if (c1 < 0x800) {
              target[strPosition++] = c1 >> 6 | 0xc0;
              target[strPosition++] = c1 & 0x3f | 0x80;
            } else if ((c1 & 0xfc00) === 0xd800 && ((c2 = value.charCodeAt(i + 1)) & 0xfc00) === 0xdc00) {
              c1 = 0x10000 + ((c1 & 0x03ff) << 10) + (c2 & 0x03ff);
              i++;
              target[strPosition++] = c1 >> 18 | 0xf0;
              target[strPosition++] = c1 >> 12 & 0x3f | 0x80;
              target[strPosition++] = c1 >> 6 & 0x3f | 0x80;
              target[strPosition++] = c1 & 0x3f | 0x80;
            } else {
              target[strPosition++] = c1 >> 12 | 0xe0;
              target[strPosition++] = c1 >> 6 & 0x3f | 0x80;
              target[strPosition++] = c1 & 0x3f | 0x80;
            }
          }
          length = strPosition - position - headerSize;
        } else {
          length = encodeUtf8(value, position + headerSize, maxBytes);
        }
        if (length < 0x18) {
          target[position++] = 0x60 | length;
        } else if (length < 0x100) {
          if (headerSize < 2) {
            target.copyWithin(position + 2, position + 1, position + 1 + length);
          }
          target[position++] = 0x78;
          target[position++] = length;
        } else if (length < 0x10000) {
          if (headerSize < 3) {
            target.copyWithin(position + 3, position + 2, position + 2 + length);
          }
          target[position++] = 0x79;
          target[position++] = length >> 8;
          target[position++] = length & 0xff;
        } else {
          if (headerSize < 5) {
            target.copyWithin(position + 5, position + 3, position + 3 + length);
          }
          target[position++] = 0x7a;
          targetView.setUint32(position, length);
          position += 4;
        }
        position += length;
      } else if (type === 'number') {
        if (!this.alwaysUseFloat && value >>> 0 === value) {
          // positive integer, 32-bit or less
          // positive uint
          if (value < 0x18) {
            target[position++] = value;
          } else if (value < 0x100) {
            target[position++] = 0x18;
            target[position++] = value;
          } else if (value < 0x10000) {
            target[position++] = 0x19;
            target[position++] = value >> 8;
            target[position++] = value & 0xff;
          } else {
            target[position++] = 0x1a;
            targetView.setUint32(position, value);
            position += 4;
          }
        } else if (!this.alwaysUseFloat && value >> 0 === value) {
          // negative integer
          if (value >= -24) {
            target[position++] = 0x1f - value;
          } else if (value >= -256) {
            target[position++] = 0x38;
            target[position++] = ~value;
          } else if (value >= -65536) {
            target[position++] = 0x39;
            targetView.setUint16(position, ~value);
            position += 2;
          } else {
            target[position++] = 0x3a;
            targetView.setUint32(position, ~value);
            position += 4;
          }
        } else {
          let useFloat32;
          if ((useFloat32 = this.useFloat32) > 0 && value < 0x100000000 && value >= -2147483648) {
            target[position++] = 0xfa;
            targetView.setFloat32(position, value);
            let xShifted;
            if (useFloat32 < 4 ||
            // this checks for rounding of numbers that were encoded in 32-bit float to nearest significant decimal digit that could be preserved
            (xShifted = value * mult10[(target[position] & 0x7f) << 1 | target[position + 1] >> 7]) >> 0 === xShifted) {
              position += 4;
              return;
            } else position--; // move back into position for writing a double
          }
          target[position++] = 0xfb;
          targetView.setFloat64(position, value);
          position += 8;
        }
      } else if (type === 'object') {
        if (!value) target[position++] = 0xf6;else {
          if (referenceMap) {
            let referee = referenceMap.get(value);
            if (referee) {
              target[position++] = 0xd8;
              target[position++] = 29; // http://cbor.schmorp.de/value-sharing
              target[position++] = 0x19; // 16-bit uint
              if (!referee.references) {
                let idsToInsert = referenceMap.idsToInsert || (referenceMap.idsToInsert = []);
                referee.references = [];
                idsToInsert.push(referee);
              }
              referee.references.push(position - start);
              position += 2; // TODO: also support 32-bit
              return;
            } else referenceMap.set(value, {
              offset: position - start
            });
          }
          let constructor = value.constructor;
          if (constructor === Object) {
            writeObject(value);
          } else if (constructor === Array) {
            length = value.length;
            if (length < 0x18) {
              target[position++] = 0x80 | length;
            } else {
              writeArrayHeader(length);
            }
            for (let i = 0; i < length; i++) {
              encode(value[i]);
            }
          } else if (constructor === Map) {
            if (this.mapsAsObjects ? this.useTag259ForMaps !== false : this.useTag259ForMaps) {
              // use Tag 259 (https://github.com/shanewholloway/js-cbor-codec/blob/master/docs/CBOR-259-spec--explicit-maps.md) for maps if the user wants it that way
              target[position++] = 0xd9;
              target[position++] = 1;
              target[position++] = 3;
            }
            length = value.size;
            if (length < 0x18) {
              target[position++] = 0xa0 | length;
            } else if (length < 0x100) {
              target[position++] = 0xb8;
              target[position++] = length;
            } else if (length < 0x10000) {
              target[position++] = 0xb9;
              target[position++] = length >> 8;
              target[position++] = length & 0xff;
            } else {
              target[position++] = 0xba;
              targetView.setUint32(position, length);
              position += 4;
            }
            if (encoder.keyMap) {
              for (let [key, entryValue] of value) {
                encode(encoder.encodeKey(key));
                encode(entryValue);
              }
            } else {
              for (let [key, entryValue] of value) {
                encode(key);
                encode(entryValue);
              }
            }
          } else {
            for (let i = 0, l = extensions.length; i < l; i++) {
              let extensionClass = extensionClasses[i];
              if (value instanceof extensionClass) {
                let extension = extensions[i];
                let tag = extension.tag;
                if (tag == undefined) tag = extension.getTag && extension.getTag.call(this, value);
                if (tag < 0x18) {
                  target[position++] = 0xc0 | tag;
                } else if (tag < 0x100) {
                  target[position++] = 0xd8;
                  target[position++] = tag;
                } else if (tag < 0x10000) {
                  target[position++] = 0xd9;
                  target[position++] = tag >> 8;
                  target[position++] = tag & 0xff;
                } else if (tag > -1) {
                  target[position++] = 0xda;
                  targetView.setUint32(position, tag);
                  position += 4;
                } // else undefined, don't write tag
                extension.encode.call(this, value, encode, makeRoom);
                return;
              }
            }
            if (value[Symbol.iterator]) {
              if (throwOnIterable) {
                let error = new Error('Iterable should be serialized as iterator');
                error.iteratorNotHandled = true;
                throw error;
              }
              target[position++] = 0x9f; // indefinite length array
              for (let entry of value) {
                encode(entry);
              }
              target[position++] = 0xff; // stop-code
              return;
            }
            if (value[Symbol.asyncIterator] || isBlob(value)) {
              let error = new Error('Iterable/blob should be serialized as iterator');
              error.iteratorNotHandled = true;
              throw error;
            }
            if (this.useToJSON && value.toJSON) {
              const json = value.toJSON();
              // if for some reason value.toJSON returns itself it'll loop forever
              if (json !== value) return encode(json);
            }

            // no extension found, write as a plain object
            writeObject(value);
          }
        }
      } else if (type === 'boolean') {
        target[position++] = value ? 0xf5 : 0xf4;
      } else if (type === 'bigint') {
        if (value < BigInt(1) << BigInt(64) && value >= 0) {
          // use an unsigned int as long as it fits
          target[position++] = 0x1b;
          targetView.setBigUint64(position, value);
        } else if (value > -(BigInt(1) << BigInt(64)) && value < 0) {
          // if we can fit an unsigned int, use that
          target[position++] = 0x3b;
          targetView.setBigUint64(position, -value - BigInt(1));
        } else {
          // overflow
          if (this.largeBigIntToFloat) {
            target[position++] = 0xfb;
            targetView.setFloat64(position, Number(value));
          } else {
            if (value >= BigInt(0)) target[position++] = 0xc2; // tag 2
            else {
              target[position++] = 0xc3; // tag 2
              value = BigInt(-1) - value;
            }
            let bytes = [];
            while (value) {
              bytes.push(Number(value & BigInt(0xff)));
              value >>= BigInt(8);
            }
            writeBuffer(new Uint8Array(bytes.reverse()), makeRoom);
            return;
          }
        }
        position += 8;
      } else if (type === 'undefined') {
        target[position++] = 0xf7;
      } else {
        throw new Error('Unknown type: ' + type);
      }
    };
    const writeObject = this.useRecords === false ? this.variableMapSize ? object => {
      // this method is slightly slower, but generates "preferred serialization" (optimally small for smaller objects)
      let keys = Object.keys(object);
      let vals = Object.values(object);
      let length = keys.length;
      if (length < 0x18) {
        target[position++] = 0xa0 | length;
      } else if (length < 0x100) {
        target[position++] = 0xb8;
        target[position++] = length;
      } else if (length < 0x10000) {
        target[position++] = 0xb9;
        target[position++] = length >> 8;
        target[position++] = length & 0xff;
      } else {
        target[position++] = 0xba;
        targetView.setUint32(position, length);
        position += 4;
      }
      if (encoder.keyMap) {
        for (let i = 0; i < length; i++) {
          encode(encoder.encodeKey(keys[i]));
          encode(vals[i]);
        }
      } else {
        for (let i = 0; i < length; i++) {
          encode(keys[i]);
          encode(vals[i]);
        }
      }
    } : object => {
      target[position++] = 0xb9; // always use map 16, so we can preallocate and set the length afterwards
      let objectOffset = position - start;
      position += 2;
      let size = 0;
      if (encoder.keyMap) {
        for (let key in object) if (typeof object.hasOwnProperty !== 'function' || object.hasOwnProperty(key)) {
          encode(encoder.encodeKey(key));
          encode(object[key]);
          size++;
        }
      } else {
        for (let key in object) if (typeof object.hasOwnProperty !== 'function' || object.hasOwnProperty(key)) {
          encode(key);
          encode(object[key]);
          size++;
        }
      }
      target[objectOffset++ + start] = size >> 8;
      target[objectOffset + start] = size & 0xff;
    } : (object, skipValues) => {
      let nextTransition,
        transition = structures.transitions || (structures.transitions = Object.create(null));
      let newTransitions = 0;
      let length = 0;
      let parentRecordId;
      let keys;
      if (this.keyMap) {
        keys = Object.keys(object).map(k => this.encodeKey(k));
        length = keys.length;
        for (let i = 0; i < length; i++) {
          let key = keys[i];
          nextTransition = transition[key];
          if (!nextTransition) {
            nextTransition = transition[key] = Object.create(null);
            newTransitions++;
          }
          transition = nextTransition;
        }
      } else {
        for (let key in object) if (typeof object.hasOwnProperty !== 'function' || object.hasOwnProperty(key)) {
          nextTransition = transition[key];
          if (!nextTransition) {
            if (transition[RECORD_SYMBOL] & 0x100000) {
              // this indicates it is a brancheable/extendable terminal node, so we will use this record id and extend it
              parentRecordId = transition[RECORD_SYMBOL] & 0xffff;
            }
            nextTransition = transition[key] = Object.create(null);
            newTransitions++;
          }
          transition = nextTransition;
          length++;
        }
      }
      let recordId = transition[RECORD_SYMBOL];
      if (recordId !== undefined) {
        recordId &= 0xffff;
        target[position++] = 0xd9;
        target[position++] = recordId >> 8 | 0xe0;
        target[position++] = recordId & 0xff;
      } else {
        if (!keys) keys = transition.__keys__ || (transition.__keys__ = Object.keys(object));
        if (parentRecordId === undefined) {
          recordId = structures.nextId++;
          if (!recordId) {
            recordId = 0;
            structures.nextId = 1;
          }
          if (recordId >= MAX_STRUCTURES) {
            // cycle back around
            structures.nextId = (recordId = maxSharedStructures) + 1;
          }
        } else {
          recordId = parentRecordId;
        }
        structures[recordId] = keys;
        if (recordId < maxSharedStructures) {
          target[position++] = 0xd9;
          target[position++] = recordId >> 8 | 0xe0;
          target[position++] = recordId & 0xff;
          transition = structures.transitions;
          for (let i = 0; i < length; i++) {
            if (transition[RECORD_SYMBOL] === undefined || transition[RECORD_SYMBOL] & 0x100000) transition[RECORD_SYMBOL] = recordId;
            transition = transition[keys[i]];
          }
          transition[RECORD_SYMBOL] = recordId | 0x100000; // indicates it is a extendable terminal
          hasSharedUpdate = true;
        } else {
          transition[RECORD_SYMBOL] = recordId;
          targetView.setUint32(position, 0xd9dfff00); // tag two byte, then record definition id
          position += 3;
          if (newTransitions) transitionsCount += serializationsSinceTransitionRebuild * newTransitions;
          // record the removal of the id, we can maintain our shared structure
          if (recordIdsToRemove.length >= MAX_STRUCTURES - maxSharedStructures) recordIdsToRemove.shift()[RECORD_SYMBOL] = undefined; // we are cycling back through, and have to remove old ones
          recordIdsToRemove.push(transition);
          writeArrayHeader(length + 2);
          encode(0xe000 + recordId);
          encode(keys);
          if (skipValues) return; // special exit for iterator
          for (let key in object) if (typeof object.hasOwnProperty !== 'function' || object.hasOwnProperty(key)) encode(object[key]);
          return;
        }
      }
      if (length < 0x18) {
        // write the array header
        target[position++] = 0x80 | length;
      } else {
        writeArrayHeader(length);
      }
      if (skipValues) return; // special exit for iterator
      for (let key in object) if (typeof object.hasOwnProperty !== 'function' || object.hasOwnProperty(key)) encode(object[key]);
    };
    const makeRoom = end => {
      let newSize;
      if (end > 0x1000000) {
        // special handling for really large buffers
        if (end - start > MAX_BUFFER_SIZE) throw new Error('Encoded buffer would be larger than maximum buffer size');
        newSize = Math.min(MAX_BUFFER_SIZE, Math.round(Math.max((end - start) * (end > 0x4000000 ? 1.25 : 2), 0x400000) / 0x1000) * 0x1000);
      } else
        // faster handling for smaller buffers
        newSize = (Math.max(end - start << 2, target.length - 1) >> 12) + 1 << 12;
      let newBuffer = new ByteArrayAllocate(newSize);
      targetView = new DataView(newBuffer.buffer, 0, newSize);
      if (target.copy) target.copy(newBuffer, 0, start, end);else newBuffer.set(target.slice(start, end));
      position -= start;
      start = 0;
      safeEnd = newBuffer.length - 10;
      return target = newBuffer;
    };
    let chunkThreshold = 100;
    let continuedChunkThreshold = 1000;
    this.encodeAsIterable = function (value, options) {
      return startEncoding(value, options, encodeObjectAsIterable);
    };
    this.encodeAsAsyncIterable = function (value, options) {
      return startEncoding(value, options, encodeObjectAsAsyncIterable);
    };
    function* encodeObjectAsIterable(object, iterateProperties, finalIterable) {
      let constructor = object.constructor;
      if (constructor === Object) {
        let useRecords = encoder.useRecords !== false;
        if (useRecords) writeObject(object, true); // write the record identifier
        else writeEntityLength(Object.keys(object).length, 0xa0);
        for (let key in object) {
          let value = object[key];
          if (!useRecords) encode(key);
          if (value && typeof value === 'object') {
            if (iterateProperties[key]) yield* encodeObjectAsIterable(value, iterateProperties[key]);else yield* tryEncode(value, iterateProperties, key);
          } else encode(value);
        }
      } else if (constructor === Array) {
        let length = object.length;
        writeArrayHeader(length);
        for (let i = 0; i < length; i++) {
          let value = object[i];
          if (value && (typeof value === 'object' || position - start > chunkThreshold)) {
            if (iterateProperties.element) yield* encodeObjectAsIterable(value, iterateProperties.element);else yield* tryEncode(value, iterateProperties, 'element');
          } else encode(value);
        }
      } else if (object[Symbol.iterator] && !object.buffer) {
        // iterator, but exclude typed arrays
        target[position++] = 0x9f; // start indefinite array
        for (let value of object) {
          if (value && (typeof value === 'object' || position - start > chunkThreshold)) {
            if (iterateProperties.element) yield* encodeObjectAsIterable(value, iterateProperties.element);else yield* tryEncode(value, iterateProperties, 'element');
          } else encode(value);
        }
        target[position++] = 0xff; // stop byte
      } else if (isBlob(object)) {
        writeEntityLength(object.size, 0x40); // encode as binary data
        yield target.subarray(start, position);
        yield object; // directly return blobs, they have to be encoded asynchronously
        restartEncoding();
      } else if (object[Symbol.asyncIterator]) {
        target[position++] = 0x9f; // start indefinite array
        yield target.subarray(start, position);
        yield object; // directly return async iterators, they have to be encoded asynchronously
        restartEncoding();
        target[position++] = 0xff; // stop byte
      } else {
        encode(object);
      }
      if (finalIterable && position > start) yield target.subarray(start, position);else if (position - start > chunkThreshold) {
        yield target.subarray(start, position);
        restartEncoding();
      }
    }
    function* tryEncode(value, iterateProperties, key) {
      let restart = position - start;
      try {
        encode(value);
        if (position - start > chunkThreshold) {
          yield target.subarray(start, position);
          restartEncoding();
        }
      } catch (error) {
        if (error.iteratorNotHandled) {
          iterateProperties[key] = {};
          position = start + restart; // restart our position so we don't have partial data from last encode
          yield* encodeObjectAsIterable.call(this, value, iterateProperties[key]);
        } else throw error;
      }
    }
    function restartEncoding() {
      chunkThreshold = continuedChunkThreshold;
      encoder.encode(null, THROW_ON_ITERABLE); // restart encoding
    }
    function startEncoding(value, options, encodeIterable) {
      if (options && options.chunkThreshold)
        // explicitly specified chunk sizes
        chunkThreshold = continuedChunkThreshold = options.chunkThreshold;else
        // we start with a smaller threshold to get initial bytes sent quickly
        chunkThreshold = 100;
      if (value && typeof value === 'object') {
        encoder.encode(null, THROW_ON_ITERABLE); // start encoding
        return encodeIterable(value, encoder.iterateProperties || (encoder.iterateProperties = {}), true);
      }
      return [encoder.encode(value)];
    }
    async function* encodeObjectAsAsyncIterable(value, iterateProperties) {
      for (let encodedValue of encodeObjectAsIterable(value, iterateProperties, true)) {
        let constructor = encodedValue.constructor;
        if (constructor === ByteArray || constructor === Uint8Array) yield encodedValue;else if (isBlob(encodedValue)) {
          let reader = encodedValue.stream().getReader();
          let next;
          while (!(next = await reader.read()).done) {
            yield next.value;
          }
        } else if (encodedValue[Symbol.asyncIterator]) {
          for await (let asyncValue of encodedValue) {
            restartEncoding();
            if (asyncValue) yield* encodeObjectAsAsyncIterable(asyncValue, iterateProperties.async || (iterateProperties.async = {}));else yield encoder.encode(asyncValue);
          }
        } else {
          yield encodedValue;
        }
      }
    }
  }
  useBuffer(buffer) {
    // this means we are finished using our own buffer and we can write over it safely
    target = buffer;
    targetView = new DataView(target.buffer, target.byteOffset, target.byteLength);
    position = 0;
  }
  clearSharedData() {
    if (this.structures) this.structures = [];
    if (this.sharedValues) this.sharedValues = undefined;
  }
  updateSharedData() {
    let lastVersion = this.sharedVersion || 0;
    this.sharedVersion = lastVersion + 1;
    let structuresCopy = this.structures.slice(0);
    let sharedData = new SharedData(structuresCopy, this.sharedValues, this.sharedVersion);
    let saveResults = this.saveShared(sharedData, existingShared => (existingShared && existingShared.version || 0) == lastVersion);
    if (saveResults === false) {
      // get updated structures and try again if the update failed
      sharedData = this.getShared() || {};
      this.structures = sharedData.structures || [];
      this.sharedValues = sharedData.packedValues;
      this.sharedVersion = sharedData.version;
      this.structures.nextId = this.structures.length;
    } else {
      // restore structures
      structuresCopy.forEach((structure, i) => this.structures[i] = structure);
    }
    // saveShared may fail to write and reload, or may have reloaded to check compatibility and overwrite saved data, either way load the correct shared data
    return saveResults;
  }
};
function writeEntityLength(length, majorValue) {
  if (length < 0x18) target[position++] = majorValue | length;else if (length < 0x100) {
    target[position++] = majorValue | 0x18;
    target[position++] = length;
  } else if (length < 0x10000) {
    target[position++] = majorValue | 0x19;
    target[position++] = length >> 8;
    target[position++] = length & 0xff;
  } else {
    target[position++] = majorValue | 0x1a;
    targetView.setUint32(position, length);
    position += 4;
  }
}
class SharedData {
  constructor(structures, values, version) {
    this.structures = structures;
    this.packedValues = values;
    this.version = version;
  }
}
function writeArrayHeader(length) {
  if (length < 0x18) target[position++] = 0x80 | length;else if (length < 0x100) {
    target[position++] = 0x98;
    target[position++] = length;
  } else if (length < 0x10000) {
    target[position++] = 0x99;
    target[position++] = length >> 8;
    target[position++] = length & 0xff;
  } else {
    target[position++] = 0x9a;
    targetView.setUint32(position, length);
    position += 4;
  }
}
const BlobConstructor = typeof Blob === 'undefined' ? function () {} : Blob;
function isBlob(object) {
  if (object instanceof BlobConstructor) return true;
  let tag = object[Symbol.toStringTag];
  return tag === 'Blob' || tag === 'File';
}
function findRepetitiveStrings(value, packedValues) {
  switch (typeof value) {
    case 'string':
      if (value.length > 3) {
        if (packedValues.objectMap[value] > -1 || packedValues.values.length >= packedValues.maxValues) return;
        let packedStatus = packedValues.get(value);
        if (packedStatus) {
          if (++packedStatus.count == 2) {
            packedValues.values.push(value);
          }
        } else {
          packedValues.set(value, {
            count: 1
          });
          if (packedValues.samplingPackedValues) {
            let status = packedValues.samplingPackedValues.get(value);
            if (status) status.count++;else packedValues.samplingPackedValues.set(value, {
              count: 1
            });
          }
        }
      }
      break;
    case 'object':
      if (value) {
        if (value instanceof Array) {
          for (let i = 0, l = value.length; i < l; i++) {
            findRepetitiveStrings(value[i], packedValues);
          }
        } else {
          let includeKeys = !packedValues.encoder.useRecords;
          for (var key in value) {
            if (value.hasOwnProperty(key)) {
              if (includeKeys) findRepetitiveStrings(key, packedValues);
              findRepetitiveStrings(value[key], packedValues);
            }
          }
        }
      }
      break;
    case 'function':
      console.log(value);
  }
}
const isLittleEndianMachine = new Uint8Array(new Uint16Array([1]).buffer)[0] == 1;
extensionClasses = [Date, Set, Error, RegExp, Tag, ArrayBuffer, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, typeof BigUint64Array == 'undefined' ? function () {} : BigUint64Array, Int8Array, Int16Array, Int32Array, typeof BigInt64Array == 'undefined' ? function () {} : BigInt64Array, Float32Array, Float64Array, SharedData];

//Object.getPrototypeOf(Uint8Array.prototype).constructor /*TypedArray*/
extensions = [{
  // Date
  tag: 1,
  encode(date, encode) {
    let seconds = date.getTime() / 1000;
    if ((this.useTimestamp32 || date.getMilliseconds() === 0) && seconds >= 0 && seconds < 0x100000000) {
      // Timestamp 32
      target[position++] = 0x1a;
      targetView.setUint32(position, seconds);
      position += 4;
    } else {
      // Timestamp float64
      target[position++] = 0xfb;
      targetView.setFloat64(position, seconds);
      position += 8;
    }
  }
}, {
  // Set
  tag: 258,
  // https://github.com/input-output-hk/cbor-sets-spec/blob/master/CBOR_SETS.md
  encode(set, encode) {
    let array = Array.from(set);
    encode(array);
  }
}, {
  // Error
  tag: 27,
  // http://cbor.schmorp.de/generic-object
  encode(error, encode) {
    encode([error.name, error.message]);
  }
}, {
  // RegExp
  tag: 27,
  // http://cbor.schmorp.de/generic-object
  encode(regex, encode) {
    encode(['RegExp', regex.source, regex.flags]);
  }
}, {
  // Tag
  getTag(tag) {
    return tag.tag;
  },
  encode(tag, encode) {
    encode(tag.value);
  }
}, {
  // ArrayBuffer
  encode(arrayBuffer, encode, makeRoom) {
    writeBuffer(arrayBuffer, makeRoom);
  }
}, {
  // Uint8Array
  getTag(typedArray) {
    if (typedArray.constructor === Uint8Array) {
      if (this.tagUint8Array || hasNodeBuffer && this.tagUint8Array !== false) return 64;
    } // else no tag
  },
  encode(typedArray, encode, makeRoom) {
    writeBuffer(typedArray, makeRoom);
  }
}, typedArrayEncoder(68, 1), typedArrayEncoder(69, 2), typedArrayEncoder(70, 4), typedArrayEncoder(71, 8), typedArrayEncoder(72, 1), typedArrayEncoder(77, 2), typedArrayEncoder(78, 4), typedArrayEncoder(79, 8), typedArrayEncoder(85, 4), typedArrayEncoder(86, 8), {
  encode(sharedData, encode) {
    // write SharedData
    let packedValues = sharedData.packedValues || [];
    let sharedStructures = sharedData.structures || [];
    if (packedValues.values.length > 0) {
      target[position++] = 0xd8; // one-byte tag
      target[position++] = 51; // tag 51 for packed shared structures https://www.potaroo.net/ietf/ids/draft-ietf-cbor-packed-03.txt
      writeArrayHeader(4);
      let valuesArray = packedValues.values;
      encode(valuesArray);
      writeArrayHeader(0); // prefixes
      writeArrayHeader(0); // suffixes
      packedObjectMap = Object.create(sharedPackedObjectMap || null);
      for (let i = 0, l = valuesArray.length; i < l; i++) {
        packedObjectMap[valuesArray[i]] = i;
      }
    }
    {
      targetView.setUint32(position, 0xd9dffe00);
      position += 3;
      let definitions = sharedStructures.slice(0);
      definitions.unshift(0xe000);
      definitions.push(new Tag(sharedData.version, 0x53687264));
      encode(definitions);
    }
  }
}];
function typedArrayEncoder(tag, size) {
  if (!isLittleEndianMachine && size > 1) tag -= 4; // the big endian equivalents are 4 less
  return {
    tag: tag,
    encode: function writeExtBuffer(typedArray, encode) {
      let length = typedArray.byteLength;
      let offset = typedArray.byteOffset || 0;
      let buffer = typedArray.buffer || typedArray;
      encode(hasNodeBuffer ? Buffer$1.from(buffer, offset, length) : new Uint8Array(buffer, offset, length));
    }
  };
}
function writeBuffer(buffer, makeRoom) {
  let length = buffer.byteLength;
  if (length < 0x18) {
    target[position++] = 0x40 + length;
  } else if (length < 0x100) {
    target[position++] = 0x58;
    target[position++] = length;
  } else if (length < 0x10000) {
    target[position++] = 0x59;
    target[position++] = length >> 8;
    target[position++] = length & 0xff;
  } else {
    target[position++] = 0x5a;
    targetView.setUint32(position, length);
    position += 4;
  }
  if (position + length >= target.length) {
    makeRoom(position + length);
  }
  // if it is already a typed array (has an ArrayBuffer), use that, but if it is an ArrayBuffer itself,
  // must wrap it to set it.
  target.set(buffer.buffer ? buffer : new Uint8Array(buffer), position);
  position += length;
}
function insertIds(serialized, idsToInsert) {
  // insert the ids that need to be referenced for structured clones
  let nextId;
  let distanceToMove = idsToInsert.length * 2;
  let lastEnd = serialized.length - distanceToMove;
  idsToInsert.sort((a, b) => a.offset > b.offset ? 1 : -1);
  for (let id = 0; id < idsToInsert.length; id++) {
    let referee = idsToInsert[id];
    referee.id = id;
    for (let position of referee.references) {
      serialized[position++] = id >> 8;
      serialized[position] = id & 0xff;
    }
  }
  while (nextId = idsToInsert.pop()) {
    let offset = nextId.offset;
    serialized.copyWithin(offset + distanceToMove, offset, lastEnd);
    distanceToMove -= 2;
    let position = offset + distanceToMove;
    serialized[position++] = 0xd8;
    serialized[position++] = 28; // http://cbor.schmorp.de/value-sharing
    lastEnd = offset;
  }
  return serialized;
}
function writeBundles(start, encode) {
  targetView.setUint32(bundledStrings.position + start, position - bundledStrings.position - start + 1); // the offset to bundle
  let writeStrings = bundledStrings;
  bundledStrings = null;
  encode(writeStrings[0]);
  encode(writeStrings[1]);
}
function addExtension(extension) {
  if (extension.Class) {
    if (!extension.encode) throw new Error('Extension has no encode function');
    extensionClasses.unshift(extension.Class);
    extensions.unshift(extension);
  }
  addExtension$1(extension);
}
let defaultEncoder = new Encoder$3({
  useRecords: false
});
defaultEncoder.encode;
defaultEncoder.encodeAsIterable;
defaultEncoder.encodeAsAsyncIterable;
const REUSE_BUFFER_MODE = 512;
const RESET_BUFFER_MODE = 1024;
const THROW_ON_ITERABLE = 2048;

var encode_1$3 = encode$5;
var MSB$3 = 128,
  MSBALL$2 = -128,
  INT$2 = Math.pow(2, 31);
function encode$5(num, out, offset) {
  out = out || [];
  offset = offset || 0;
  var oldOffset = offset;
  while (num >= INT$2) {
    out[offset++] = num & 255 | MSB$3;
    num /= 128;
  }
  while (num & MSBALL$2) {
    out[offset++] = num & 255 | MSB$3;
    num >>>= 7;
  }
  out[offset] = num | 0;
  encode$5.bytes = offset - oldOffset + 1;
  return out;
}
var decode$e = read$2;
var MSB$1$2 = 128,
  REST$1$2 = 127;
function read$2(buf, offset) {
  var res = 0,
    offset = offset || 0,
    shift = 0,
    counter = offset,
    b,
    l = buf.length;
  do {
    if (counter >= l) {
      read$2.bytes = 0;
      throw new RangeError('Could not decode varint');
    }
    b = buf[counter++];
    res += shift < 28 ? (b & REST$1$2) << shift : (b & REST$1$2) * Math.pow(2, shift);
    shift += 7;
  } while (b >= MSB$1$2);
  read$2.bytes = counter - offset;
  return res;
}
var N1$2 = Math.pow(2, 7);
var N2$2 = Math.pow(2, 14);
var N3$2 = Math.pow(2, 21);
var N4$2 = Math.pow(2, 28);
var N5$2 = Math.pow(2, 35);
var N6$2 = Math.pow(2, 42);
var N7$2 = Math.pow(2, 49);
var N8$2 = Math.pow(2, 56);
var N9$2 = Math.pow(2, 63);
var length$3 = function (value) {
  return value < N1$2 ? 1 : value < N2$2 ? 2 : value < N3$2 ? 3 : value < N4$2 ? 4 : value < N5$2 ? 5 : value < N6$2 ? 6 : value < N7$2 ? 7 : value < N8$2 ? 8 : value < N9$2 ? 9 : 10;
};
var varint$4 = {
  encode: encode_1$3,
  decode: decode$e,
  encodingLength: length$3
};
var _brrp_varint$2 = varint$4;

const decode$d = (data, offset = 0) => {
  const code = _brrp_varint$2.decode(data, offset);
  return [code, _brrp_varint$2.decode.bytes];
};
const encodeTo$2 = (int, target, offset = 0) => {
  _brrp_varint$2.encode(int, target, offset);
  return target;
};
const encodingLength$2 = int => {
  return _brrp_varint$2.encodingLength(int);
};

const equals$5 = (aa, bb) => {
  if (aa === bb) return true;
  if (aa.byteLength !== bb.byteLength) {
    return false;
  }
  for (let ii = 0; ii < aa.byteLength; ii++) {
    if (aa[ii] !== bb[ii]) {
      return false;
    }
  }
  return true;
};
const coerce$2 = o => {
  if (o instanceof Uint8Array && o.constructor.name === 'Uint8Array') return o;
  if (o instanceof ArrayBuffer) return new Uint8Array(o);
  if (ArrayBuffer.isView(o)) {
    return new Uint8Array(o.buffer, o.byteOffset, o.byteLength);
  }
  throw new Error('Unknown type, must be binary type');
};

const create$2 = (code, digest) => {
  const size = digest.byteLength;
  const sizeOffset = encodingLength$2(code);
  const digestOffset = sizeOffset + encodingLength$2(size);
  const bytes = new Uint8Array(digestOffset + size);
  encodeTo$2(code, bytes, 0);
  encodeTo$2(size, bytes, sizeOffset);
  bytes.set(digest, digestOffset);
  return new Digest$2(code, size, digest, bytes);
};
const decode$c = multihash => {
  const bytes = coerce$2(multihash);
  const [code, sizeOffset] = decode$d(bytes);
  const [size, digestOffset] = decode$d(bytes.subarray(sizeOffset));
  const digest = bytes.subarray(sizeOffset + digestOffset);
  if (digest.byteLength !== size) {
    throw new Error('Incorrect length');
  }
  return new Digest$2(code, size, digest, bytes);
};
const equals$4 = (a, b) => {
  if (a === b) {
    return true;
  } else {
    return a.code === b.code && a.size === b.size && equals$5(a.bytes, b.bytes);
  }
};
let Digest$2 = class Digest {
  constructor(code, size, digest, bytes) {
    this.code = code;
    this.size = size;
    this.digest = digest;
    this.bytes = bytes;
  }
};

function base$2(ALPHABET, name) {
  if (ALPHABET.length >= 255) {
    throw new TypeError('Alphabet too long');
  }
  var BASE_MAP = new Uint8Array(256);
  for (var j = 0; j < BASE_MAP.length; j++) {
    BASE_MAP[j] = 255;
  }
  for (var i = 0; i < ALPHABET.length; i++) {
    var x = ALPHABET.charAt(i);
    var xc = x.charCodeAt(0);
    if (BASE_MAP[xc] !== 255) {
      throw new TypeError(x + ' is ambiguous');
    }
    BASE_MAP[xc] = i;
  }
  var BASE = ALPHABET.length;
  var LEADER = ALPHABET.charAt(0);
  var FACTOR = Math.log(BASE) / Math.log(256);
  var iFACTOR = Math.log(256) / Math.log(BASE);
  function encode(source) {
    if (source instanceof Uint8Array) ;else if (ArrayBuffer.isView(source)) {
      source = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    } else if (Array.isArray(source)) {
      source = Uint8Array.from(source);
    }
    if (!(source instanceof Uint8Array)) {
      throw new TypeError('Expected Uint8Array');
    }
    if (source.length === 0) {
      return '';
    }
    var zeroes = 0;
    var length = 0;
    var pbegin = 0;
    var pend = source.length;
    while (pbegin !== pend && source[pbegin] === 0) {
      pbegin++;
      zeroes++;
    }
    var size = (pend - pbegin) * iFACTOR + 1 >>> 0;
    var b58 = new Uint8Array(size);
    while (pbegin !== pend) {
      var carry = source[pbegin];
      var i = 0;
      for (var it1 = size - 1; (carry !== 0 || i < length) && it1 !== -1; it1--, i++) {
        carry += 256 * b58[it1] >>> 0;
        b58[it1] = carry % BASE >>> 0;
        carry = carry / BASE >>> 0;
      }
      if (carry !== 0) {
        throw new Error('Non-zero carry');
      }
      length = i;
      pbegin++;
    }
    var it2 = size - length;
    while (it2 !== size && b58[it2] === 0) {
      it2++;
    }
    var str = LEADER.repeat(zeroes);
    for (; it2 < size; ++it2) {
      str += ALPHABET.charAt(b58[it2]);
    }
    return str;
  }
  function decodeUnsafe(source) {
    if (typeof source !== 'string') {
      throw new TypeError('Expected String');
    }
    if (source.length === 0) {
      return new Uint8Array();
    }
    var psz = 0;
    if (source[psz] === ' ') {
      return;
    }
    var zeroes = 0;
    var length = 0;
    while (source[psz] === LEADER) {
      zeroes++;
      psz++;
    }
    var size = (source.length - psz) * FACTOR + 1 >>> 0;
    var b256 = new Uint8Array(size);
    while (source[psz]) {
      var carry = BASE_MAP[source.charCodeAt(psz)];
      if (carry === 255) {
        return;
      }
      var i = 0;
      for (var it3 = size - 1; (carry !== 0 || i < length) && it3 !== -1; it3--, i++) {
        carry += BASE * b256[it3] >>> 0;
        b256[it3] = carry % 256 >>> 0;
        carry = carry / 256 >>> 0;
      }
      if (carry !== 0) {
        throw new Error('Non-zero carry');
      }
      length = i;
      psz++;
    }
    if (source[psz] === ' ') {
      return;
    }
    var it4 = size - length;
    while (it4 !== size && b256[it4] === 0) {
      it4++;
    }
    var vch = new Uint8Array(zeroes + (size - it4));
    var j = zeroes;
    while (it4 !== size) {
      vch[j++] = b256[it4++];
    }
    return vch;
  }
  function decode(string) {
    var buffer = decodeUnsafe(string);
    if (buffer) {
      return buffer;
    }
    throw new Error(`Non-${name} character`);
  }
  return {
    encode: encode,
    decodeUnsafe: decodeUnsafe,
    decode: decode
  };
}
var src$2 = base$2;
var _brrp__multiformats_scope_baseX$2 = src$2;

let Encoder$2 = class Encoder {
  constructor(name, prefix, baseEncode) {
    this.name = name;
    this.prefix = prefix;
    this.baseEncode = baseEncode;
  }
  encode(bytes) {
    if (bytes instanceof Uint8Array) {
      return `${this.prefix}${this.baseEncode(bytes)}`;
    } else {
      throw Error('Unknown type, must be binary type');
    }
  }
};
let Decoder$2 = class Decoder {
  constructor(name, prefix, baseDecode) {
    this.name = name;
    this.prefix = prefix;
    if (prefix.codePointAt(0) === undefined) {
      throw new Error('Invalid prefix character');
    }
    this.prefixCodePoint = prefix.codePointAt(0);
    this.baseDecode = baseDecode;
  }
  decode(text) {
    if (typeof text === 'string') {
      if (text.codePointAt(0) !== this.prefixCodePoint) {
        throw Error(`Unable to decode multibase string ${JSON.stringify(text)}, ${this.name} decoder only supports inputs prefixed with ${this.prefix}`);
      }
      return this.baseDecode(text.slice(this.prefix.length));
    } else {
      throw Error('Can only multibase decode strings');
    }
  }
  or(decoder) {
    return or$2(this, decoder);
  }
};
let ComposedDecoder$2 = class ComposedDecoder {
  constructor(decoders) {
    this.decoders = decoders;
  }
  or(decoder) {
    return or$2(this, decoder);
  }
  decode(input) {
    const prefix = input[0];
    const decoder = this.decoders[prefix];
    if (decoder) {
      return decoder.decode(input);
    } else {
      throw RangeError(`Unable to decode multibase string ${JSON.stringify(input)}, only inputs prefixed with ${Object.keys(this.decoders)} are supported`);
    }
  }
};
const or$2 = (left, right) => new ComposedDecoder$2({
  ...(left.decoders || {
    [left.prefix]: left
  }),
  ...(right.decoders || {
    [right.prefix]: right
  })
});
let Codec$2 = class Codec {
  constructor(name, prefix, baseEncode, baseDecode) {
    this.name = name;
    this.prefix = prefix;
    this.baseEncode = baseEncode;
    this.baseDecode = baseDecode;
    this.encoder = new Encoder$2(name, prefix, baseEncode);
    this.decoder = new Decoder$2(name, prefix, baseDecode);
  }
  encode(input) {
    return this.encoder.encode(input);
  }
  decode(input) {
    return this.decoder.decode(input);
  }
};
const from$2 = ({
  name,
  prefix,
  encode,
  decode
}) => new Codec$2(name, prefix, encode, decode);
const baseX$2 = ({
  prefix,
  name,
  alphabet
}) => {
  const {
    encode,
    decode
  } = _brrp__multiformats_scope_baseX$2(alphabet, name);
  return from$2({
    prefix,
    name,
    encode,
    decode: text => coerce$2(decode(text))
  });
};
const decode$b = (string, alphabet, bitsPerChar, name) => {
  const codes = {};
  for (let i = 0; i < alphabet.length; ++i) {
    codes[alphabet[i]] = i;
  }
  let end = string.length;
  while (string[end - 1] === '=') {
    --end;
  }
  const out = new Uint8Array(end * bitsPerChar / 8 | 0);
  let bits = 0;
  let buffer = 0;
  let written = 0;
  for (let i = 0; i < end; ++i) {
    const value = codes[string[i]];
    if (value === undefined) {
      throw new SyntaxError(`Non-${name} character`);
    }
    buffer = buffer << bitsPerChar | value;
    bits += bitsPerChar;
    if (bits >= 8) {
      bits -= 8;
      out[written++] = 255 & buffer >> bits;
    }
  }
  if (bits >= bitsPerChar || 255 & buffer << 8 - bits) {
    throw new SyntaxError('Unexpected end of data');
  }
  return out;
};
const encode$4 = (data, alphabet, bitsPerChar) => {
  const pad = alphabet[alphabet.length - 1] === '=';
  const mask = (1 << bitsPerChar) - 1;
  let out = '';
  let bits = 0;
  let buffer = 0;
  for (let i = 0; i < data.length; ++i) {
    buffer = buffer << 8 | data[i];
    bits += 8;
    while (bits > bitsPerChar) {
      bits -= bitsPerChar;
      out += alphabet[mask & buffer >> bits];
    }
  }
  if (bits) {
    out += alphabet[mask & buffer << bitsPerChar - bits];
  }
  if (pad) {
    while (out.length * bitsPerChar & 7) {
      out += '=';
    }
  }
  return out;
};
const rfc4648$2 = ({
  name,
  prefix,
  bitsPerChar,
  alphabet
}) => {
  return from$2({
    prefix,
    name,
    encode(input) {
      return encode$4(input, alphabet, bitsPerChar);
    },
    decode(input) {
      return decode$b(input, alphabet, bitsPerChar, name);
    }
  });
};

const base58btc$2 = baseX$2({
  name: 'base58btc',
  prefix: 'z',
  alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
});
baseX$2({
  name: 'base58flickr',
  prefix: 'Z',
  alphabet: '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
});

const base32$2 = rfc4648$2({
  prefix: 'b',
  name: 'base32',
  alphabet: 'abcdefghijklmnopqrstuvwxyz234567',
  bitsPerChar: 5
});
rfc4648$2({
  prefix: 'B',
  name: 'base32upper',
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  bitsPerChar: 5
});
rfc4648$2({
  prefix: 'c',
  name: 'base32pad',
  alphabet: 'abcdefghijklmnopqrstuvwxyz234567=',
  bitsPerChar: 5
});
rfc4648$2({
  prefix: 'C',
  name: 'base32padupper',
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=',
  bitsPerChar: 5
});
rfc4648$2({
  prefix: 'v',
  name: 'base32hex',
  alphabet: '0123456789abcdefghijklmnopqrstuv',
  bitsPerChar: 5
});
rfc4648$2({
  prefix: 'V',
  name: 'base32hexupper',
  alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUV',
  bitsPerChar: 5
});
rfc4648$2({
  prefix: 't',
  name: 'base32hexpad',
  alphabet: '0123456789abcdefghijklmnopqrstuv=',
  bitsPerChar: 5
});
rfc4648$2({
  prefix: 'T',
  name: 'base32hexpadupper',
  alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUV=',
  bitsPerChar: 5
});
rfc4648$2({
  prefix: 'h',
  name: 'base32z',
  alphabet: 'ybndrfg8ejkmcpqxot1uwisza345h769',
  bitsPerChar: 5
});

let CID$2 = class CID {
  constructor(version, code, multihash, bytes) {
    this.code = code;
    this.version = version;
    this.multihash = multihash;
    this.bytes = bytes;
    this.byteOffset = bytes.byteOffset;
    this.byteLength = bytes.byteLength;
    this.asCID = this;
    this._baseCache = new Map();
    Object.defineProperties(this, {
      byteOffset: hidden,
      byteLength: hidden,
      code: readonly,
      version: readonly,
      multihash: readonly,
      bytes: readonly,
      _baseCache: hidden,
      asCID: hidden
    });
  }
  toV0() {
    switch (this.version) {
      case 0:
        {
          return this;
        }
      default:
        {
          const {
            code,
            multihash
          } = this;
          if (code !== DAG_PB_CODE$2) {
            throw new Error('Cannot convert a non dag-pb CID to CIDv0');
          }
          if (multihash.code !== SHA_256_CODE$2) {
            throw new Error('Cannot convert non sha2-256 multihash CID to CIDv0');
          }
          return CID.createV0(multihash);
        }
    }
  }
  toV1() {
    switch (this.version) {
      case 0:
        {
          const {
            code,
            digest
          } = this.multihash;
          const multihash = create$2(code, digest);
          return CID.createV1(this.code, multihash);
        }
      case 1:
        {
          return this;
        }
      default:
        {
          throw Error(`Can not convert CID version ${this.version} to version 0. This is a bug please report`);
        }
    }
  }
  equals(other) {
    return other && this.code === other.code && this.version === other.version && equals$4(this.multihash, other.multihash);
  }
  toString(base) {
    const {
      bytes,
      version,
      _baseCache
    } = this;
    switch (version) {
      case 0:
        return toStringV0$2(bytes, _baseCache, base || base58btc$2.encoder);
      default:
        return toStringV1$2(bytes, _baseCache, base || base32$2.encoder);
    }
  }
  toJSON() {
    return {
      code: this.code,
      version: this.version,
      hash: this.multihash.bytes
    };
  }
  get [Symbol.toStringTag]() {
    return 'CID';
  }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return 'CID(' + this.toString() + ')';
  }
  static isCID(value) {
    deprecate(/^0\.0/, IS_CID_DEPRECATION);
    return !!(value && (value[cidSymbol$2] || value.asCID === value));
  }
  get toBaseEncodedString() {
    throw new Error('Deprecated, use .toString()');
  }
  get codec() {
    throw new Error('"codec" property is deprecated, use integer "code" property instead');
  }
  get buffer() {
    throw new Error('Deprecated .buffer property, use .bytes to get Uint8Array instead');
  }
  get multibaseName() {
    throw new Error('"multibaseName" property is deprecated');
  }
  get prefix() {
    throw new Error('"prefix" property is deprecated');
  }
  static asCID(value) {
    if (value instanceof CID) {
      return value;
    } else if (value != null && value.asCID === value) {
      const {
        version,
        code,
        multihash,
        bytes
      } = value;
      return new CID(version, code, multihash, bytes || encodeCID$2(version, code, multihash.bytes));
    } else if (value != null && value[cidSymbol$2] === true) {
      const {
        version,
        multihash,
        code
      } = value;
      const digest = decode$c(multihash);
      return CID.create(version, code, digest);
    } else {
      return null;
    }
  }
  static create(version, code, digest) {
    if (typeof code !== 'number') {
      throw new Error('String codecs are no longer supported');
    }
    switch (version) {
      case 0:
        {
          if (code !== DAG_PB_CODE$2) {
            throw new Error(`Version 0 CID must use dag-pb (code: ${DAG_PB_CODE$2}) block encoding`);
          } else {
            return new CID(version, code, digest, digest.bytes);
          }
        }
      case 1:
        {
          const bytes = encodeCID$2(version, code, digest.bytes);
          return new CID(version, code, digest, bytes);
        }
      default:
        {
          throw new Error('Invalid version');
        }
    }
  }
  static createV0(digest) {
    return CID.create(0, DAG_PB_CODE$2, digest);
  }
  static createV1(code, digest) {
    return CID.create(1, code, digest);
  }
  static decode(bytes) {
    const [cid, remainder] = CID.decodeFirst(bytes);
    if (remainder.length) {
      throw new Error('Incorrect length');
    }
    return cid;
  }
  static decodeFirst(bytes) {
    const specs = CID.inspectBytes(bytes);
    const prefixSize = specs.size - specs.multihashSize;
    const multihashBytes = coerce$2(bytes.subarray(prefixSize, prefixSize + specs.multihashSize));
    if (multihashBytes.byteLength !== specs.multihashSize) {
      throw new Error('Incorrect length');
    }
    const digestBytes = multihashBytes.subarray(specs.multihashSize - specs.digestSize);
    const digest = new Digest$2(specs.multihashCode, specs.digestSize, digestBytes, multihashBytes);
    const cid = specs.version === 0 ? CID.createV0(digest) : CID.createV1(specs.codec, digest);
    return [cid, bytes.subarray(specs.size)];
  }
  static inspectBytes(initialBytes) {
    let offset = 0;
    const next = () => {
      const [i, length] = decode$d(initialBytes.subarray(offset));
      offset += length;
      return i;
    };
    let version = next();
    let codec = DAG_PB_CODE$2;
    if (version === 18) {
      version = 0;
      offset = 0;
    } else if (version === 1) {
      codec = next();
    }
    if (version !== 0 && version !== 1) {
      throw new RangeError(`Invalid CID version ${version}`);
    }
    const prefixSize = offset;
    const multihashCode = next();
    const digestSize = next();
    const size = offset + digestSize;
    const multihashSize = size - prefixSize;
    return {
      version,
      codec,
      multihashCode,
      digestSize,
      multihashSize,
      size
    };
  }
  static parse(source, base) {
    const [prefix, bytes] = parseCIDtoBytes$2(source, base);
    const cid = CID.decode(bytes);
    cid._baseCache.set(prefix, source);
    return cid;
  }
};
const parseCIDtoBytes$2 = (source, base) => {
  switch (source[0]) {
    case 'Q':
      {
        const decoder = base || base58btc$2;
        return [base58btc$2.prefix, decoder.decode(`${base58btc$2.prefix}${source}`)];
      }
    case base58btc$2.prefix:
      {
        const decoder = base || base58btc$2;
        return [base58btc$2.prefix, decoder.decode(source)];
      }
    case base32$2.prefix:
      {
        const decoder = base || base32$2;
        return [base32$2.prefix, decoder.decode(source)];
      }
    default:
      {
        if (base == null) {
          throw Error('To parse non base32 or base58btc encoded CID multibase decoder must be provided');
        }
        return [source[0], base.decode(source)];
      }
  }
};
const toStringV0$2 = (bytes, cache, base) => {
  const {
    prefix
  } = base;
  if (prefix !== base58btc$2.prefix) {
    throw Error(`Cannot string encode V0 in ${base.name} encoding`);
  }
  const cid = cache.get(prefix);
  if (cid == null) {
    const cid = base.encode(bytes).slice(1);
    cache.set(prefix, cid);
    return cid;
  } else {
    return cid;
  }
};
const toStringV1$2 = (bytes, cache, base) => {
  const {
    prefix
  } = base;
  const cid = cache.get(prefix);
  if (cid == null) {
    const cid = base.encode(bytes);
    cache.set(prefix, cid);
    return cid;
  } else {
    return cid;
  }
};
const DAG_PB_CODE$2 = 112;
const SHA_256_CODE$2 = 18;
const encodeCID$2 = (version, code, multihash) => {
  const codeOffset = encodingLength$2(version);
  const hashOffset = codeOffset + encodingLength$2(code);
  const bytes = new Uint8Array(hashOffset + multihash.byteLength);
  encodeTo$2(version, bytes, 0);
  encodeTo$2(code, bytes, codeOffset);
  bytes.set(multihash, hashOffset);
  return bytes;
};
const cidSymbol$2 = Symbol.for('@ipld/js-cid/CID');
const readonly = {
  writable: false,
  configurable: false,
  enumerable: true
};
const hidden = {
  writable: false,
  enumerable: false,
  configurable: false
};
const version = '0.0.0-dev';
const deprecate = (range, message) => {
  if (range.test(version)) {
    console.warn(message);
  } else {
    throw new Error(message);
  }
};
const IS_CID_DEPRECATION = `CID.isCID(v) is deprecated and will be removed in the next major release.
Following code pattern:

if (CID.isCID(value)) {
  doSomethingWithCID(value)
}

Is replaced with:

const cid = CID.asCID(value)
if (cid) {
  // Make sure to use cid instead of value
  doSomethingWithCID(cid)
}
`;

// This is an unfortunate replacement for @sindresorhus/is that we need to
// re-implement for performance purposes. In particular the is.observable()
// check is expensive, and unnecessary for our purposes. The values returned
// are compatible with @sindresorhus/is, however.

const typeofs = ['string', 'number', 'bigint', 'symbol'];
const objectTypeNames = ['Function', 'Generator', 'AsyncGenerator', 'GeneratorFunction', 'AsyncGeneratorFunction', 'AsyncFunction', 'Observable', 'Array', 'Buffer', 'Object', 'RegExp', 'Date', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Promise', 'URL', 'HTMLElement', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'];

/**
 * @param {any} value
 * @returns {string}
 */
function is(value) {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (value === true || value === false) {
    return 'boolean';
  }
  const typeOf = typeof value;
  if (typeofs.includes(typeOf)) {
    return typeOf;
  }
  /* c8 ignore next 4 */
  // not going to bother testing this, it's not going to be valid anyway
  if (typeOf === 'function') {
    return 'Function';
  }
  if (Array.isArray(value)) {
    return 'Array';
  }
  if (isBuffer$1(value)) {
    return 'Buffer';
  }
  const objectType = getObjectType(value);
  if (objectType) {
    return objectType;
  }
  /* c8 ignore next */
  return 'Object';
}

/**
 * @param {any} value
 * @returns {boolean}
 */
function isBuffer$1(value) {
  return value && value.constructor && value.constructor.isBuffer && value.constructor.isBuffer.call(null, value);
}

/**
 * @param {any} value
 * @returns {string|undefined}
 */
function getObjectType(value) {
  const objectTypeName = Object.prototype.toString.call(value).slice(8, -1);
  if (objectTypeNames.includes(objectTypeName)) {
    return objectTypeName;
  }
  /* c8 ignore next */
  return undefined;
}

class Type {
  /**
   * @param {number} major
   * @param {string} name
   * @param {boolean} terminal
   */
  constructor(major, name, terminal) {
    this.major = major;
    this.majorEncoded = major << 5;
    this.name = name;
    this.terminal = terminal;
  }

  /* c8 ignore next 3 */
  toString() {
    return `Type[${this.major}].${this.name}`;
  }

  /**
   * @param {Type} typ
   * @returns {number}
   */
  compare(typ) {
    /* c8 ignore next 1 */
    return this.major < typ.major ? -1 : this.major > typ.major ? 1 : 0;
  }
}

// convert to static fields when better supported
Type.uint = new Type(0, 'uint', true);
Type.negint = new Type(1, 'negint', true);
Type.bytes = new Type(2, 'bytes', true);
Type.string = new Type(3, 'string', true);
Type.array = new Type(4, 'array', false);
Type.map = new Type(5, 'map', false);
Type.tag = new Type(6, 'tag', false); // terminal?
Type.float = new Type(7, 'float', true);
Type.false = new Type(7, 'false', true);
Type.true = new Type(7, 'true', true);
Type.null = new Type(7, 'null', true);
Type.undefined = new Type(7, 'undefined', true);
Type.break = new Type(7, 'break', true);
// Type.indefiniteLength = new Type(0, 'indefiniteLength', true)

class Token {
  /**
   * @param {Type} type
   * @param {any} [value]
   * @param {number} [encodedLength]
   */
  constructor(type, value, encodedLength) {
    this.type = type;
    this.value = value;
    this.encodedLength = encodedLength;
    /** @type {Uint8Array|undefined} */
    this.encodedBytes = undefined;
    /** @type {Uint8Array|undefined} */
    this.byteValue = undefined;
  }

  /* c8 ignore next 3 */
  toString() {
    return `Token[${this.type}].${this.value}`;
  }
}

// Use Uint8Array directly in the browser, use Buffer in Node.js but don't
// speak its name directly to avoid bundlers pulling in the `Buffer` polyfill

// @ts-ignore
const useBuffer = globalThis.process &&
// @ts-ignore
!globalThis.process.browser &&
// @ts-ignore
globalThis.Buffer &&
// @ts-ignore
typeof globalThis.Buffer.isBuffer === 'function';
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

/**
 * @param {Uint8Array} buf
 * @returns {boolean}
 */
function isBuffer(buf) {
  // @ts-ignore
  return useBuffer && globalThis.Buffer.isBuffer(buf);
}
const toString = useBuffer ?
// eslint-disable-line operator-linebreak
/**
 * @param {Uint8Array} bytes
 * @param {number} start
 * @param {number} end
 */
(bytes, start, end) => {
  return end - start > 64 ?
  // eslint-disable-line operator-linebreak
  // @ts-ignore
  globalThis.Buffer.from(bytes.subarray(start, end)).toString('utf8') : utf8Slice(bytes, start, end);
}
/* c8 ignore next 11 */ :
// eslint-disable-line operator-linebreak
/**
 * @param {Uint8Array} bytes
 * @param {number} start
 * @param {number} end
 */
(bytes, start, end) => {
  return end - start > 64 ? textDecoder.decode(bytes.subarray(start, end)) : utf8Slice(bytes, start, end);
};
const fromString = useBuffer ?
// eslint-disable-line operator-linebreak
/**
 * @param {string} string
 */
string => {
  return string.length > 64 ?
  // eslint-disable-line operator-linebreak
  // @ts-ignore
  globalThis.Buffer.from(string) : utf8ToBytes(string);
}
/* c8 ignore next 7 */ :
// eslint-disable-line operator-linebreak
/**
 * @param {string} string
 */
string => {
  return string.length > 64 ? textEncoder.encode(string) : utf8ToBytes(string);
};
const slice = useBuffer ?
// eslint-disable-line operator-linebreak
/**
 * @param {Uint8Array} bytes
 * @param {number} start
 * @param {number} end
 */
(bytes, start, end) => {
  if (isBuffer(bytes)) {
    return new Uint8Array(bytes.subarray(start, end));
  }
  return bytes.slice(start, end);
}
/* c8 ignore next 9 */ :
// eslint-disable-line operator-linebreak
/**
 * @param {Uint8Array} bytes
 * @param {number} start
 * @param {number} end
 */
(bytes, start, end) => {
  return bytes.slice(start, end);
};

/**
 * @param {Uint8Array} b1
 * @param {Uint8Array} b2
 * @returns {number}
 */
function compare(b1, b2) {
  /* c8 ignore next 5 */
  if (isBuffer(b1) && isBuffer(b2)) {
    // probably not possible to get here in the current API
    // @ts-ignore Buffer
    return b1.compare(b2);
  }
  for (let i = 0; i < b1.length; i++) {
    if (b1[i] === b2[i]) {
      continue;
    }
    return b1[i] < b2[i] ? -1 : 1;
  } /* c8 ignore next 3 */
  return 0;
}

// The below code is taken from https://github.com/google/closure-library/blob/8598d87242af59aac233270742c8984e2b2bdbe0/closure/goog/crypt/crypt.js#L117-L143
// Licensed Apache-2.0.

/**
 * @param {string} str
 * @returns {number[]}
 */
function utf8ToBytes(str) {
  const out = [];
  let p = 0;
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 128) {
      out[p++] = c;
    } else if (c < 2048) {
      out[p++] = c >> 6 | 192;
      out[p++] = c & 63 | 128;
    } else if ((c & 0xFC00) === 0xD800 && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
      // Surrogate Pair
      c = 0x10000 + ((c & 0x03FF) << 10) + (str.charCodeAt(++i) & 0x03FF);
      out[p++] = c >> 18 | 240;
      out[p++] = c >> 12 & 63 | 128;
      out[p++] = c >> 6 & 63 | 128;
      out[p++] = c & 63 | 128;
    } else {
      out[p++] = c >> 12 | 224;
      out[p++] = c >> 6 & 63 | 128;
      out[p++] = c & 63 | 128;
    }
  }
  return out;
}

// The below code is mostly taken from https://github.com/feross/buffer
// Licensed MIT. Copyright (c) Feross Aboukhadijeh

/**
 * @param {Uint8Array} buf
 * @param {number} offset
 * @param {number} end
 * @returns {string}
 */
function utf8Slice(buf, offset, end) {
  const res = [];
  while (offset < end) {
    const firstByte = buf[offset];
    let codePoint = null;
    let bytesPerSequence = firstByte > 0xef ? 4 : firstByte > 0xdf ? 3 : firstByte > 0xbf ? 2 : 1;
    if (offset + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint;
      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte;
          }
          break;
        case 2:
          secondByte = buf[offset + 1];
          if ((secondByte & 0xc0) === 0x80) {
            tempCodePoint = (firstByte & 0x1f) << 0x6 | secondByte & 0x3f;
            if (tempCodePoint > 0x7f) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 3:
          secondByte = buf[offset + 1];
          thirdByte = buf[offset + 2];
          if ((secondByte & 0xc0) === 0x80 && (thirdByte & 0xc0) === 0x80) {
            tempCodePoint = (firstByte & 0xf) << 0xc | (secondByte & 0x3f) << 0x6 | thirdByte & 0x3f;
            /* c8 ignore next 3 */
            if (tempCodePoint > 0x7ff && (tempCodePoint < 0xd800 || tempCodePoint > 0xdfff)) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 4:
          secondByte = buf[offset + 1];
          thirdByte = buf[offset + 2];
          fourthByte = buf[offset + 3];
          if ((secondByte & 0xc0) === 0x80 && (thirdByte & 0xc0) === 0x80 && (fourthByte & 0xc0) === 0x80) {
            tempCodePoint = (firstByte & 0xf) << 0x12 | (secondByte & 0x3f) << 0xc | (thirdByte & 0x3f) << 0x6 | fourthByte & 0x3f;
            if (tempCodePoint > 0xffff && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint;
            }
          }
      }
    }

    /* c8 ignore next 5 */
    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xfffd;
      bytesPerSequence = 1;
    } else if (codePoint > 0xffff) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000;
      res.push(codePoint >>> 10 & 0x3ff | 0xd800);
      codePoint = 0xdc00 | codePoint & 0x3ff;
    }
    res.push(codePoint);
    offset += bytesPerSequence;
  }
  return decodeCodePointsArray(res);
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
const MAX_ARGUMENTS_LENGTH = 0x1000;

/**
 * @param {number[]} codePoints
 * @returns {string}
 */
function decodeCodePointsArray(codePoints) {
  const len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints); // avoid extra slice()
  }
  /* c8 ignore next 10 */
  // Decode in chunks to avoid "call stack size exceeded".
  let res = '';
  let i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH));
  }
  return res;
}

const decodeErrPrefix = 'CBOR decode error:';
const encodeErrPrefix = 'CBOR encode error:';

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} need
 */
function assertEnoughData(data, pos, need) {
  if (data.length - pos < need) {
    throw new Error(`${decodeErrPrefix} not enough data for type`);
  }
}

/* globals BigInt */

const uintBoundaries = [24, 256, 65536, 4294967296, BigInt('18446744073709551616')];

/**
 * @typedef {import('./bl.js').Bl} Bl
 * @typedef {import('../interface').DecodeOptions} DecodeOptions
 */

/**
 * @param {Uint8Array} data
 * @param {number} offset
 * @param {DecodeOptions} options
 * @returns {number}
 */
function readUint8(data, offset, options) {
  assertEnoughData(data, offset, 1);
  const value = data[offset];
  if (options.strict === true && value < uintBoundaries[0]) {
    throw new Error(`${decodeErrPrefix} integer encoded in more bytes than necessary (strict decode)`);
  }
  return value;
}

/**
 * @param {Uint8Array} data
 * @param {number} offset
 * @param {DecodeOptions} options
 * @returns {number}
 */
function readUint16(data, offset, options) {
  assertEnoughData(data, offset, 2);
  const value = data[offset] << 8 | data[offset + 1];
  if (options.strict === true && value < uintBoundaries[1]) {
    throw new Error(`${decodeErrPrefix} integer encoded in more bytes than necessary (strict decode)`);
  }
  return value;
}

/**
 * @param {Uint8Array} data
 * @param {number} offset
 * @param {DecodeOptions} options
 * @returns {number}
 */
function readUint32(data, offset, options) {
  assertEnoughData(data, offset, 4);
  const value = data[offset] * 16777216 /* 2 ** 24 */ + (data[offset + 1] << 16) + (data[offset + 2] << 8) + data[offset + 3];
  if (options.strict === true && value < uintBoundaries[2]) {
    throw new Error(`${decodeErrPrefix} integer encoded in more bytes than necessary (strict decode)`);
  }
  return value;
}

/**
 * @param {Uint8Array} data
 * @param {number} offset
 * @param {DecodeOptions} options
 * @returns {number|bigint}
 */
function readUint64(data, offset, options) {
  // assume BigInt, convert back to Number if within safe range
  assertEnoughData(data, offset, 8);
  const hi = data[offset] * 16777216 /* 2 ** 24 */ + (data[offset + 1] << 16) + (data[offset + 2] << 8) + data[offset + 3];
  const lo = data[offset + 4] * 16777216 /* 2 ** 24 */ + (data[offset + 5] << 16) + (data[offset + 6] << 8) + data[offset + 7];
  const value = (BigInt(hi) << BigInt(32)) + BigInt(lo);
  if (options.strict === true && value < uintBoundaries[3]) {
    throw new Error(`${decodeErrPrefix} integer encoded in more bytes than necessary (strict decode)`);
  }
  if (value <= Number.MAX_SAFE_INTEGER) {
    return Number(value);
  }
  if (options.allowBigInt === true) {
    return value;
  }
  throw new Error(`${decodeErrPrefix} integers outside of the safe integer range are not supported`);
}

/* not required thanks to quick[] list
const oneByteTokens = new Array(24).fill(0).map((v, i) => new Token(Type.uint, i, 1))
export function decodeUintCompact (data, pos, minor, options) {
  return oneByteTokens[minor]
}
*/

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeUint8(data, pos, _minor, options) {
  return new Token(Type.uint, readUint8(data, pos + 1, options), 2);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeUint16(data, pos, _minor, options) {
  return new Token(Type.uint, readUint16(data, pos + 1, options), 3);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeUint32(data, pos, _minor, options) {
  return new Token(Type.uint, readUint32(data, pos + 1, options), 5);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeUint64(data, pos, _minor, options) {
  return new Token(Type.uint, readUint64(data, pos + 1, options), 9);
}

/**
 * @param {Bl} buf
 * @param {Token} token
 */
function encodeUint(buf, token) {
  return encodeUintValue(buf, 0, token.value);
}

/**
 * @param {Bl} buf
 * @param {number} major
 * @param {number|bigint} uint
 */
function encodeUintValue(buf, major, uint) {
  if (uint < uintBoundaries[0]) {
    const nuint = Number(uint);
    // pack into one byte, minor=0, additional=value
    buf.push([major | nuint]);
  } else if (uint < uintBoundaries[1]) {
    const nuint = Number(uint);
    // pack into two byte, minor=0, additional=24
    buf.push([major | 24, nuint]);
  } else if (uint < uintBoundaries[2]) {
    const nuint = Number(uint);
    // pack into three byte, minor=0, additional=25
    buf.push([major | 25, nuint >>> 8, nuint & 0xff]);
  } else if (uint < uintBoundaries[3]) {
    const nuint = Number(uint);
    // pack into five byte, minor=0, additional=26
    buf.push([major | 26, nuint >>> 24 & 0xff, nuint >>> 16 & 0xff, nuint >>> 8 & 0xff, nuint & 0xff]);
  } else {
    const buint = BigInt(uint);
    if (buint < uintBoundaries[4]) {
      // pack into nine byte, minor=0, additional=27
      const set = [major | 27, 0, 0, 0, 0, 0, 0, 0];
      // simulate bitwise above 32 bits
      let lo = Number(buint & BigInt(0xffffffff));
      let hi = Number(buint >> BigInt(32) & BigInt(0xffffffff));
      set[8] = lo & 0xff;
      lo = lo >> 8;
      set[7] = lo & 0xff;
      lo = lo >> 8;
      set[6] = lo & 0xff;
      lo = lo >> 8;
      set[5] = lo & 0xff;
      set[4] = hi & 0xff;
      hi = hi >> 8;
      set[3] = hi & 0xff;
      hi = hi >> 8;
      set[2] = hi & 0xff;
      hi = hi >> 8;
      set[1] = hi & 0xff;
      buf.push(set);
    } else {
      throw new Error(`${decodeErrPrefix} encountered BigInt larger than allowable range`);
    }
  }
}

/**
 * @param {Token} token
 * @returns {number}
 */
encodeUint.encodedSize = function encodedSize(token) {
  return encodeUintValue.encodedSize(token.value);
};

/**
 * @param {number} uint
 * @returns {number}
 */
encodeUintValue.encodedSize = function encodedSize(uint) {
  if (uint < uintBoundaries[0]) {
    return 1;
  }
  if (uint < uintBoundaries[1]) {
    return 2;
  }
  if (uint < uintBoundaries[2]) {
    return 3;
  }
  if (uint < uintBoundaries[3]) {
    return 5;
  }
  return 9;
};

/**
 * @param {Token} tok1
 * @param {Token} tok2
 * @returns {number}
 */
encodeUint.compareTokens = function compareTokens(tok1, tok2) {
  return tok1.value < tok2.value ? -1 : tok1.value > tok2.value ? 1 : /* c8 ignore next */0;
};

/* eslint-env es2020 */


/**
 * @typedef {import('./bl.js').Bl} Bl
 * @typedef {import('../interface').DecodeOptions} DecodeOptions
 */

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeNegint8(data, pos, _minor, options) {
  return new Token(Type.negint, -1 - readUint8(data, pos + 1, options), 2);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeNegint16(data, pos, _minor, options) {
  return new Token(Type.negint, -1 - readUint16(data, pos + 1, options), 3);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeNegint32(data, pos, _minor, options) {
  return new Token(Type.negint, -1 - readUint32(data, pos + 1, options), 5);
}
const neg1b = BigInt(-1);
const pos1b = BigInt(1);

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeNegint64(data, pos, _minor, options) {
  const int = readUint64(data, pos + 1, options);
  if (typeof int !== 'bigint') {
    const value = -1 - int;
    if (value >= Number.MIN_SAFE_INTEGER) {
      return new Token(Type.negint, value, 9);
    }
  }
  if (options.allowBigInt !== true) {
    throw new Error(`${decodeErrPrefix} integers outside of the safe integer range are not supported`);
  }
  return new Token(Type.negint, neg1b - BigInt(int), 9);
}

/**
 * @param {Bl} buf
 * @param {Token} token
 */
function encodeNegint(buf, token) {
  const negint = token.value;
  const unsigned = typeof negint === 'bigint' ? negint * neg1b - pos1b : negint * -1 - 1;
  encodeUintValue(buf, token.type.majorEncoded, unsigned);
}

/**
 * @param {Token} token
 * @returns {number}
 */
encodeNegint.encodedSize = function encodedSize(token) {
  const negint = token.value;
  const unsigned = typeof negint === 'bigint' ? negint * neg1b - pos1b : negint * -1 - 1;
  /* c8 ignore next 4 */
  // handled by quickEncode, we shouldn't get here but it's included for completeness
  if (unsigned < uintBoundaries[0]) {
    return 1;
  }
  if (unsigned < uintBoundaries[1]) {
    return 2;
  }
  if (unsigned < uintBoundaries[2]) {
    return 3;
  }
  if (unsigned < uintBoundaries[3]) {
    return 5;
  }
  return 9;
};

/**
 * @param {Token} tok1
 * @param {Token} tok2
 * @returns {number}
 */
encodeNegint.compareTokens = function compareTokens(tok1, tok2) {
  // opposite of the uint comparison since we store the uint version in bytes
  return tok1.value < tok2.value ? 1 : tok1.value > tok2.value ? -1 : /* c8 ignore next */0;
};

/**
 * @typedef {import('./bl.js').Bl} Bl
 * @typedef {import('../interface').DecodeOptions} DecodeOptions
 */

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} prefix
 * @param {number} length
 * @returns {Token}
 */
function toToken$3(data, pos, prefix, length) {
  assertEnoughData(data, pos, prefix + length);
  const buf = slice(data, pos + prefix, pos + prefix + length);
  return new Token(Type.bytes, buf, prefix + length);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} minor
 * @param {DecodeOptions} _options
 * @returns {Token}
 */
function decodeBytesCompact(data, pos, minor, _options) {
  return toToken$3(data, pos, 1, minor);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeBytes8(data, pos, _minor, options) {
  return toToken$3(data, pos, 2, readUint8(data, pos + 1, options));
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeBytes16(data, pos, _minor, options) {
  return toToken$3(data, pos, 3, readUint16(data, pos + 1, options));
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeBytes32(data, pos, _minor, options) {
  return toToken$3(data, pos, 5, readUint32(data, pos + 1, options));
}

// TODO: maybe we shouldn't support this ..
/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeBytes64(data, pos, _minor, options) {
  const l = readUint64(data, pos + 1, options);
  if (typeof l === 'bigint') {
    throw new Error(`${decodeErrPrefix} 64-bit integer bytes lengths not supported`);
  }
  return toToken$3(data, pos, 9, l);
}

/**
 * `encodedBytes` allows for caching when we do a byte version of a string
 * for key sorting purposes
 * @param {Token} token
 * @returns {Uint8Array}
 */
function tokenBytes(token) {
  if (token.encodedBytes === undefined) {
    token.encodedBytes = token.type === Type.string ? fromString(token.value) : token.value;
  }
  // @ts-ignore c'mon
  return token.encodedBytes;
}

/**
 * @param {Bl} buf
 * @param {Token} token
 */
function encodeBytes(buf, token) {
  const bytes = tokenBytes(token);
  encodeUintValue(buf, token.type.majorEncoded, bytes.length);
  buf.push(bytes);
}

/**
 * @param {Token} token
 * @returns {number}
 */
encodeBytes.encodedSize = function encodedSize(token) {
  const bytes = tokenBytes(token);
  return encodeUintValue.encodedSize(bytes.length) + bytes.length;
};

/**
 * @param {Token} tok1
 * @param {Token} tok2
 * @returns {number}
 */
encodeBytes.compareTokens = function compareTokens(tok1, tok2) {
  return compareBytes(tokenBytes(tok1), tokenBytes(tok2));
};

/**
 * @param {Uint8Array} b1
 * @param {Uint8Array} b2
 * @returns {number}
 */
function compareBytes(b1, b2) {
  return b1.length < b2.length ? -1 : b1.length > b2.length ? 1 : compare(b1, b2);
}

/**
 * @typedef {import('./bl.js').Bl} Bl
 * @typedef {import('../interface').DecodeOptions} DecodeOptions
 */

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} prefix
 * @param {number} length
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function toToken$2(data, pos, prefix, length, options) {
  const totLength = prefix + length;
  assertEnoughData(data, pos, totLength);
  const tok = new Token(Type.string, toString(data, pos + prefix, pos + totLength), totLength);
  if (options.retainStringBytes === true) {
    tok.byteValue = slice(data, pos + prefix, pos + totLength);
  }
  return tok;
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeStringCompact(data, pos, minor, options) {
  return toToken$2(data, pos, 1, minor, options);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeString8(data, pos, _minor, options) {
  return toToken$2(data, pos, 2, readUint8(data, pos + 1, options), options);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeString16(data, pos, _minor, options) {
  return toToken$2(data, pos, 3, readUint16(data, pos + 1, options), options);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeString32(data, pos, _minor, options) {
  return toToken$2(data, pos, 5, readUint32(data, pos + 1, options), options);
}

// TODO: maybe we shouldn't support this ..
/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeString64(data, pos, _minor, options) {
  const l = readUint64(data, pos + 1, options);
  if (typeof l === 'bigint') {
    throw new Error(`${decodeErrPrefix} 64-bit integer string lengths not supported`);
  }
  return toToken$2(data, pos, 9, l, options);
}
const encodeString = encodeBytes;

/**
 * @typedef {import('./bl.js').Bl} Bl
 * @typedef {import('../interface').DecodeOptions} DecodeOptions
 */

/**
 * @param {Uint8Array} _data
 * @param {number} _pos
 * @param {number} prefix
 * @param {number} length
 * @returns {Token}
 */
function toToken$1(_data, _pos, prefix, length) {
  return new Token(Type.array, length, prefix);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} minor
 * @param {DecodeOptions} _options
 * @returns {Token}
 */
function decodeArrayCompact(data, pos, minor, _options) {
  return toToken$1(data, pos, 1, minor);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeArray8(data, pos, _minor, options) {
  return toToken$1(data, pos, 2, readUint8(data, pos + 1, options));
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeArray16(data, pos, _minor, options) {
  return toToken$1(data, pos, 3, readUint16(data, pos + 1, options));
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeArray32(data, pos, _minor, options) {
  return toToken$1(data, pos, 5, readUint32(data, pos + 1, options));
}

// TODO: maybe we shouldn't support this ..
/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeArray64(data, pos, _minor, options) {
  const l = readUint64(data, pos + 1, options);
  if (typeof l === 'bigint') {
    throw new Error(`${decodeErrPrefix} 64-bit integer array lengths not supported`);
  }
  return toToken$1(data, pos, 9, l);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeArrayIndefinite(data, pos, _minor, options) {
  if (options.allowIndefinite === false) {
    throw new Error(`${decodeErrPrefix} indefinite length items not allowed`);
  }
  return toToken$1(data, pos, 1, Infinity);
}

/**
 * @param {Bl} buf
 * @param {Token} token
 */
function encodeArray(buf, token) {
  encodeUintValue(buf, Type.array.majorEncoded, token.value);
}

// using an array as a map key, are you sure about this? we can only sort
// by map length here, it's up to the encoder to decide to look deeper
encodeArray.compareTokens = encodeUint.compareTokens;

/**
 * @param {Token} token
 * @returns {number}
 */
encodeArray.encodedSize = function encodedSize(token) {
  return encodeUintValue.encodedSize(token.value);
};

/**
 * @typedef {import('./bl.js').Bl} Bl
 * @typedef {import('../interface').DecodeOptions} DecodeOptions
 */

/**
 * @param {Uint8Array} _data
 * @param {number} _pos
 * @param {number} prefix
 * @param {number} length
 * @returns {Token}
 */
function toToken(_data, _pos, prefix, length) {
  return new Token(Type.map, length, prefix);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} minor
 * @param {DecodeOptions} _options
 * @returns {Token}
 */
function decodeMapCompact(data, pos, minor, _options) {
  return toToken(data, pos, 1, minor);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeMap8(data, pos, _minor, options) {
  return toToken(data, pos, 2, readUint8(data, pos + 1, options));
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeMap16(data, pos, _minor, options) {
  return toToken(data, pos, 3, readUint16(data, pos + 1, options));
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeMap32(data, pos, _minor, options) {
  return toToken(data, pos, 5, readUint32(data, pos + 1, options));
}

// TODO: maybe we shouldn't support this ..
/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeMap64(data, pos, _minor, options) {
  const l = readUint64(data, pos + 1, options);
  if (typeof l === 'bigint') {
    throw new Error(`${decodeErrPrefix} 64-bit integer map lengths not supported`);
  }
  return toToken(data, pos, 9, l);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeMapIndefinite(data, pos, _minor, options) {
  if (options.allowIndefinite === false) {
    throw new Error(`${decodeErrPrefix} indefinite length items not allowed`);
  }
  return toToken(data, pos, 1, Infinity);
}

/**
 * @param {Bl} buf
 * @param {Token} token
 */
function encodeMap(buf, token) {
  encodeUintValue(buf, Type.map.majorEncoded, token.value);
}

// using a map as a map key, are you sure about this? we can only sort
// by map length here, it's up to the encoder to decide to look deeper
encodeMap.compareTokens = encodeUint.compareTokens;

/**
 * @param {Token} token
 * @returns {number}
 */
encodeMap.encodedSize = function encodedSize(token) {
  return encodeUintValue.encodedSize(token.value);
};

/**
 * @typedef {import('./bl.js').Bl} Bl
 * @typedef {import('../interface').DecodeOptions} DecodeOptions
 */

/**
 * @param {Uint8Array} _data
 * @param {number} _pos
 * @param {number} minor
 * @param {DecodeOptions} _options
 * @returns {Token}
 */
function decodeTagCompact(_data, _pos, minor, _options) {
  return new Token(Type.tag, minor, 1);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeTag8(data, pos, _minor, options) {
  return new Token(Type.tag, readUint8(data, pos + 1, options), 2);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeTag16(data, pos, _minor, options) {
  return new Token(Type.tag, readUint16(data, pos + 1, options), 3);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeTag32(data, pos, _minor, options) {
  return new Token(Type.tag, readUint32(data, pos + 1, options), 5);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeTag64(data, pos, _minor, options) {
  return new Token(Type.tag, readUint64(data, pos + 1, options), 9);
}

/**
 * @param {Bl} buf
 * @param {Token} token
 */
function encodeTag(buf, token) {
  encodeUintValue(buf, Type.tag.majorEncoded, token.value);
}
encodeTag.compareTokens = encodeUint.compareTokens;

/**
 * @param {Token} token
 * @returns {number}
 */
encodeTag.encodedSize = function encodedSize(token) {
  return encodeUintValue.encodedSize(token.value);
};

// TODO: shift some of the bytes logic to bytes-utils so we can use Buffer
// where possible


/**
 * @typedef {import('./bl.js').Bl} Bl
 * @typedef {import('../interface').DecodeOptions} DecodeOptions
 * @typedef {import('../interface').EncodeOptions} EncodeOptions
 */

const MINOR_FALSE = 20;
const MINOR_TRUE = 21;
const MINOR_NULL = 22;
const MINOR_UNDEFINED = 23;

/**
 * @param {Uint8Array} _data
 * @param {number} _pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeUndefined(_data, _pos, _minor, options) {
  if (options.allowUndefined === false) {
    throw new Error(`${decodeErrPrefix} undefined values are not supported`);
  } else if (options.coerceUndefinedToNull === true) {
    return new Token(Type.null, null, 1);
  }
  return new Token(Type.undefined, undefined, 1);
}

/**
 * @param {Uint8Array} _data
 * @param {number} _pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeBreak(_data, _pos, _minor, options) {
  if (options.allowIndefinite === false) {
    throw new Error(`${decodeErrPrefix} indefinite length items not allowed`);
  }
  return new Token(Type.break, undefined, 1);
}

/**
 * @param {number} value
 * @param {number} bytes
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function createToken(value, bytes, options) {
  if (options) {
    if (options.allowNaN === false && Number.isNaN(value)) {
      throw new Error(`${decodeErrPrefix} NaN values are not supported`);
    }
    if (options.allowInfinity === false && (value === Infinity || value === -Infinity)) {
      throw new Error(`${decodeErrPrefix} Infinity values are not supported`);
    }
  }
  return new Token(Type.float, value, bytes);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeFloat16(data, pos, _minor, options) {
  return createToken(readFloat16(data, pos + 1), 3, options);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeFloat32(data, pos, _minor, options) {
  return createToken(readFloat32(data, pos + 1), 5, options);
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
function decodeFloat64(data, pos, _minor, options) {
  return createToken(readFloat64(data, pos + 1), 9, options);
}

/**
 * @param {Bl} buf
 * @param {Token} token
 * @param {EncodeOptions} options
 */
function encodeFloat(buf, token, options) {
  const float = token.value;
  if (float === false) {
    buf.push([Type.float.majorEncoded | MINOR_FALSE]);
  } else if (float === true) {
    buf.push([Type.float.majorEncoded | MINOR_TRUE]);
  } else if (float === null) {
    buf.push([Type.float.majorEncoded | MINOR_NULL]);
  } else if (float === undefined) {
    buf.push([Type.float.majorEncoded | MINOR_UNDEFINED]);
  } else {
    let decoded;
    let success = false;
    if (!options || options.float64 !== true) {
      encodeFloat16(float);
      decoded = readFloat16(ui8a, 1);
      if (float === decoded || Number.isNaN(float)) {
        ui8a[0] = 0xf9;
        buf.push(ui8a.slice(0, 3));
        success = true;
      } else {
        encodeFloat32(float);
        decoded = readFloat32(ui8a, 1);
        if (float === decoded) {
          ui8a[0] = 0xfa;
          buf.push(ui8a.slice(0, 5));
          success = true;
        }
      }
    }
    if (!success) {
      encodeFloat64(float);
      decoded = readFloat64(ui8a, 1);
      ui8a[0] = 0xfb;
      buf.push(ui8a.slice(0, 9));
    }
  }
}

/**
 * @param {Token} token
 * @param {EncodeOptions} options
 * @returns {number}
 */
encodeFloat.encodedSize = function encodedSize(token, options) {
  const float = token.value;
  if (float === false || float === true || float === null || float === undefined) {
    return 1;
  }
  if (!options || options.float64 !== true) {
    encodeFloat16(float);
    let decoded = readFloat16(ui8a, 1);
    if (float === decoded || Number.isNaN(float)) {
      return 3;
    }
    encodeFloat32(float);
    decoded = readFloat32(ui8a, 1);
    if (float === decoded) {
      return 5;
    }
  }
  return 9;
};
const buffer = new ArrayBuffer(9);
const dataView = new DataView(buffer, 1);
const ui8a = new Uint8Array(buffer, 0);

/**
 * @param {number} inp
 */
function encodeFloat16(inp) {
  if (inp === Infinity) {
    dataView.setUint16(0, 0x7c00, false);
  } else if (inp === -Infinity) {
    dataView.setUint16(0, 0xfc00, false);
  } else if (Number.isNaN(inp)) {
    dataView.setUint16(0, 0x7e00, false);
  } else {
    dataView.setFloat32(0, inp);
    const valu32 = dataView.getUint32(0);
    const exponent = (valu32 & 0x7f800000) >> 23;
    const mantissa = valu32 & 0x7fffff;

    /* c8 ignore next 6 */
    if (exponent === 0xff) {
      // too big, Infinity, but this should be hard (impossible?) to trigger
      dataView.setUint16(0, 0x7c00, false);
    } else if (exponent === 0x00) {
      // 0.0, -0.0 and subnormals, shouldn't be possible to get here because 0.0 should be counted as an int
      dataView.setUint16(0, (inp & 0x80000000) >> 16 | mantissa >> 13, false);
    } else {
      // standard numbers
      // chunks of logic here borrowed from https://github.com/PJK/libcbor/blob/c78f437182533e3efa8d963ff4b945bb635c2284/src/cbor/encoding.c#L127
      const logicalExponent = exponent - 127;
      // Now we know that 2^exponent <= 0 logically
      /* c8 ignore next 6 */
      if (logicalExponent < -24) {
        /* No unambiguous representation exists, this float is not a half float
          and is too small to be represented using a half, round off to zero.
          Consistent with the reference implementation. */
        // should be difficult (impossible?) to get here in JS
        dataView.setUint16(0, 0);
      } else if (logicalExponent < -14) {
        /* Offset the remaining decimal places by shifting the significand, the
          value is lost. This is an implementation decision that works around the
          absence of standard half-float in the language. */
        dataView.setUint16(0, (valu32 & 0x80000000) >> 16 | (/* sign bit */1 << 24 + logicalExponent), false);
      } else {
        dataView.setUint16(0, (valu32 & 0x80000000) >> 16 | logicalExponent + 15 << 10 | mantissa >> 13, false);
      }
    }
  }
}

/**
 * @param {Uint8Array} ui8a
 * @param {number} pos
 * @returns {number}
 */
function readFloat16(ui8a, pos) {
  if (ui8a.length - pos < 2) {
    throw new Error(`${decodeErrPrefix} not enough data for float16`);
  }
  const half = (ui8a[pos] << 8) + ui8a[pos + 1];
  if (half === 0x7c00) {
    return Infinity;
  }
  if (half === 0xfc00) {
    return -Infinity;
  }
  if (half === 0x7e00) {
    return NaN;
  }
  const exp = half >> 10 & 0x1f;
  const mant = half & 0x3ff;
  let val;
  if (exp === 0) {
    val = mant * 2 ** -24;
  } else if (exp !== 31) {
    val = (mant + 1024) * 2 ** (exp - 25);
    /* c8 ignore next 4 */
  } else {
    // may not be possible to get here
    val = mant === 0 ? Infinity : NaN;
  }
  return half & 0x8000 ? -val : val;
}

/**
 * @param {number} inp
 */
function encodeFloat32(inp) {
  dataView.setFloat32(0, inp, false);
}

/**
 * @param {Uint8Array} ui8a
 * @param {number} pos
 * @returns {number}
 */
function readFloat32(ui8a, pos) {
  if (ui8a.length - pos < 4) {
    throw new Error(`${decodeErrPrefix} not enough data for float32`);
  }
  const offset = (ui8a.byteOffset || 0) + pos;
  return new DataView(ui8a.buffer, offset, 4).getFloat32(0, false);
}

/**
 * @param {number} inp
 */
function encodeFloat64(inp) {
  dataView.setFloat64(0, inp, false);
}

/**
 * @param {Uint8Array} ui8a
 * @param {number} pos
 * @returns {number}
 */
function readFloat64(ui8a, pos) {
  if (ui8a.length - pos < 8) {
    throw new Error(`${decodeErrPrefix} not enough data for float64`);
  }
  const offset = (ui8a.byteOffset || 0) + pos;
  return new DataView(ui8a.buffer, offset, 8).getFloat64(0, false);
}

/**
 * @param {Token} _tok1
 * @param {Token} _tok2
 * @returns {number}
 */
encodeFloat.compareTokens = encodeUint.compareTokens;
/*
encodeFloat.compareTokens = function compareTokens (_tok1, _tok2) {
  return _tok1
  throw new Error(`${encodeErrPrefix} cannot use floats as map keys`)
}
*/

/**
 * @typedef {import('../interface').DecodeOptions} DecodeOptions
 */

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} minor
 */
function invalidMinor(data, pos, minor) {
  throw new Error(`${decodeErrPrefix} encountered invalid minor (${minor}) for major ${data[pos] >>> 5}`);
}

/**
 * @param {string} msg
 * @returns {()=>any}
 */
function errorer(msg) {
  return () => {
    throw new Error(`${decodeErrPrefix} ${msg}`);
  };
}

/** @type {((data:Uint8Array, pos:number, minor:number, options?:DecodeOptions) => any)[]} */
const jump = [];

// unsigned integer, 0x00..0x17 (0..23)
for (let i = 0; i <= 0x17; i++) {
  jump[i] = invalidMinor; // uint.decodeUintCompact, handled by quick[]
}
jump[0x18] = decodeUint8; // unsigned integer, one-byte uint8_t follows
jump[0x19] = decodeUint16; // unsigned integer, two-byte uint16_t follows
jump[0x1a] = decodeUint32; // unsigned integer, four-byte uint32_t follows
jump[0x1b] = decodeUint64; // unsigned integer, eight-byte uint64_t follows
jump[0x1c] = invalidMinor;
jump[0x1d] = invalidMinor;
jump[0x1e] = invalidMinor;
jump[0x1f] = invalidMinor;
// negative integer, -1-0x00..-1-0x17 (-1..-24)
for (let i = 0x20; i <= 0x37; i++) {
  jump[i] = invalidMinor; // negintDecode, handled by quick[]
}
jump[0x38] = decodeNegint8; // negative integer, -1-n one-byte uint8_t for n follows
jump[0x39] = decodeNegint16; // negative integer, -1-n two-byte uint16_t for n follows
jump[0x3a] = decodeNegint32; // negative integer, -1-n four-byte uint32_t for follows
jump[0x3b] = decodeNegint64; // negative integer, -1-n eight-byte uint64_t for follows
jump[0x3c] = invalidMinor;
jump[0x3d] = invalidMinor;
jump[0x3e] = invalidMinor;
jump[0x3f] = invalidMinor;
// byte string, 0x00..0x17 bytes follow
for (let i = 0x40; i <= 0x57; i++) {
  jump[i] = decodeBytesCompact;
}
jump[0x58] = decodeBytes8; // byte string, one-byte uint8_t for n, and then n bytes follow
jump[0x59] = decodeBytes16; // byte string, two-byte uint16_t for n, and then n bytes follow
jump[0x5a] = decodeBytes32; // byte string, four-byte uint32_t for n, and then n bytes follow
jump[0x5b] = decodeBytes64; // byte string, eight-byte uint64_t for n, and then n bytes follow
jump[0x5c] = invalidMinor;
jump[0x5d] = invalidMinor;
jump[0x5e] = invalidMinor;
jump[0x5f] = errorer('indefinite length bytes/strings are not supported'); // byte string, byte strings follow, terminated by "break"
// UTF-8 string 0x00..0x17 bytes follow
for (let i = 0x60; i <= 0x77; i++) {
  jump[i] = decodeStringCompact;
}
jump[0x78] = decodeString8; // UTF-8 string, one-byte uint8_t for n, and then n bytes follow
jump[0x79] = decodeString16; // UTF-8 string, two-byte uint16_t for n, and then n bytes follow
jump[0x7a] = decodeString32; // UTF-8 string, four-byte uint32_t for n, and then n bytes follow
jump[0x7b] = decodeString64; // UTF-8 string, eight-byte uint64_t for n, and then n bytes follow
jump[0x7c] = invalidMinor;
jump[0x7d] = invalidMinor;
jump[0x7e] = invalidMinor;
jump[0x7f] = errorer('indefinite length bytes/strings are not supported'); // UTF-8 strings follow, terminated by "break"
// array, 0x00..0x17 data items follow
for (let i = 0x80; i <= 0x97; i++) {
  jump[i] = decodeArrayCompact;
}
jump[0x98] = decodeArray8; // array, one-byte uint8_t for n, and then n data items follow
jump[0x99] = decodeArray16; // array, two-byte uint16_t for n, and then n data items follow
jump[0x9a] = decodeArray32; // array, four-byte uint32_t for n, and then n data items follow
jump[0x9b] = decodeArray64; // array, eight-byte uint64_t for n, and then n data items follow
jump[0x9c] = invalidMinor;
jump[0x9d] = invalidMinor;
jump[0x9e] = invalidMinor;
jump[0x9f] = decodeArrayIndefinite; // array, data items follow, terminated by "break"
// map, 0x00..0x17 pairs of data items follow
for (let i = 0xa0; i <= 0xb7; i++) {
  jump[i] = decodeMapCompact;
}
jump[0xb8] = decodeMap8; // map, one-byte uint8_t for n, and then n pairs of data items follow
jump[0xb9] = decodeMap16; // map, two-byte uint16_t for n, and then n pairs of data items follow
jump[0xba] = decodeMap32; // map, four-byte uint32_t for n, and then n pairs of data items follow
jump[0xbb] = decodeMap64; // map, eight-byte uint64_t for n, and then n pairs of data items follow
jump[0xbc] = invalidMinor;
jump[0xbd] = invalidMinor;
jump[0xbe] = invalidMinor;
jump[0xbf] = decodeMapIndefinite; // map, pairs of data items follow, terminated by "break"
// tags
for (let i = 0xc0; i <= 0xd7; i++) {
  jump[i] = decodeTagCompact;
}
jump[0xd8] = decodeTag8;
jump[0xd9] = decodeTag16;
jump[0xda] = decodeTag32;
jump[0xdb] = decodeTag64;
jump[0xdc] = invalidMinor;
jump[0xdd] = invalidMinor;
jump[0xde] = invalidMinor;
jump[0xdf] = invalidMinor;
// 0xe0..0xf3 simple values, unsupported
for (let i = 0xe0; i <= 0xf3; i++) {
  jump[i] = errorer('simple values are not supported');
}
jump[0xf4] = invalidMinor; // false, handled by quick[]
jump[0xf5] = invalidMinor; // true, handled by quick[]
jump[0xf6] = invalidMinor; // null, handled by quick[]
jump[0xf7] = decodeUndefined; // undefined
jump[0xf8] = errorer('simple values are not supported'); // simple value, one byte follows, unsupported
jump[0xf9] = decodeFloat16; // half-precision float (two-byte IEEE 754)
jump[0xfa] = decodeFloat32; // single-precision float (four-byte IEEE 754)
jump[0xfb] = decodeFloat64; // double-precision float (eight-byte IEEE 754)
jump[0xfc] = invalidMinor;
jump[0xfd] = invalidMinor;
jump[0xfe] = invalidMinor;
jump[0xff] = decodeBreak; // "break" stop code

/** @type {Token[]} */
const quick = [];
// ints <24
for (let i = 0; i < 24; i++) {
  quick[i] = new Token(Type.uint, i, 1);
}
// negints >= -24
for (let i = -1; i >= -24; i--) {
  quick[31 - i] = new Token(Type.negint, i, 1);
}
// empty bytes
quick[0x40] = new Token(Type.bytes, new Uint8Array(0), 1);
// empty string
quick[0x60] = new Token(Type.string, '', 1);
// empty list
quick[0x80] = new Token(Type.array, 0, 1);
// empty map
quick[0xa0] = new Token(Type.map, 0, 1);
// false
quick[0xf4] = new Token(Type.false, false, 1);
// true
quick[0xf5] = new Token(Type.true, true, 1);
// null
quick[0xf6] = new Token(Type.null, null, 1);

/** @returns {TokenTypeEncoder[]} */
function makeCborEncoders() {
  const encoders = [];
  encoders[Type.uint.major] = encodeUint;
  encoders[Type.negint.major] = encodeNegint;
  encoders[Type.bytes.major] = encodeBytes;
  encoders[Type.string.major] = encodeString;
  encoders[Type.array.major] = encodeArray;
  encoders[Type.map.major] = encodeMap;
  encoders[Type.tag.major] = encodeTag;
  encoders[Type.float.major] = encodeFloat;
  return encoders;
}
makeCborEncoders();

/** @implements {Reference} */
class Ref {
  /**
   * @param {object|any[]} obj
   * @param {Reference|undefined} parent
   */
  constructor(obj, parent) {
    this.obj = obj;
    this.parent = parent;
  }

  /**
   * @param {object|any[]} obj
   * @returns {boolean}
   */
  includes(obj) {
    /** @type {Reference|undefined} */
    let p = this;
    do {
      if (p.obj === obj) {
        return true;
      }
    } while (p = p.parent); // eslint-disable-line
    return false;
  }

  /**
   * @param {Reference|undefined} stack
   * @param {object|any[]} obj
   * @returns {Reference}
   */
  static createCheck(stack, obj) {
    if (stack && stack.includes(obj)) {
      throw new Error(`${encodeErrPrefix} object contains circular references`);
    }
    return new Ref(obj, stack);
  }
}
const simpleTokens = {
  null: new Token(Type.null, null),
  undefined: new Token(Type.undefined, undefined),
  true: new Token(Type.true, true),
  false: new Token(Type.false, false),
  emptyArray: new Token(Type.array, 0),
  emptyMap: new Token(Type.map, 0)
};

/** @type {{[typeName: string]: StrictTypeEncoder}} */
const typeEncoders = {
  /**
   * @param {any} obj
   * @param {string} _typ
   * @param {EncodeOptions} _options
   * @param {Reference} [_refStack]
   * @returns {TokenOrNestedTokens}
   */
  number(obj, _typ, _options, _refStack) {
    if (!Number.isInteger(obj) || !Number.isSafeInteger(obj)) {
      return new Token(Type.float, obj);
    } else if (obj >= 0) {
      return new Token(Type.uint, obj);
    } else {
      return new Token(Type.negint, obj);
    }
  },
  /**
   * @param {any} obj
   * @param {string} _typ
   * @param {EncodeOptions} _options
   * @param {Reference} [_refStack]
   * @returns {TokenOrNestedTokens}
   */
  bigint(obj, _typ, _options, _refStack) {
    if (obj >= BigInt(0)) {
      return new Token(Type.uint, obj);
    } else {
      return new Token(Type.negint, obj);
    }
  },
  /**
   * @param {any} obj
   * @param {string} _typ
   * @param {EncodeOptions} _options
   * @param {Reference} [_refStack]
   * @returns {TokenOrNestedTokens}
   */
  Uint8Array(obj, _typ, _options, _refStack) {
    return new Token(Type.bytes, obj);
  },
  /**
   * @param {any} obj
   * @param {string} _typ
   * @param {EncodeOptions} _options
   * @param {Reference} [_refStack]
   * @returns {TokenOrNestedTokens}
   */
  string(obj, _typ, _options, _refStack) {
    return new Token(Type.string, obj);
  },
  /**
   * @param {any} obj
   * @param {string} _typ
   * @param {EncodeOptions} _options
   * @param {Reference} [_refStack]
   * @returns {TokenOrNestedTokens}
   */
  boolean(obj, _typ, _options, _refStack) {
    return obj ? simpleTokens.true : simpleTokens.false;
  },
  /**
   * @param {any} _obj
   * @param {string} _typ
   * @param {EncodeOptions} _options
   * @param {Reference} [_refStack]
   * @returns {TokenOrNestedTokens}
   */
  null(_obj, _typ, _options, _refStack) {
    return simpleTokens.null;
  },
  /**
   * @param {any} _obj
   * @param {string} _typ
   * @param {EncodeOptions} _options
   * @param {Reference} [_refStack]
   * @returns {TokenOrNestedTokens}
   */
  undefined(_obj, _typ, _options, _refStack) {
    return simpleTokens.undefined;
  },
  /**
   * @param {any} obj
   * @param {string} _typ
   * @param {EncodeOptions} _options
   * @param {Reference} [_refStack]
   * @returns {TokenOrNestedTokens}
   */
  ArrayBuffer(obj, _typ, _options, _refStack) {
    return new Token(Type.bytes, new Uint8Array(obj));
  },
  /**
   * @param {any} obj
   * @param {string} _typ
   * @param {EncodeOptions} _options
   * @param {Reference} [_refStack]
   * @returns {TokenOrNestedTokens}
   */
  DataView(obj, _typ, _options, _refStack) {
    return new Token(Type.bytes, new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength));
  },
  /**
   * @param {any} obj
   * @param {string} _typ
   * @param {EncodeOptions} options
   * @param {Reference} [refStack]
   * @returns {TokenOrNestedTokens}
   */
  Array(obj, _typ, options, refStack) {
    if (!obj.length) {
      if (options.addBreakTokens === true) {
        return [simpleTokens.emptyArray, new Token(Type.break)];
      }
      return simpleTokens.emptyArray;
    }
    refStack = Ref.createCheck(refStack, obj);
    const entries = [];
    let i = 0;
    for (const e of obj) {
      entries[i++] = objectToTokens(e, options, refStack);
    }
    if (options.addBreakTokens) {
      return [new Token(Type.array, obj.length), entries, new Token(Type.break)];
    }
    return [new Token(Type.array, obj.length), entries];
  },
  /**
   * @param {any} obj
   * @param {string} typ
   * @param {EncodeOptions} options
   * @param {Reference} [refStack]
   * @returns {TokenOrNestedTokens}
   */
  Object(obj, typ, options, refStack) {
    // could be an Object or a Map
    const isMap = typ !== 'Object';
    // it's slightly quicker to use Object.keys() than Object.entries()
    const keys = isMap ? obj.keys() : Object.keys(obj);
    const length = isMap ? obj.size : keys.length;
    if (!length) {
      if (options.addBreakTokens === true) {
        return [simpleTokens.emptyMap, new Token(Type.break)];
      }
      return simpleTokens.emptyMap;
    }
    refStack = Ref.createCheck(refStack, obj);
    /** @type {TokenOrNestedTokens[]} */
    const entries = [];
    let i = 0;
    for (const key of keys) {
      entries[i++] = [objectToTokens(key, options, refStack), objectToTokens(isMap ? obj.get(key) : obj[key], options, refStack)];
    }
    sortMapEntries(entries, options);
    if (options.addBreakTokens) {
      return [new Token(Type.map, length), entries, new Token(Type.break)];
    }
    return [new Token(Type.map, length), entries];
  }
};
typeEncoders.Map = typeEncoders.Object;
typeEncoders.Buffer = typeEncoders.Uint8Array;
for (const typ of 'Uint8Clamped Uint16 Uint32 Int8 Int16 Int32 BigUint64 BigInt64 Float32 Float64'.split(' ')) {
  typeEncoders[`${typ}Array`] = typeEncoders.DataView;
}

/**
 * @param {any} obj
 * @param {EncodeOptions} [options]
 * @param {Reference} [refStack]
 * @returns {TokenOrNestedTokens}
 */
function objectToTokens(obj, options = {}, refStack) {
  const typ = is(obj);
  const customTypeEncoder = options && options.typeEncoders && /** @type {OptionalTypeEncoder} */options.typeEncoders[typ] || typeEncoders[typ];
  if (typeof customTypeEncoder === 'function') {
    const tokens = customTypeEncoder(obj, typ, options, refStack);
    if (tokens != null) {
      return tokens;
    }
  }
  const typeEncoder = typeEncoders[typ];
  if (!typeEncoder) {
    throw new Error(`${encodeErrPrefix} unsupported type: ${typ}`);
  }
  return typeEncoder(obj, typ, options, refStack);
}

/*
CBOR key sorting is a mess.

The canonicalisation recommendation from https://tools.ietf.org/html/rfc7049#section-3.9
includes the wording:

> The keys in every map must be sorted lowest value to highest.
> Sorting is performed on the bytes of the representation of the key
> data items without paying attention to the 3/5 bit splitting for
> major types.
> ...
>  *  If two keys have different lengths, the shorter one sorts
      earlier;
>  *  If two keys have the same length, the one with the lower value
      in (byte-wise) lexical order sorts earlier.

1. It is not clear what "bytes of the representation of the key" means: is it
   the CBOR representation, or the binary representation of the object itself?
   Consider the int and uint difference here.
2. It is not clear what "without paying attention to" means: do we include it
   and compare on that? Or do we omit the special prefix byte, (mostly) treating
   the key in its plain binary representation form.

The FIDO 2.0: Client To Authenticator Protocol spec takes the original CBOR
wording and clarifies it according to their understanding.
https://fidoalliance.org/specs/fido-v2.0-rd-20170927/fido-client-to-authenticator-protocol-v2.0-rd-20170927.html#message-encoding

> The keys in every map must be sorted lowest value to highest. Sorting is
> performed on the bytes of the representation of the key data items without
> paying attention to the 3/5 bit splitting for major types. The sorting rules
> are:
>  * If the major types are different, the one with the lower value in numerical
>    order sorts earlier.
>  * If two keys have different lengths, the shorter one sorts earlier;
>  * If two keys have the same length, the one with the lower value in
>    (byte-wise) lexical order sorts earlier.

Some other implementations, such as borc, do a full encode then do a
length-first, byte-wise-second comparison:
https://github.com/dignifiedquire/borc/blob/b6bae8b0bcde7c3976b0f0f0957208095c392a36/src/encoder.js#L358
https://github.com/dignifiedquire/borc/blob/b6bae8b0bcde7c3976b0f0f0957208095c392a36/src/utils.js#L143-L151

This has the benefit of being able to easily handle arbitrary keys, including
complex types (maps and arrays).

We'll opt for the FIDO approach, since it affords some efficies since we don't
need a full encode of each key to determine order and can defer to the types
to determine how to most efficiently order their values (i.e. int and uint
ordering can be done on the numbers, no need for byte-wise, for example).

Recommendation: stick to single key types or you'll get into trouble, and prefer
string keys because it's much simpler that way.
*/

/*
(UPDATE, Dec 2020)
https://tools.ietf.org/html/rfc8949 is the updated CBOR spec and clarifies some
of the questions above with a new recommendation for sorting order being much
closer to what would be expected in other environments (i.e. no length-first
weirdness).
This new sorting order is not yet implemented here but could be added as an
option. "Determinism" (canonicity) is system dependent and it's difficult to
change existing systems that are built with existing expectations. So if a new
ordering is introduced here, the old needs to be kept as well with the user
having the option.
*/

/**
 * @param {TokenOrNestedTokens[]} entries
 * @param {EncodeOptions} options
 */
function sortMapEntries(entries, options) {
  if (options.mapSorter) {
    entries.sort(options.mapSorter);
  }
}

/**
 * @typedef {import('./token.js').Token} Token
 * @typedef {import('../interface').DecodeOptions} DecodeOptions
 * @typedef {import('../interface').DecodeTokenizer} DecodeTokenizer
 */

const defaultDecodeOptions = {
  strict: false,
  allowIndefinite: true,
  allowUndefined: true,
  allowBigInt: true
};

/**
 * @implements {DecodeTokenizer}
 */
class Tokeniser {
  /**
   * @param {Uint8Array} data
   * @param {DecodeOptions} options
   */
  constructor(data, options = {}) {
    this._pos = 0;
    this.data = data;
    this.options = options;
  }
  pos() {
    return this._pos;
  }
  done() {
    return this._pos >= this.data.length;
  }
  next() {
    const byt = this.data[this._pos];
    let token = quick[byt];
    if (token === undefined) {
      const decoder = jump[byt];
      /* c8 ignore next 4 */
      // if we're here then there's something wrong with our jump or quick lists!
      if (!decoder) {
        throw new Error(`${decodeErrPrefix} no decoder for major type ${byt >>> 5} (byte 0x${byt.toString(16).padStart(2, '0')})`);
      }
      const minor = byt & 31;
      token = decoder(this.data, this._pos, minor, this.options);
    }
    // @ts-ignore we get to assume encodedLength is set (crossing fingers slightly)
    this._pos += token.encodedLength;
    return token;
  }
}
const DONE = Symbol.for('DONE');
const BREAK = Symbol.for('BREAK');

/**
 * @param {Token} token
 * @param {DecodeTokenizer} tokeniser
 * @param {DecodeOptions} options
 * @returns {any|BREAK|DONE}
 */
function tokenToArray(token, tokeniser, options) {
  const arr = [];
  for (let i = 0; i < token.value; i++) {
    const value = tokensToObject(tokeniser, options);
    if (value === BREAK) {
      if (token.value === Infinity) {
        // normal end to indefinite length array
        break;
      }
      throw new Error(`${decodeErrPrefix} got unexpected break to lengthed array`);
    }
    if (value === DONE) {
      throw new Error(`${decodeErrPrefix} found array but not enough entries (got ${i}, expected ${token.value})`);
    }
    arr[i] = value;
  }
  return arr;
}

/**
 * @param {Token} token
 * @param {DecodeTokenizer} tokeniser
 * @param {DecodeOptions} options
 * @returns {any|BREAK|DONE}
 */
function tokenToMap(token, tokeniser, options) {
  const useMaps = options.useMaps === true;
  const obj = useMaps ? undefined : {};
  const m = useMaps ? new Map() : undefined;
  for (let i = 0; i < token.value; i++) {
    const key = tokensToObject(tokeniser, options);
    if (key === BREAK) {
      if (token.value === Infinity) {
        // normal end to indefinite length map
        break;
      }
      throw new Error(`${decodeErrPrefix} got unexpected break to lengthed map`);
    }
    if (key === DONE) {
      throw new Error(`${decodeErrPrefix} found map but not enough entries (got ${i} [no key], expected ${token.value})`);
    }
    if (useMaps !== true && typeof key !== 'string') {
      throw new Error(`${decodeErrPrefix} non-string keys not supported (got ${typeof key})`);
    }
    if (options.rejectDuplicateMapKeys === true) {
      // @ts-ignore
      if (useMaps && m.has(key) || !useMaps && key in obj) {
        throw new Error(`${decodeErrPrefix} found repeat map key "${key}"`);
      }
    }
    const value = tokensToObject(tokeniser, options);
    if (value === DONE) {
      throw new Error(`${decodeErrPrefix} found map but not enough entries (got ${i} [no value], expected ${token.value})`);
    }
    if (useMaps) {
      // @ts-ignore TODO reconsider this .. maybe needs to be strict about key types
      m.set(key, value);
    } else {
      // @ts-ignore TODO reconsider this .. maybe needs to be strict about key types
      obj[key] = value;
    }
  }
  // @ts-ignore c'mon man
  return useMaps ? m : obj;
}

/**
 * @param {DecodeTokenizer} tokeniser
 * @param {DecodeOptions} options
 * @returns {any|BREAK|DONE}
 */
function tokensToObject(tokeniser, options) {
  // should we support array as an argument?
  // check for tokenIter[Symbol.iterator] and replace tokenIter with what that returns?
  if (tokeniser.done()) {
    return DONE;
  }
  const token = tokeniser.next();
  if (token.type === Type.break) {
    return BREAK;
  }
  if (token.type.terminal) {
    return token.value;
  }
  if (token.type === Type.array) {
    return tokenToArray(token, tokeniser, options);
  }
  if (token.type === Type.map) {
    return tokenToMap(token, tokeniser, options);
  }
  if (token.type === Type.tag) {
    if (options.tags && typeof options.tags[token.value] === 'function') {
      const tagged = tokensToObject(tokeniser, options);
      return options.tags[token.value](tagged);
    }
    throw new Error(`${decodeErrPrefix} tag not supported (${token.value})`);
  }
  /* c8 ignore next */
  throw new Error('unsupported');
}

/**
 * @param {Uint8Array} data
 * @param {DecodeOptions} [options]
 * @returns {[any, Uint8Array]}
 */
function decodeFirst(data, options) {
  if (!(data instanceof Uint8Array)) {
    throw new Error(`${decodeErrPrefix} data to decode must be a Uint8Array`);
  }
  options = Object.assign({}, defaultDecodeOptions, options);
  const tokeniser = options.tokenizer || new Tokeniser(data, options);
  const decoded = tokensToObject(tokeniser, options);
  if (decoded === DONE) {
    throw new Error(`${decodeErrPrefix} did not find any content to decode`);
  }
  if (decoded === BREAK) {
    throw new Error(`${decodeErrPrefix} got unexpected break`);
  }
  return [decoded, data.subarray(tokeniser.pos())];
}

/**
 * @param {Uint8Array} data
 * @param {DecodeOptions} [options]
 * @returns {any}
 */
function decode$a(data, options) {
  const [decoded, remainder] = decodeFirst(data, options);
  if (remainder.length > 0) {
    throw new Error(`${decodeErrPrefix} too many terminals, data makes no sense`);
  }
  return decoded;
}

function equals$3(aa, bb) {
  if (aa === bb) return true;
  if (aa.byteLength !== bb.byteLength) {
    return false;
  }
  for (let ii = 0; ii < aa.byteLength; ii++) {
    if (aa[ii] !== bb[ii]) {
      return false;
    }
  }
  return true;
}
function coerce$1(o) {
  if (o instanceof Uint8Array && o.constructor.name === 'Uint8Array') return o;
  if (o instanceof ArrayBuffer) return new Uint8Array(o);
  if (ArrayBuffer.isView(o)) {
    return new Uint8Array(o.buffer, o.byteOffset, o.byteLength);
  }
  throw new Error('Unknown type, must be binary type');
}

/* eslint-disable */
// base-x encoding / decoding
// Copyright (c) 2018 base-x contributors
// Copyright (c) 2014-2018 The Bitcoin Core developers (base58.cpp)
// Distributed under the MIT software license, see the accompanying
// file LICENSE or http://www.opensource.org/licenses/mit-license.php.
/**
 * @param {string} ALPHABET
 * @param {any} name
 */
function base$1(ALPHABET, name) {
  if (ALPHABET.length >= 255) {
    throw new TypeError('Alphabet too long');
  }
  var BASE_MAP = new Uint8Array(256);
  for (var j = 0; j < BASE_MAP.length; j++) {
    BASE_MAP[j] = 255;
  }
  for (var i = 0; i < ALPHABET.length; i++) {
    var x = ALPHABET.charAt(i);
    var xc = x.charCodeAt(0);
    if (BASE_MAP[xc] !== 255) {
      throw new TypeError(x + ' is ambiguous');
    }
    BASE_MAP[xc] = i;
  }
  var BASE = ALPHABET.length;
  var LEADER = ALPHABET.charAt(0);
  var FACTOR = Math.log(BASE) / Math.log(256); // log(BASE) / log(256), rounded up
  var iFACTOR = Math.log(256) / Math.log(BASE); // log(256) / log(BASE), rounded up
  /**
   * @param {any[] | Iterable<number>} source
   */
  function encode(source) {
    // @ts-ignore
    if (source instanceof Uint8Array) ;else if (ArrayBuffer.isView(source)) {
      source = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    } else if (Array.isArray(source)) {
      source = Uint8Array.from(source);
    }
    if (!(source instanceof Uint8Array)) {
      throw new TypeError('Expected Uint8Array');
    }
    if (source.length === 0) {
      return '';
    }
    // Skip & count leading zeroes.
    var zeroes = 0;
    var length = 0;
    var pbegin = 0;
    var pend = source.length;
    while (pbegin !== pend && source[pbegin] === 0) {
      pbegin++;
      zeroes++;
    }
    // Allocate enough space in big-endian base58 representation.
    var size = (pend - pbegin) * iFACTOR + 1 >>> 0;
    var b58 = new Uint8Array(size);
    // Process the bytes.
    while (pbegin !== pend) {
      var carry = source[pbegin];
      // Apply "b58 = b58 * 256 + ch".
      var i = 0;
      for (var it1 = size - 1; (carry !== 0 || i < length) && it1 !== -1; it1--, i++) {
        carry += 256 * b58[it1] >>> 0;
        b58[it1] = carry % BASE >>> 0;
        carry = carry / BASE >>> 0;
      }
      if (carry !== 0) {
        throw new Error('Non-zero carry');
      }
      length = i;
      pbegin++;
    }
    // Skip leading zeroes in base58 result.
    var it2 = size - length;
    while (it2 !== size && b58[it2] === 0) {
      it2++;
    }
    // Translate the result into a string.
    var str = LEADER.repeat(zeroes);
    for (; it2 < size; ++it2) {
      str += ALPHABET.charAt(b58[it2]);
    }
    return str;
  }
  /**
   * @param {string | string[]} source
   */
  function decodeUnsafe(source) {
    if (typeof source !== 'string') {
      throw new TypeError('Expected String');
    }
    if (source.length === 0) {
      return new Uint8Array();
    }
    var psz = 0;
    // Skip leading spaces.
    if (source[psz] === ' ') {
      return;
    }
    // Skip and count leading '1's.
    var zeroes = 0;
    var length = 0;
    while (source[psz] === LEADER) {
      zeroes++;
      psz++;
    }
    // Allocate enough space in big-endian base256 representation.
    var size = (source.length - psz) * FACTOR + 1 >>> 0; // log(58) / log(256), rounded up.
    var b256 = new Uint8Array(size);
    // Process the characters.
    while (source[psz]) {
      // Decode character
      var carry = BASE_MAP[source.charCodeAt(psz)];
      // Invalid character
      if (carry === 255) {
        return;
      }
      var i = 0;
      for (var it3 = size - 1; (carry !== 0 || i < length) && it3 !== -1; it3--, i++) {
        carry += BASE * b256[it3] >>> 0;
        b256[it3] = carry % 256 >>> 0;
        carry = carry / 256 >>> 0;
      }
      if (carry !== 0) {
        throw new Error('Non-zero carry');
      }
      length = i;
      psz++;
    }
    // Skip trailing spaces.
    if (source[psz] === ' ') {
      return;
    }
    // Skip leading zeroes in b256.
    var it4 = size - length;
    while (it4 !== size && b256[it4] === 0) {
      it4++;
    }
    var vch = new Uint8Array(zeroes + (size - it4));
    var j = zeroes;
    while (it4 !== size) {
      vch[j++] = b256[it4++];
    }
    return vch;
  }
  /**
   * @param {string | string[]} string
   */
  function decode(string) {
    var buffer = decodeUnsafe(string);
    if (buffer) {
      return buffer;
    }
    throw new Error(`Non-${name} character`);
  }
  return {
    encode: encode,
    decodeUnsafe: decodeUnsafe,
    decode: decode
  };
}
var src$1 = base$1;
var _brrp__multiformats_scope_baseX$1 = src$1;

/**
 * Class represents both BaseEncoder and MultibaseEncoder meaning it
 * can be used to encode to multibase or base encode without multibase
 * prefix.
 */
let Encoder$1 = class Encoder {
  name;
  prefix;
  baseEncode;
  constructor(name, prefix, baseEncode) {
    this.name = name;
    this.prefix = prefix;
    this.baseEncode = baseEncode;
  }
  encode(bytes) {
    if (bytes instanceof Uint8Array) {
      return `${this.prefix}${this.baseEncode(bytes)}`;
    } else {
      throw Error('Unknown type, must be binary type');
    }
  }
};
/**
 * Class represents both BaseDecoder and MultibaseDecoder so it could be used
 * to decode multibases (with matching prefix) or just base decode strings
 * with corresponding base encoding.
 */
let Decoder$1 = class Decoder {
  name;
  prefix;
  baseDecode;
  prefixCodePoint;
  constructor(name, prefix, baseDecode) {
    this.name = name;
    this.prefix = prefix;
    const prefixCodePoint = prefix.codePointAt(0);
    /* c8 ignore next 3 */
    if (prefixCodePoint === undefined) {
      throw new Error('Invalid prefix character');
    }
    this.prefixCodePoint = prefixCodePoint;
    this.baseDecode = baseDecode;
  }
  decode(text) {
    if (typeof text === 'string') {
      if (text.codePointAt(0) !== this.prefixCodePoint) {
        throw Error(`Unable to decode multibase string ${JSON.stringify(text)}, ${this.name} decoder only supports inputs prefixed with ${this.prefix}`);
      }
      return this.baseDecode(text.slice(this.prefix.length));
    } else {
      throw Error('Can only multibase decode strings');
    }
  }
  or(decoder) {
    return or$1(this, decoder);
  }
};
let ComposedDecoder$1 = class ComposedDecoder {
  decoders;
  constructor(decoders) {
    this.decoders = decoders;
  }
  or(decoder) {
    return or$1(this, decoder);
  }
  decode(input) {
    const prefix = input[0];
    const decoder = this.decoders[prefix];
    if (decoder != null) {
      return decoder.decode(input);
    } else {
      throw RangeError(`Unable to decode multibase string ${JSON.stringify(input)}, only inputs prefixed with ${Object.keys(this.decoders)} are supported`);
    }
  }
};
function or$1(left, right) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return new ComposedDecoder$1({
    ...(left.decoders ?? {
      [left.prefix]: left
    }),
    ...(right.decoders ?? {
      [right.prefix]: right
    })
  });
}
let Codec$1 = class Codec {
  name;
  prefix;
  baseEncode;
  baseDecode;
  encoder;
  decoder;
  constructor(name, prefix, baseEncode, baseDecode) {
    this.name = name;
    this.prefix = prefix;
    this.baseEncode = baseEncode;
    this.baseDecode = baseDecode;
    this.encoder = new Encoder$1(name, prefix, baseEncode);
    this.decoder = new Decoder$1(name, prefix, baseDecode);
  }
  encode(input) {
    return this.encoder.encode(input);
  }
  decode(input) {
    return this.decoder.decode(input);
  }
};
function from$1({
  name,
  prefix,
  encode,
  decode
}) {
  return new Codec$1(name, prefix, encode, decode);
}
function baseX$1({
  name,
  prefix,
  alphabet
}) {
  const {
    encode,
    decode
  } = _brrp__multiformats_scope_baseX$1(alphabet, name);
  return from$1({
    prefix,
    name,
    encode,
    decode: text => coerce$1(decode(text))
  });
}
function decode$9(string, alphabet, bitsPerChar, name) {
  // Build the character lookup table:
  const codes = {};
  for (let i = 0; i < alphabet.length; ++i) {
    codes[alphabet[i]] = i;
  }
  // Count the padding bytes:
  let end = string.length;
  while (string[end - 1] === '=') {
    --end;
  }
  // Allocate the output:
  const out = new Uint8Array(end * bitsPerChar / 8 | 0);
  // Parse the data:
  let bits = 0; // Number of bits currently in the buffer
  let buffer = 0; // Bits waiting to be written out, MSB first
  let written = 0; // Next byte to write
  for (let i = 0; i < end; ++i) {
    // Read one character from the string:
    const value = codes[string[i]];
    if (value === undefined) {
      throw new SyntaxError(`Non-${name} character`);
    }
    // Append the bits to the buffer:
    buffer = buffer << bitsPerChar | value;
    bits += bitsPerChar;
    // Write out some bits if the buffer has a byte's worth:
    if (bits >= 8) {
      bits -= 8;
      out[written++] = 0xff & buffer >> bits;
    }
  }
  // Verify that we have received just enough bits:
  if (bits >= bitsPerChar || (0xff & buffer << 8 - bits) !== 0) {
    throw new SyntaxError('Unexpected end of data');
  }
  return out;
}
function encode$3(data, alphabet, bitsPerChar) {
  const pad = alphabet[alphabet.length - 1] === '=';
  const mask = (1 << bitsPerChar) - 1;
  let out = '';
  let bits = 0; // Number of bits currently in the buffer
  let buffer = 0; // Bits waiting to be written out, MSB first
  for (let i = 0; i < data.length; ++i) {
    // Slurp data into the buffer:
    buffer = buffer << 8 | data[i];
    bits += 8;
    // Write out as much as we can:
    while (bits > bitsPerChar) {
      bits -= bitsPerChar;
      out += alphabet[mask & buffer >> bits];
    }
  }
  // Partial character:
  if (bits !== 0) {
    out += alphabet[mask & buffer << bitsPerChar - bits];
  }
  // Add padding characters until we hit a byte boundary:
  if (pad) {
    while ((out.length * bitsPerChar & 7) !== 0) {
      out += '=';
    }
  }
  return out;
}
/**
 * RFC4648 Factory
 */
function rfc4648$1({
  name,
  prefix,
  bitsPerChar,
  alphabet
}) {
  return from$1({
    prefix,
    name,
    encode(input) {
      return encode$3(input, alphabet, bitsPerChar);
    },
    decode(input) {
      return decode$9(input, alphabet, bitsPerChar, name);
    }
  });
}

const base32$1 = rfc4648$1({
  prefix: 'b',
  name: 'base32',
  alphabet: 'abcdefghijklmnopqrstuvwxyz234567',
  bitsPerChar: 5
});
rfc4648$1({
  prefix: 'B',
  name: 'base32upper',
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  bitsPerChar: 5
});
rfc4648$1({
  prefix: 'c',
  name: 'base32pad',
  alphabet: 'abcdefghijklmnopqrstuvwxyz234567=',
  bitsPerChar: 5
});
rfc4648$1({
  prefix: 'C',
  name: 'base32padupper',
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=',
  bitsPerChar: 5
});
rfc4648$1({
  prefix: 'v',
  name: 'base32hex',
  alphabet: '0123456789abcdefghijklmnopqrstuv',
  bitsPerChar: 5
});
rfc4648$1({
  prefix: 'V',
  name: 'base32hexupper',
  alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUV',
  bitsPerChar: 5
});
rfc4648$1({
  prefix: 't',
  name: 'base32hexpad',
  alphabet: '0123456789abcdefghijklmnopqrstuv=',
  bitsPerChar: 5
});
rfc4648$1({
  prefix: 'T',
  name: 'base32hexpadupper',
  alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUV=',
  bitsPerChar: 5
});
rfc4648$1({
  prefix: 'h',
  name: 'base32z',
  alphabet: 'ybndrfg8ejkmcpqxot1uwisza345h769',
  bitsPerChar: 5
});

const base36$1 = baseX$1({
  prefix: 'k',
  name: 'base36',
  alphabet: '0123456789abcdefghijklmnopqrstuvwxyz'
});
baseX$1({
  prefix: 'K',
  name: 'base36upper',
  alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
});

const base58btc$1 = baseX$1({
  name: 'base58btc',
  prefix: 'z',
  alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
});
baseX$1({
  name: 'base58flickr',
  prefix: 'Z',
  alphabet: '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
});

/* eslint-disable */
var encode_1$2 = encode$2;
var MSB$2 = 0x80,
  MSBALL$1 = -128,
  INT$1 = Math.pow(2, 31);
/**
 * @param {number} num
 * @param {number[]} out
 * @param {number} offset
 */
function encode$2(num, out, offset) {
  out = out || [];
  offset = offset || 0;
  var oldOffset = offset;
  while (num >= INT$1) {
    out[offset++] = num & 0xFF | MSB$2;
    num /= 128;
  }
  while (num & MSBALL$1) {
    out[offset++] = num & 0xFF | MSB$2;
    num >>>= 7;
  }
  out[offset] = num | 0;
  // @ts-ignore
  encode$2.bytes = offset - oldOffset + 1;
  return out;
}
var decode$8 = read$1;
var MSB$1$1 = 0x80,
  REST$1$1 = 0x7F;
/**
 * @param {string | any[]} buf
 * @param {number} offset
 */
function read$1(buf, offset) {
  var res = 0,
    offset = offset || 0,
    shift = 0,
    counter = offset,
    b,
    l = buf.length;
  do {
    if (counter >= l) {
      // @ts-ignore
      read$1.bytes = 0;
      throw new RangeError('Could not decode varint');
    }
    b = buf[counter++];
    res += shift < 28 ? (b & REST$1$1) << shift : (b & REST$1$1) * Math.pow(2, shift);
    shift += 7;
  } while (b >= MSB$1$1);
  // @ts-ignore
  read$1.bytes = counter - offset;
  return res;
}
var N1$1 = Math.pow(2, 7);
var N2$1 = Math.pow(2, 14);
var N3$1 = Math.pow(2, 21);
var N4$1 = Math.pow(2, 28);
var N5$1 = Math.pow(2, 35);
var N6$1 = Math.pow(2, 42);
var N7$1 = Math.pow(2, 49);
var N8$1 = Math.pow(2, 56);
var N9$1 = Math.pow(2, 63);
var length$2 = function (/** @type {number} */value) {
  return value < N1$1 ? 1 : value < N2$1 ? 2 : value < N3$1 ? 3 : value < N4$1 ? 4 : value < N5$1 ? 5 : value < N6$1 ? 6 : value < N7$1 ? 7 : value < N8$1 ? 8 : value < N9$1 ? 9 : 10;
};
var varint$3 = {
  encode: encode_1$2,
  decode: decode$8,
  encodingLength: length$2
};
var _brrp_varint$1 = varint$3;

function decode$7(data, offset = 0) {
  const code = _brrp_varint$1.decode(data, offset);
  return [code, _brrp_varint$1.decode.bytes];
}
function encodeTo$1(int, target, offset = 0) {
  _brrp_varint$1.encode(int, target, offset);
  return target;
}
function encodingLength$1(int) {
  return _brrp_varint$1.encodingLength(int);
}

/**
 * Creates a multihash digest.
 */
function create$1(code, digest) {
  const size = digest.byteLength;
  const sizeOffset = encodingLength$1(code);
  const digestOffset = sizeOffset + encodingLength$1(size);
  const bytes = new Uint8Array(digestOffset + size);
  encodeTo$1(code, bytes, 0);
  encodeTo$1(size, bytes, sizeOffset);
  bytes.set(digest, digestOffset);
  return new Digest$1(code, size, digest, bytes);
}
/**
 * Turns bytes representation of multihash digest into an instance.
 */
function decode$6(multihash) {
  const bytes = coerce$1(multihash);
  const [code, sizeOffset] = decode$7(bytes);
  const [size, digestOffset] = decode$7(bytes.subarray(sizeOffset));
  const digest = bytes.subarray(sizeOffset + digestOffset);
  if (digest.byteLength !== size) {
    throw new Error('Incorrect length');
  }
  return new Digest$1(code, size, digest, bytes);
}
function equals$2(a, b) {
  if (a === b) {
    return true;
  } else {
    const data = b;
    return a.code === data.code && a.size === data.size && data.bytes instanceof Uint8Array && equals$3(a.bytes, data.bytes);
  }
}
/**
 * Represents a multihash digest which carries information about the
 * hashing algorithm and an actual hash digest.
 */
let Digest$1 = class Digest {
  code;
  size;
  digest;
  bytes;
  /**
   * Creates a multihash digest.
   */
  constructor(code, size, digest, bytes) {
    this.code = code;
    this.size = size;
    this.digest = digest;
    this.bytes = bytes;
  }
};

function format$1(link, base) {
  const {
    bytes,
    version
  } = link;
  switch (version) {
    case 0:
      return toStringV0$1(bytes, baseCache$1(link), base ?? base58btc$1.encoder);
    default:
      return toStringV1$1(bytes, baseCache$1(link), base ?? base32$1.encoder);
  }
}
const cache$1 = new WeakMap();
function baseCache$1(cid) {
  const baseCache = cache$1.get(cid);
  if (baseCache == null) {
    const baseCache = new Map();
    cache$1.set(cid, baseCache);
    return baseCache;
  }
  return baseCache;
}
let CID$1 = class CID {
  code;
  version;
  multihash;
  bytes;
  '/';
  /**
   * @param version - Version of the CID
   * @param code - Code of the codec content is encoded in, see https://github.com/multiformats/multicodec/blob/master/table.csv
   * @param multihash - (Multi)hash of the of the content.
   */
  constructor(version, code, multihash, bytes) {
    this.code = code;
    this.version = version;
    this.multihash = multihash;
    this.bytes = bytes;
    // flag to serializers that this is a CID and
    // should be treated specially
    this['/'] = bytes;
  }
  /**
   * Signalling `cid.asCID === cid` has been replaced with `cid['/'] === cid.bytes`
   * please either use `CID.asCID(cid)` or switch to new signalling mechanism
   *
   * @deprecated
   */
  get asCID() {
    return this;
  }
  // ArrayBufferView
  get byteOffset() {
    return this.bytes.byteOffset;
  }
  // ArrayBufferView
  get byteLength() {
    return this.bytes.byteLength;
  }
  toV0() {
    switch (this.version) {
      case 0:
        {
          return this;
        }
      case 1:
        {
          const {
            code,
            multihash
          } = this;
          if (code !== DAG_PB_CODE$1) {
            throw new Error('Cannot convert a non dag-pb CID to CIDv0');
          }
          // sha2-256
          if (multihash.code !== SHA_256_CODE$1) {
            throw new Error('Cannot convert non sha2-256 multihash CID to CIDv0');
          }
          return CID.createV0(multihash);
        }
      default:
        {
          throw Error(`Can not convert CID version ${this.version} to version 0. This is a bug please report`);
        }
    }
  }
  toV1() {
    switch (this.version) {
      case 0:
        {
          const {
            code,
            digest
          } = this.multihash;
          const multihash = create$1(code, digest);
          return CID.createV1(this.code, multihash);
        }
      case 1:
        {
          return this;
        }
      default:
        {
          throw Error(`Can not convert CID version ${this.version} to version 1. This is a bug please report`);
        }
    }
  }
  equals(other) {
    return CID.equals(this, other);
  }
  static equals(self, other) {
    const unknown = other;
    return unknown != null && self.code === unknown.code && self.version === unknown.version && equals$2(self.multihash, unknown.multihash);
  }
  toString(base) {
    return format$1(this, base);
  }
  toJSON() {
    return {
      '/': format$1(this)
    };
  }
  link() {
    return this;
  }
  [Symbol.toStringTag] = 'CID';
  // Legacy
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `CID(${this.toString()})`;
  }
  /**
   * Takes any input `value` and returns a `CID` instance if it was
   * a `CID` otherwise returns `null`. If `value` is instanceof `CID`
   * it will return value back. If `value` is not instance of this CID
   * class, but is compatible CID it will return new instance of this
   * `CID` class. Otherwise returns null.
   *
   * This allows two different incompatible versions of CID library to
   * co-exist and interop as long as binary interface is compatible.
   */
  static asCID(input) {
    if (input == null) {
      return null;
    }
    const value = input;
    if (value instanceof CID) {
      // If value is instance of CID then we're all set.
      return value;
    } else if (value['/'] != null && value['/'] === value.bytes || value.asCID === value) {
      // If value isn't instance of this CID class but `this.asCID === this` or
      // `value['/'] === value.bytes` is true it is CID instance coming from a
      // different implementation (diff version or duplicate). In that case we
      // rebase it to this `CID` implementation so caller is guaranteed to get
      // instance with expected API.
      const {
        version,
        code,
        multihash,
        bytes
      } = value;
      return new CID(version, code, multihash, bytes ?? encodeCID$1(version, code, multihash.bytes));
    } else if (value[cidSymbol$1] === true) {
      // If value is a CID from older implementation that used to be tagged via
      // symbol we still rebase it to the this `CID` implementation by
      // delegating that to a constructor.
      const {
        version,
        multihash,
        code
      } = value;
      const digest = decode$6(multihash);
      return CID.create(version, code, digest);
    } else {
      // Otherwise value is not a CID (or an incompatible version of it) in
      // which case we return `null`.
      return null;
    }
  }
  /**
   * @param version - Version of the CID
   * @param code - Code of the codec content is encoded in, see https://github.com/multiformats/multicodec/blob/master/table.csv
   * @param digest - (Multi)hash of the of the content.
   */
  static create(version, code, digest) {
    if (typeof code !== 'number') {
      throw new Error('String codecs are no longer supported');
    }
    if (!(digest.bytes instanceof Uint8Array)) {
      throw new Error('Invalid digest');
    }
    switch (version) {
      case 0:
        {
          if (code !== DAG_PB_CODE$1) {
            throw new Error(`Version 0 CID must use dag-pb (code: ${DAG_PB_CODE$1}) block encoding`);
          } else {
            return new CID(version, code, digest, digest.bytes);
          }
        }
      case 1:
        {
          const bytes = encodeCID$1(version, code, digest.bytes);
          return new CID(version, code, digest, bytes);
        }
      default:
        {
          throw new Error('Invalid version');
        }
    }
  }
  /**
   * Simplified version of `create` for CIDv0.
   */
  static createV0(digest) {
    return CID.create(0, DAG_PB_CODE$1, digest);
  }
  /**
   * Simplified version of `create` for CIDv1.
   *
   * @param code - Content encoding format code.
   * @param digest - Multihash of the content.
   */
  static createV1(code, digest) {
    return CID.create(1, code, digest);
  }
  /**
   * Decoded a CID from its binary representation. The byte array must contain
   * only the CID with no additional bytes.
   *
   * An error will be thrown if the bytes provided do not contain a valid
   * binary representation of a CID.
   */
  static decode(bytes) {
    const [cid, remainder] = CID.decodeFirst(bytes);
    if (remainder.length !== 0) {
      throw new Error('Incorrect length');
    }
    return cid;
  }
  /**
   * Decoded a CID from its binary representation at the beginning of a byte
   * array.
   *
   * Returns an array with the first element containing the CID and the second
   * element containing the remainder of the original byte array. The remainder
   * will be a zero-length byte array if the provided bytes only contained a
   * binary CID representation.
   */
  static decodeFirst(bytes) {
    const specs = CID.inspectBytes(bytes);
    const prefixSize = specs.size - specs.multihashSize;
    const multihashBytes = coerce$1(bytes.subarray(prefixSize, prefixSize + specs.multihashSize));
    if (multihashBytes.byteLength !== specs.multihashSize) {
      throw new Error('Incorrect length');
    }
    const digestBytes = multihashBytes.subarray(specs.multihashSize - specs.digestSize);
    const digest = new Digest$1(specs.multihashCode, specs.digestSize, digestBytes, multihashBytes);
    const cid = specs.version === 0 ? CID.createV0(digest) : CID.createV1(specs.codec, digest);
    return [cid, bytes.subarray(specs.size)];
  }
  /**
   * Inspect the initial bytes of a CID to determine its properties.
   *
   * Involves decoding up to 4 varints. Typically this will require only 4 to 6
   * bytes but for larger multicodec code values and larger multihash digest
   * lengths these varints can be quite large. It is recommended that at least
   * 10 bytes be made available in the `initialBytes` argument for a complete
   * inspection.
   */
  static inspectBytes(initialBytes) {
    let offset = 0;
    const next = () => {
      const [i, length] = decode$7(initialBytes.subarray(offset));
      offset += length;
      return i;
    };
    let version = next();
    let codec = DAG_PB_CODE$1;
    if (version === 18) {
      // CIDv0
      version = 0;
      offset = 0;
    } else {
      codec = next();
    }
    if (version !== 0 && version !== 1) {
      throw new RangeError(`Invalid CID version ${version}`);
    }
    const prefixSize = offset;
    const multihashCode = next(); // multihash code
    const digestSize = next(); // multihash length
    const size = offset + digestSize;
    const multihashSize = size - prefixSize;
    return {
      version,
      codec,
      multihashCode,
      digestSize,
      multihashSize,
      size
    };
  }
  /**
   * Takes cid in a string representation and creates an instance. If `base`
   * decoder is not provided will use a default from the configuration. It will
   * throw an error if encoding of the CID is not compatible with supplied (or
   * a default decoder).
   */
  static parse(source, base) {
    const [prefix, bytes] = parseCIDtoBytes$1(source, base);
    const cid = CID.decode(bytes);
    if (cid.version === 0 && source[0] !== 'Q') {
      throw Error('Version 0 CID string must not include multibase prefix');
    }
    // Cache string representation to avoid computing it on `this.toString()`
    baseCache$1(cid).set(prefix, source);
    return cid;
  }
};
function parseCIDtoBytes$1(source, base) {
  switch (source[0]) {
    // CIDv0 is parsed differently
    case 'Q':
      {
        const decoder = base ?? base58btc$1;
        return [base58btc$1.prefix, decoder.decode(`${base58btc$1.prefix}${source}`)];
      }
    case base58btc$1.prefix:
      {
        const decoder = base ?? base58btc$1;
        return [base58btc$1.prefix, decoder.decode(source)];
      }
    case base32$1.prefix:
      {
        const decoder = base ?? base32$1;
        return [base32$1.prefix, decoder.decode(source)];
      }
    case base36$1.prefix:
      {
        const decoder = base ?? base36$1;
        return [base36$1.prefix, decoder.decode(source)];
      }
    default:
      {
        if (base == null) {
          throw Error('To parse non base32, base36 or base58btc encoded CID multibase decoder must be provided');
        }
        return [source[0], base.decode(source)];
      }
  }
}
function toStringV0$1(bytes, cache, base) {
  const {
    prefix
  } = base;
  if (prefix !== base58btc$1.prefix) {
    throw Error(`Cannot string encode V0 in ${base.name} encoding`);
  }
  const cid = cache.get(prefix);
  if (cid == null) {
    const cid = base.encode(bytes).slice(1);
    cache.set(prefix, cid);
    return cid;
  } else {
    return cid;
  }
}
function toStringV1$1(bytes, cache, base) {
  const {
    prefix
  } = base;
  const cid = cache.get(prefix);
  if (cid == null) {
    const cid = base.encode(bytes);
    cache.set(prefix, cid);
    return cid;
  } else {
    return cid;
  }
}
const DAG_PB_CODE$1 = 0x70;
const SHA_256_CODE$1 = 0x12;
function encodeCID$1(version, code, multihash) {
  const codeOffset = encodingLength$1(version);
  const hashOffset = codeOffset + encodingLength$1(code);
  const bytes = new Uint8Array(hashOffset + multihash.byteLength);
  encodeTo$1(version, bytes, 0);
  encodeTo$1(code, bytes, codeOffset);
  bytes.set(multihash, hashOffset);
  return bytes;
}
const cidSymbol$1 = Symbol.for('@ipld/js-cid/CID');

// https://github.com/ipfs/go-ipfs/issues/3570#issuecomment-273931692
const CID_CBOR_TAG = 42;

/**
 * @template T
 * @typedef {import('multiformats/codecs/interface').ByteView<T>} ByteView
 */

/**
 * @template T
 * @typedef {import('multiformats/codecs/interface').ArrayBufferView<T>} ArrayBufferView
 */

/**
 * @template T
 * @param {ByteView<T> | ArrayBufferView<T>} buf
 * @returns {ByteView<T>}
 */
function toByteView(buf) {
  if (buf instanceof ArrayBuffer) {
    return new Uint8Array(buf, 0, buf.byteLength);
  }
  return buf;
}

/**
 * cidEncoder will receive all Objects during encode, it needs to filter out
 * anything that's not a CID and return `null` for that so it's encoded as
 * normal.
 *
 * @param {any} obj
 * @returns {cborg.Token[]|null}
 */
function cidEncoder(obj) {
  if (obj.asCID !== obj && obj['/'] !== obj.bytes) {
    return null; // any other kind of object
  }
  const cid = CID$1.asCID(obj);
  /* c8 ignore next 4 */
  // very unlikely case, and it'll probably throw a recursion error in cborg
  if (!cid) {
    return null;
  }
  const bytes = new Uint8Array(cid.bytes.byteLength + 1);
  bytes.set(cid.bytes, 1); // prefix is 0x00, for historical reasons
  return [new Token(Type.tag, CID_CBOR_TAG), new Token(Type.bytes, bytes)];
}

// eslint-disable-next-line jsdoc/require-returns-check
/**
 * Intercept all `undefined` values from an object walk and reject the entire
 * object if we find one.
 *
 * @returns {null}
 */
function undefinedEncoder() {
  throw new Error('`undefined` is not supported by the IPLD Data Model and cannot be encoded');
}

/**
 * Intercept all `number` values from an object walk and reject the entire
 * object if we find something that doesn't fit the IPLD data model (NaN &
 * Infinity).
 *
 * @param {number} num
 * @returns {null}
 */
function numberEncoder(num) {
  if (Number.isNaN(num)) {
    throw new Error('`NaN` is not supported by the IPLD Data Model and cannot be encoded');
  }
  if (num === Infinity || num === -Infinity) {
    throw new Error('`Infinity` and `-Infinity` is not supported by the IPLD Data Model and cannot be encoded');
  }
  return null;
}
const _encodeOptions = {
  float64: true,
  typeEncoders: {
    Object: cidEncoder,
    undefined: undefinedEncoder,
    number: numberEncoder
  }
};
({
  ..._encodeOptions,
  typeEncoders: {
    ..._encodeOptions.typeEncoders
  }
});

/**
 * @param {Uint8Array} bytes
 * @returns {CID}
 */
function cidDecoder(bytes) {
  if (bytes[0] !== 0) {
    throw new Error('Invalid CID for CBOR tag 42; expected leading 0x00');
  }
  return CID$1.decode(bytes.subarray(1)); // ignore leading 0x00
}
const _decodeOptions = {
  allowIndefinite: false,
  coerceUndefinedToNull: true,
  allowNaN: false,
  allowInfinity: false,
  allowBigInt: true,
  // this will lead to BigInt for ints outside of
  // safe-integer range, which may surprise users
  strict: true,
  useMaps: false,
  rejectDuplicateMapKeys: true,
  /** @type {import('cborg').TagDecoder[]} */
  tags: []
};
_decodeOptions.tags[CID_CBOR_TAG] = cidDecoder;
({
  ..._decodeOptions,
  tags: _decodeOptions.tags.slice()
});

/**
 * @template T
 * @param {ByteView<T> | ArrayBufferView<T>} data
 * @returns {T}
 */
const decode$5 = data => decode$a(toByteView(data), _decodeOptions);

function equals$1(aa, bb) {
  if (aa === bb) return true;
  if (aa.byteLength !== bb.byteLength) {
    return false;
  }
  for (let ii = 0; ii < aa.byteLength; ii++) {
    if (aa[ii] !== bb[ii]) {
      return false;
    }
  }
  return true;
}
function coerce(o) {
  if (o instanceof Uint8Array && o.constructor.name === 'Uint8Array') return o;
  if (o instanceof ArrayBuffer) return new Uint8Array(o);
  if (ArrayBuffer.isView(o)) {
    return new Uint8Array(o.buffer, o.byteOffset, o.byteLength);
  }
  throw new Error('Unknown type, must be binary type');
}

/* eslint-disable */
// base-x encoding / decoding
// Copyright (c) 2018 base-x contributors
// Copyright (c) 2014-2018 The Bitcoin Core developers (base58.cpp)
// Distributed under the MIT software license, see the accompanying
// file LICENSE or http://www.opensource.org/licenses/mit-license.php.
/**
 * @param {string} ALPHABET
 * @param {any} name
 */
function base(ALPHABET, name) {
  if (ALPHABET.length >= 255) {
    throw new TypeError('Alphabet too long');
  }
  var BASE_MAP = new Uint8Array(256);
  for (var j = 0; j < BASE_MAP.length; j++) {
    BASE_MAP[j] = 255;
  }
  for (var i = 0; i < ALPHABET.length; i++) {
    var x = ALPHABET.charAt(i);
    var xc = x.charCodeAt(0);
    if (BASE_MAP[xc] !== 255) {
      throw new TypeError(x + ' is ambiguous');
    }
    BASE_MAP[xc] = i;
  }
  var BASE = ALPHABET.length;
  var LEADER = ALPHABET.charAt(0);
  var FACTOR = Math.log(BASE) / Math.log(256); // log(BASE) / log(256), rounded up
  var iFACTOR = Math.log(256) / Math.log(BASE); // log(256) / log(BASE), rounded up
  /**
   * @param {any[] | Iterable<number>} source
   */
  function encode(source) {
    // @ts-ignore
    if (source instanceof Uint8Array) ;else if (ArrayBuffer.isView(source)) {
      source = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    } else if (Array.isArray(source)) {
      source = Uint8Array.from(source);
    }
    if (!(source instanceof Uint8Array)) {
      throw new TypeError('Expected Uint8Array');
    }
    if (source.length === 0) {
      return '';
    }
    // Skip & count leading zeroes.
    var zeroes = 0;
    var length = 0;
    var pbegin = 0;
    var pend = source.length;
    while (pbegin !== pend && source[pbegin] === 0) {
      pbegin++;
      zeroes++;
    }
    // Allocate enough space in big-endian base58 representation.
    var size = (pend - pbegin) * iFACTOR + 1 >>> 0;
    var b58 = new Uint8Array(size);
    // Process the bytes.
    while (pbegin !== pend) {
      var carry = source[pbegin];
      // Apply "b58 = b58 * 256 + ch".
      var i = 0;
      for (var it1 = size - 1; (carry !== 0 || i < length) && it1 !== -1; it1--, i++) {
        carry += 256 * b58[it1] >>> 0;
        b58[it1] = carry % BASE >>> 0;
        carry = carry / BASE >>> 0;
      }
      if (carry !== 0) {
        throw new Error('Non-zero carry');
      }
      length = i;
      pbegin++;
    }
    // Skip leading zeroes in base58 result.
    var it2 = size - length;
    while (it2 !== size && b58[it2] === 0) {
      it2++;
    }
    // Translate the result into a string.
    var str = LEADER.repeat(zeroes);
    for (; it2 < size; ++it2) {
      str += ALPHABET.charAt(b58[it2]);
    }
    return str;
  }
  /**
   * @param {string | string[]} source
   */
  function decodeUnsafe(source) {
    if (typeof source !== 'string') {
      throw new TypeError('Expected String');
    }
    if (source.length === 0) {
      return new Uint8Array();
    }
    var psz = 0;
    // Skip leading spaces.
    if (source[psz] === ' ') {
      return;
    }
    // Skip and count leading '1's.
    var zeroes = 0;
    var length = 0;
    while (source[psz] === LEADER) {
      zeroes++;
      psz++;
    }
    // Allocate enough space in big-endian base256 representation.
    var size = (source.length - psz) * FACTOR + 1 >>> 0; // log(58) / log(256), rounded up.
    var b256 = new Uint8Array(size);
    // Process the characters.
    while (source[psz]) {
      // Decode character
      var carry = BASE_MAP[source.charCodeAt(psz)];
      // Invalid character
      if (carry === 255) {
        return;
      }
      var i = 0;
      for (var it3 = size - 1; (carry !== 0 || i < length) && it3 !== -1; it3--, i++) {
        carry += BASE * b256[it3] >>> 0;
        b256[it3] = carry % 256 >>> 0;
        carry = carry / 256 >>> 0;
      }
      if (carry !== 0) {
        throw new Error('Non-zero carry');
      }
      length = i;
      psz++;
    }
    // Skip trailing spaces.
    if (source[psz] === ' ') {
      return;
    }
    // Skip leading zeroes in b256.
    var it4 = size - length;
    while (it4 !== size && b256[it4] === 0) {
      it4++;
    }
    var vch = new Uint8Array(zeroes + (size - it4));
    var j = zeroes;
    while (it4 !== size) {
      vch[j++] = b256[it4++];
    }
    return vch;
  }
  /**
   * @param {string | string[]} string
   */
  function decode(string) {
    var buffer = decodeUnsafe(string);
    if (buffer) {
      return buffer;
    }
    throw new Error(`Non-${name} character`);
  }
  return {
    encode: encode,
    decodeUnsafe: decodeUnsafe,
    decode: decode
  };
}
var src = base;
var _brrp__multiformats_scope_baseX = src;

/**
 * Class represents both BaseEncoder and MultibaseEncoder meaning it
 * can be used to encode to multibase or base encode without multibase
 * prefix.
 */
class Encoder {
  name;
  prefix;
  baseEncode;
  constructor(name, prefix, baseEncode) {
    this.name = name;
    this.prefix = prefix;
    this.baseEncode = baseEncode;
  }
  encode(bytes) {
    if (bytes instanceof Uint8Array) {
      return `${this.prefix}${this.baseEncode(bytes)}`;
    } else {
      throw Error('Unknown type, must be binary type');
    }
  }
}
/**
 * Class represents both BaseDecoder and MultibaseDecoder so it could be used
 * to decode multibases (with matching prefix) or just base decode strings
 * with corresponding base encoding.
 */
class Decoder {
  name;
  prefix;
  baseDecode;
  prefixCodePoint;
  constructor(name, prefix, baseDecode) {
    this.name = name;
    this.prefix = prefix;
    const prefixCodePoint = prefix.codePointAt(0);
    /* c8 ignore next 3 */
    if (prefixCodePoint === undefined) {
      throw new Error('Invalid prefix character');
    }
    this.prefixCodePoint = prefixCodePoint;
    this.baseDecode = baseDecode;
  }
  decode(text) {
    if (typeof text === 'string') {
      if (text.codePointAt(0) !== this.prefixCodePoint) {
        throw Error(`Unable to decode multibase string ${JSON.stringify(text)}, ${this.name} decoder only supports inputs prefixed with ${this.prefix}`);
      }
      return this.baseDecode(text.slice(this.prefix.length));
    } else {
      throw Error('Can only multibase decode strings');
    }
  }
  or(decoder) {
    return or(this, decoder);
  }
}
class ComposedDecoder {
  decoders;
  constructor(decoders) {
    this.decoders = decoders;
  }
  or(decoder) {
    return or(this, decoder);
  }
  decode(input) {
    const prefix = input[0];
    const decoder = this.decoders[prefix];
    if (decoder != null) {
      return decoder.decode(input);
    } else {
      throw RangeError(`Unable to decode multibase string ${JSON.stringify(input)}, only inputs prefixed with ${Object.keys(this.decoders)} are supported`);
    }
  }
}
function or(left, right) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return new ComposedDecoder({
    ...(left.decoders ?? {
      [left.prefix]: left
    }),
    ...(right.decoders ?? {
      [right.prefix]: right
    })
  });
}
class Codec {
  name;
  prefix;
  baseEncode;
  baseDecode;
  encoder;
  decoder;
  constructor(name, prefix, baseEncode, baseDecode) {
    this.name = name;
    this.prefix = prefix;
    this.baseEncode = baseEncode;
    this.baseDecode = baseDecode;
    this.encoder = new Encoder(name, prefix, baseEncode);
    this.decoder = new Decoder(name, prefix, baseDecode);
  }
  encode(input) {
    return this.encoder.encode(input);
  }
  decode(input) {
    return this.decoder.decode(input);
  }
}
function from({
  name,
  prefix,
  encode,
  decode
}) {
  return new Codec(name, prefix, encode, decode);
}
function baseX({
  name,
  prefix,
  alphabet
}) {
  const {
    encode,
    decode
  } = _brrp__multiformats_scope_baseX(alphabet, name);
  return from({
    prefix,
    name,
    encode,
    decode: text => coerce(decode(text))
  });
}
function decode$4(string, alphabet, bitsPerChar, name) {
  // Build the character lookup table:
  const codes = {};
  for (let i = 0; i < alphabet.length; ++i) {
    codes[alphabet[i]] = i;
  }
  // Count the padding bytes:
  let end = string.length;
  while (string[end - 1] === '=') {
    --end;
  }
  // Allocate the output:
  const out = new Uint8Array(end * bitsPerChar / 8 | 0);
  // Parse the data:
  let bits = 0; // Number of bits currently in the buffer
  let buffer = 0; // Bits waiting to be written out, MSB first
  let written = 0; // Next byte to write
  for (let i = 0; i < end; ++i) {
    // Read one character from the string:
    const value = codes[string[i]];
    if (value === undefined) {
      throw new SyntaxError(`Non-${name} character`);
    }
    // Append the bits to the buffer:
    buffer = buffer << bitsPerChar | value;
    bits += bitsPerChar;
    // Write out some bits if the buffer has a byte's worth:
    if (bits >= 8) {
      bits -= 8;
      out[written++] = 0xff & buffer >> bits;
    }
  }
  // Verify that we have received just enough bits:
  if (bits >= bitsPerChar || (0xff & buffer << 8 - bits) !== 0) {
    throw new SyntaxError('Unexpected end of data');
  }
  return out;
}
function encode$1(data, alphabet, bitsPerChar) {
  const pad = alphabet[alphabet.length - 1] === '=';
  const mask = (1 << bitsPerChar) - 1;
  let out = '';
  let bits = 0; // Number of bits currently in the buffer
  let buffer = 0; // Bits waiting to be written out, MSB first
  for (let i = 0; i < data.length; ++i) {
    // Slurp data into the buffer:
    buffer = buffer << 8 | data[i];
    bits += 8;
    // Write out as much as we can:
    while (bits > bitsPerChar) {
      bits -= bitsPerChar;
      out += alphabet[mask & buffer >> bits];
    }
  }
  // Partial character:
  if (bits !== 0) {
    out += alphabet[mask & buffer << bitsPerChar - bits];
  }
  // Add padding characters until we hit a byte boundary:
  if (pad) {
    while ((out.length * bitsPerChar & 7) !== 0) {
      out += '=';
    }
  }
  return out;
}
/**
 * RFC4648 Factory
 */
function rfc4648({
  name,
  prefix,
  bitsPerChar,
  alphabet
}) {
  return from({
    prefix,
    name,
    encode(input) {
      return encode$1(input, alphabet, bitsPerChar);
    },
    decode(input) {
      return decode$4(input, alphabet, bitsPerChar, name);
    }
  });
}

const base32 = rfc4648({
  prefix: 'b',
  name: 'base32',
  alphabet: 'abcdefghijklmnopqrstuvwxyz234567',
  bitsPerChar: 5
});
rfc4648({
  prefix: 'B',
  name: 'base32upper',
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  bitsPerChar: 5
});
rfc4648({
  prefix: 'c',
  name: 'base32pad',
  alphabet: 'abcdefghijklmnopqrstuvwxyz234567=',
  bitsPerChar: 5
});
rfc4648({
  prefix: 'C',
  name: 'base32padupper',
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=',
  bitsPerChar: 5
});
rfc4648({
  prefix: 'v',
  name: 'base32hex',
  alphabet: '0123456789abcdefghijklmnopqrstuv',
  bitsPerChar: 5
});
rfc4648({
  prefix: 'V',
  name: 'base32hexupper',
  alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUV',
  bitsPerChar: 5
});
rfc4648({
  prefix: 't',
  name: 'base32hexpad',
  alphabet: '0123456789abcdefghijklmnopqrstuv=',
  bitsPerChar: 5
});
rfc4648({
  prefix: 'T',
  name: 'base32hexpadupper',
  alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUV=',
  bitsPerChar: 5
});
rfc4648({
  prefix: 'h',
  name: 'base32z',
  alphabet: 'ybndrfg8ejkmcpqxot1uwisza345h769',
  bitsPerChar: 5
});

const base36 = baseX({
  prefix: 'k',
  name: 'base36',
  alphabet: '0123456789abcdefghijklmnopqrstuvwxyz'
});
baseX({
  prefix: 'K',
  name: 'base36upper',
  alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
});

const base58btc = baseX({
  name: 'base58btc',
  prefix: 'z',
  alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
});
baseX({
  name: 'base58flickr',
  prefix: 'Z',
  alphabet: '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
});

/* eslint-disable */
var encode_1$1 = encode;
var MSB = 0x80,
  MSBALL = -128,
  INT = Math.pow(2, 31);
/**
 * @param {number} num
 * @param {number[]} out
 * @param {number} offset
 */
function encode(num, out, offset) {
  out = out || [];
  offset = offset || 0;
  var oldOffset = offset;
  while (num >= INT) {
    out[offset++] = num & 0xFF | MSB;
    num /= 128;
  }
  while (num & MSBALL) {
    out[offset++] = num & 0xFF | MSB;
    num >>>= 7;
  }
  out[offset] = num | 0;
  // @ts-ignore
  encode.bytes = offset - oldOffset + 1;
  return out;
}
var decode$3 = read;
var MSB$1 = 0x80,
  REST$1 = 0x7F;
/**
 * @param {string | any[]} buf
 * @param {number} offset
 */
function read(buf, offset) {
  var res = 0,
    offset = offset || 0,
    shift = 0,
    counter = offset,
    b,
    l = buf.length;
  do {
    if (counter >= l) {
      // @ts-ignore
      read.bytes = 0;
      throw new RangeError('Could not decode varint');
    }
    b = buf[counter++];
    res += shift < 28 ? (b & REST$1) << shift : (b & REST$1) * Math.pow(2, shift);
    shift += 7;
  } while (b >= MSB$1);
  // @ts-ignore
  read.bytes = counter - offset;
  return res;
}
var N1 = Math.pow(2, 7);
var N2 = Math.pow(2, 14);
var N3 = Math.pow(2, 21);
var N4 = Math.pow(2, 28);
var N5 = Math.pow(2, 35);
var N6 = Math.pow(2, 42);
var N7 = Math.pow(2, 49);
var N8 = Math.pow(2, 56);
var N9 = Math.pow(2, 63);
var length$1 = function (/** @type {number} */value) {
  return value < N1 ? 1 : value < N2 ? 2 : value < N3 ? 3 : value < N4 ? 4 : value < N5 ? 5 : value < N6 ? 6 : value < N7 ? 7 : value < N8 ? 8 : value < N9 ? 9 : 10;
};
var varint$2 = {
  encode: encode_1$1,
  decode: decode$3,
  encodingLength: length$1
};
var _brrp_varint = varint$2;

function decode$2(data, offset = 0) {
  const code = _brrp_varint.decode(data, offset);
  return [code, _brrp_varint.decode.bytes];
}
function encodeTo(int, target, offset = 0) {
  _brrp_varint.encode(int, target, offset);
  return target;
}
function encodingLength(int) {
  return _brrp_varint.encodingLength(int);
}

/**
 * Creates a multihash digest.
 */
function create(code, digest) {
  const size = digest.byteLength;
  const sizeOffset = encodingLength(code);
  const digestOffset = sizeOffset + encodingLength(size);
  const bytes = new Uint8Array(digestOffset + size);
  encodeTo(code, bytes, 0);
  encodeTo(size, bytes, sizeOffset);
  bytes.set(digest, digestOffset);
  return new Digest(code, size, digest, bytes);
}
/**
 * Turns bytes representation of multihash digest into an instance.
 */
function decode$1(multihash) {
  const bytes = coerce(multihash);
  const [code, sizeOffset] = decode$2(bytes);
  const [size, digestOffset] = decode$2(bytes.subarray(sizeOffset));
  const digest = bytes.subarray(sizeOffset + digestOffset);
  if (digest.byteLength !== size) {
    throw new Error('Incorrect length');
  }
  return new Digest(code, size, digest, bytes);
}
function equals(a, b) {
  if (a === b) {
    return true;
  } else {
    const data = b;
    return a.code === data.code && a.size === data.size && data.bytes instanceof Uint8Array && equals$1(a.bytes, data.bytes);
  }
}
/**
 * Represents a multihash digest which carries information about the
 * hashing algorithm and an actual hash digest.
 */
class Digest {
  code;
  size;
  digest;
  bytes;
  /**
   * Creates a multihash digest.
   */
  constructor(code, size, digest, bytes) {
    this.code = code;
    this.size = size;
    this.digest = digest;
    this.bytes = bytes;
  }
}

function format(link, base) {
  const {
    bytes,
    version
  } = link;
  switch (version) {
    case 0:
      return toStringV0(bytes, baseCache(link), base ?? base58btc.encoder);
    default:
      return toStringV1(bytes, baseCache(link), base ?? base32.encoder);
  }
}
const cache = new WeakMap();
function baseCache(cid) {
  const baseCache = cache.get(cid);
  if (baseCache == null) {
    const baseCache = new Map();
    cache.set(cid, baseCache);
    return baseCache;
  }
  return baseCache;
}
class CID {
  code;
  version;
  multihash;
  bytes;
  '/';
  /**
   * @param version - Version of the CID
   * @param code - Code of the codec content is encoded in, see https://github.com/multiformats/multicodec/blob/master/table.csv
   * @param multihash - (Multi)hash of the of the content.
   */
  constructor(version, code, multihash, bytes) {
    this.code = code;
    this.version = version;
    this.multihash = multihash;
    this.bytes = bytes;
    // flag to serializers that this is a CID and
    // should be treated specially
    this['/'] = bytes;
  }
  /**
   * Signalling `cid.asCID === cid` has been replaced with `cid['/'] === cid.bytes`
   * please either use `CID.asCID(cid)` or switch to new signalling mechanism
   *
   * @deprecated
   */
  get asCID() {
    return this;
  }
  // ArrayBufferView
  get byteOffset() {
    return this.bytes.byteOffset;
  }
  // ArrayBufferView
  get byteLength() {
    return this.bytes.byteLength;
  }
  toV0() {
    switch (this.version) {
      case 0:
        {
          return this;
        }
      case 1:
        {
          const {
            code,
            multihash
          } = this;
          if (code !== DAG_PB_CODE) {
            throw new Error('Cannot convert a non dag-pb CID to CIDv0');
          }
          // sha2-256
          if (multihash.code !== SHA_256_CODE) {
            throw new Error('Cannot convert non sha2-256 multihash CID to CIDv0');
          }
          return CID.createV0(multihash);
        }
      default:
        {
          throw Error(`Can not convert CID version ${this.version} to version 0. This is a bug please report`);
        }
    }
  }
  toV1() {
    switch (this.version) {
      case 0:
        {
          const {
            code,
            digest
          } = this.multihash;
          const multihash = create(code, digest);
          return CID.createV1(this.code, multihash);
        }
      case 1:
        {
          return this;
        }
      default:
        {
          throw Error(`Can not convert CID version ${this.version} to version 1. This is a bug please report`);
        }
    }
  }
  equals(other) {
    return CID.equals(this, other);
  }
  static equals(self, other) {
    const unknown = other;
    return unknown != null && self.code === unknown.code && self.version === unknown.version && equals(self.multihash, unknown.multihash);
  }
  toString(base) {
    return format(this, base);
  }
  toJSON() {
    return {
      '/': format(this)
    };
  }
  link() {
    return this;
  }
  [Symbol.toStringTag] = 'CID';
  // Legacy
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `CID(${this.toString()})`;
  }
  /**
   * Takes any input `value` and returns a `CID` instance if it was
   * a `CID` otherwise returns `null`. If `value` is instanceof `CID`
   * it will return value back. If `value` is not instance of this CID
   * class, but is compatible CID it will return new instance of this
   * `CID` class. Otherwise returns null.
   *
   * This allows two different incompatible versions of CID library to
   * co-exist and interop as long as binary interface is compatible.
   */
  static asCID(input) {
    if (input == null) {
      return null;
    }
    const value = input;
    if (value instanceof CID) {
      // If value is instance of CID then we're all set.
      return value;
    } else if (value['/'] != null && value['/'] === value.bytes || value.asCID === value) {
      // If value isn't instance of this CID class but `this.asCID === this` or
      // `value['/'] === value.bytes` is true it is CID instance coming from a
      // different implementation (diff version or duplicate). In that case we
      // rebase it to this `CID` implementation so caller is guaranteed to get
      // instance with expected API.
      const {
        version,
        code,
        multihash,
        bytes
      } = value;
      return new CID(version, code, multihash, bytes ?? encodeCID(version, code, multihash.bytes));
    } else if (value[cidSymbol] === true) {
      // If value is a CID from older implementation that used to be tagged via
      // symbol we still rebase it to the this `CID` implementation by
      // delegating that to a constructor.
      const {
        version,
        multihash,
        code
      } = value;
      const digest = decode$1(multihash);
      return CID.create(version, code, digest);
    } else {
      // Otherwise value is not a CID (or an incompatible version of it) in
      // which case we return `null`.
      return null;
    }
  }
  /**
   * @param version - Version of the CID
   * @param code - Code of the codec content is encoded in, see https://github.com/multiformats/multicodec/blob/master/table.csv
   * @param digest - (Multi)hash of the of the content.
   */
  static create(version, code, digest) {
    if (typeof code !== 'number') {
      throw new Error('String codecs are no longer supported');
    }
    if (!(digest.bytes instanceof Uint8Array)) {
      throw new Error('Invalid digest');
    }
    switch (version) {
      case 0:
        {
          if (code !== DAG_PB_CODE) {
            throw new Error(`Version 0 CID must use dag-pb (code: ${DAG_PB_CODE}) block encoding`);
          } else {
            return new CID(version, code, digest, digest.bytes);
          }
        }
      case 1:
        {
          const bytes = encodeCID(version, code, digest.bytes);
          return new CID(version, code, digest, bytes);
        }
      default:
        {
          throw new Error('Invalid version');
        }
    }
  }
  /**
   * Simplified version of `create` for CIDv0.
   */
  static createV0(digest) {
    return CID.create(0, DAG_PB_CODE, digest);
  }
  /**
   * Simplified version of `create` for CIDv1.
   *
   * @param code - Content encoding format code.
   * @param digest - Multihash of the content.
   */
  static createV1(code, digest) {
    return CID.create(1, code, digest);
  }
  /**
   * Decoded a CID from its binary representation. The byte array must contain
   * only the CID with no additional bytes.
   *
   * An error will be thrown if the bytes provided do not contain a valid
   * binary representation of a CID.
   */
  static decode(bytes) {
    const [cid, remainder] = CID.decodeFirst(bytes);
    if (remainder.length !== 0) {
      throw new Error('Incorrect length');
    }
    return cid;
  }
  /**
   * Decoded a CID from its binary representation at the beginning of a byte
   * array.
   *
   * Returns an array with the first element containing the CID and the second
   * element containing the remainder of the original byte array. The remainder
   * will be a zero-length byte array if the provided bytes only contained a
   * binary CID representation.
   */
  static decodeFirst(bytes) {
    const specs = CID.inspectBytes(bytes);
    const prefixSize = specs.size - specs.multihashSize;
    const multihashBytes = coerce(bytes.subarray(prefixSize, prefixSize + specs.multihashSize));
    if (multihashBytes.byteLength !== specs.multihashSize) {
      throw new Error('Incorrect length');
    }
    const digestBytes = multihashBytes.subarray(specs.multihashSize - specs.digestSize);
    const digest = new Digest(specs.multihashCode, specs.digestSize, digestBytes, multihashBytes);
    const cid = specs.version === 0 ? CID.createV0(digest) : CID.createV1(specs.codec, digest);
    return [cid, bytes.subarray(specs.size)];
  }
  /**
   * Inspect the initial bytes of a CID to determine its properties.
   *
   * Involves decoding up to 4 varints. Typically this will require only 4 to 6
   * bytes but for larger multicodec code values and larger multihash digest
   * lengths these varints can be quite large. It is recommended that at least
   * 10 bytes be made available in the `initialBytes` argument for a complete
   * inspection.
   */
  static inspectBytes(initialBytes) {
    let offset = 0;
    const next = () => {
      const [i, length] = decode$2(initialBytes.subarray(offset));
      offset += length;
      return i;
    };
    let version = next();
    let codec = DAG_PB_CODE;
    if (version === 18) {
      // CIDv0
      version = 0;
      offset = 0;
    } else {
      codec = next();
    }
    if (version !== 0 && version !== 1) {
      throw new RangeError(`Invalid CID version ${version}`);
    }
    const prefixSize = offset;
    const multihashCode = next(); // multihash code
    const digestSize = next(); // multihash length
    const size = offset + digestSize;
    const multihashSize = size - prefixSize;
    return {
      version,
      codec,
      multihashCode,
      digestSize,
      multihashSize,
      size
    };
  }
  /**
   * Takes cid in a string representation and creates an instance. If `base`
   * decoder is not provided will use a default from the configuration. It will
   * throw an error if encoding of the CID is not compatible with supplied (or
   * a default decoder).
   */
  static parse(source, base) {
    const [prefix, bytes] = parseCIDtoBytes(source, base);
    const cid = CID.decode(bytes);
    if (cid.version === 0 && source[0] !== 'Q') {
      throw Error('Version 0 CID string must not include multibase prefix');
    }
    // Cache string representation to avoid computing it on `this.toString()`
    baseCache(cid).set(prefix, source);
    return cid;
  }
}
function parseCIDtoBytes(source, base) {
  switch (source[0]) {
    // CIDv0 is parsed differently
    case 'Q':
      {
        const decoder = base ?? base58btc;
        return [base58btc.prefix, decoder.decode(`${base58btc.prefix}${source}`)];
      }
    case base58btc.prefix:
      {
        const decoder = base ?? base58btc;
        return [base58btc.prefix, decoder.decode(source)];
      }
    case base32.prefix:
      {
        const decoder = base ?? base32;
        return [base32.prefix, decoder.decode(source)];
      }
    case base36.prefix:
      {
        const decoder = base ?? base36;
        return [base36.prefix, decoder.decode(source)];
      }
    default:
      {
        if (base == null) {
          throw Error('To parse non base32, base36 or base58btc encoded CID multibase decoder must be provided');
        }
        return [source[0], base.decode(source)];
      }
  }
}
function toStringV0(bytes, cache, base) {
  const {
    prefix
  } = base;
  if (prefix !== base58btc.prefix) {
    throw Error(`Cannot string encode V0 in ${base.name} encoding`);
  }
  const cid = cache.get(prefix);
  if (cid == null) {
    const cid = base.encode(bytes).slice(1);
    cache.set(prefix, cid);
    return cid;
  } else {
    return cid;
  }
}
function toStringV1(bytes, cache, base) {
  const {
    prefix
  } = base;
  const cid = cache.get(prefix);
  if (cid == null) {
    const cid = base.encode(bytes);
    cache.set(prefix, cid);
    return cid;
  } else {
    return cid;
  }
}
const DAG_PB_CODE = 0x70;
const SHA_256_CODE = 0x12;
function encodeCID(version, code, multihash) {
  const codeOffset = encodingLength(version);
  const hashOffset = codeOffset + encodingLength(code);
  const bytes = new Uint8Array(hashOffset + multihash.byteLength);
  encodeTo(version, bytes, 0);
  encodeTo(code, bytes, codeOffset);
  bytes.set(multihash, hashOffset);
  return bytes;
}
const cidSymbol = Symbol.for('@ipld/js-cid/CID');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var encode_1;
var hasRequiredEncode;
function requireEncode() {
  if (hasRequiredEncode) return encode_1;
  hasRequiredEncode = 1;
  encode_1 = encode;
  var MSB = 0x80,
    MSBALL = -128,
    INT = Math.pow(2, 31);
  function encode(num, out, offset) {
    if (Number.MAX_SAFE_INTEGER && num > Number.MAX_SAFE_INTEGER) {
      encode.bytes = 0;
      throw new RangeError('Could not encode varint');
    }
    out = out || [];
    offset = offset || 0;
    var oldOffset = offset;
    while (num >= INT) {
      out[offset++] = num & 0xFF | MSB;
      num /= 128;
    }
    while (num & MSBALL) {
      out[offset++] = num & 0xFF | MSB;
      num >>>= 7;
    }
    out[offset] = num | 0;
    encode.bytes = offset - oldOffset + 1;
    return out;
  }
  return encode_1;
}

var decode;
var hasRequiredDecode;
function requireDecode() {
  if (hasRequiredDecode) return decode;
  hasRequiredDecode = 1;
  decode = read;
  var MSB = 0x80,
    REST = 0x7F;
  function read(buf, offset) {
    var res = 0,
      offset = offset || 0,
      shift = 0,
      counter = offset,
      b,
      l = buf.length;
    do {
      if (counter >= l || shift > 49) {
        read.bytes = 0;
        throw new RangeError('Could not decode varint');
      }
      b = buf[counter++];
      res += shift < 28 ? (b & REST) << shift : (b & REST) * Math.pow(2, shift);
      shift += 7;
    } while (b >= MSB);
    read.bytes = counter - offset;
    return res;
  }
  return decode;
}

var length;
var hasRequiredLength;
function requireLength() {
  if (hasRequiredLength) return length;
  hasRequiredLength = 1;
  var N1 = Math.pow(2, 7);
  var N2 = Math.pow(2, 14);
  var N3 = Math.pow(2, 21);
  var N4 = Math.pow(2, 28);
  var N5 = Math.pow(2, 35);
  var N6 = Math.pow(2, 42);
  var N7 = Math.pow(2, 49);
  var N8 = Math.pow(2, 56);
  var N9 = Math.pow(2, 63);
  length = function (value) {
    return value < N1 ? 1 : value < N2 ? 2 : value < N3 ? 3 : value < N4 ? 4 : value < N5 ? 5 : value < N6 ? 6 : value < N7 ? 7 : value < N8 ? 8 : value < N9 ? 9 : 10;
  };
  return length;
}

var varint$1;
var hasRequiredVarint;
function requireVarint() {
  if (hasRequiredVarint) return varint$1;
  hasRequiredVarint = 1;
  varint$1 = {
    encode: requireEncode(),
    decode: requireDecode(),
    encodingLength: requireLength()
  };
  return varint$1;
}

var varintExports = requireVarint();
var varint = /*@__PURE__*/getDefaultExportFromCjs(varintExports);

const CIDV0_BYTES = {
  SHA2_256: 0x12,
  LENGTH: 0x20,
  DAG_PB: 0x70
};
const V2_HEADER_LENGTH = /* characteristics */16 /* v1 offset */ + 8 /* v1 size */ + 8 /* index offset */ + 8;

/**
 * Decodes varint and seeks the buffer
 *
 * ```js
 * // needs bytes to be read first
 * const bytes = reader.upTo(8) // maybe async
 * ```
 *
 * @param {Uint8Array} bytes
 * @param {import('./coding').Seekable} seeker
 * @returns {number}
 */
function decodeVarint(bytes, seeker) {
  if (!bytes.length) {
    throw new Error('Unexpected end of data');
  }
  const i = varint.decode(bytes);
  seeker.seek(/** @type {number} */varint.decode.bytes);
  return i;
}

/**
 * Decode v2 header
 *
 * ```js
 * // needs bytes to be read first
 * const bytes = reader.exactly(V2_HEADER_LENGTH, true) // maybe async
 * ```
 *
 * @param {Uint8Array} bytes
 * @returns {import('./coding').CarV2FixedHeader}
 */
function decodeV2Header(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const header = {
    version: 2,
    /** @type {[bigint, bigint]} */
    characteristics: [dv.getBigUint64(offset, true), dv.getBigUint64(offset += 8, true)],
    dataOffset: Number(dv.getBigUint64(offset += 8, true)),
    dataSize: Number(dv.getBigUint64(offset += 8, true)),
    indexOffset: Number(dv.getBigUint64(offset += 8, true))
  };
  return header;
}

/**
 * Checks the length of the multihash to be read afterwards
 *
 * ```js
 * // needs bytes to be read first
 * const bytes = reader.upTo(8) // maybe async
 * ```
 *
 * @param {Uint8Array} bytes
 */
function getMultihashLength(bytes) {
  // | code | length | .... |
  // where both code and length are varints, so we have to decode
  // them first before we can know total length

  varint.decode(bytes); // code
  const codeLength = /** @type {number} */varint.decode.bytes;
  const length = varint.decode(bytes.subarray(varint.decode.bytes));
  const lengthLength = /** @type {number} */varint.decode.bytes;
  const mhLength = codeLength + lengthLength + length;
  return mhLength;
}

/** Auto-generated with @ipld/schema@v4.2.0 at Thu Sep 14 2023 from IPLD Schema:
 *
 * # CarV1HeaderOrV2Pragma is a more relaxed form, and can parse {version:x} where
 * # roots are optional. This is typically useful for the {verison:2} CARv2
 * # pragma.
 *
 * type CarV1HeaderOrV2Pragma struct {
 * 	roots optional [&Any]
 * 	# roots is _not_ optional for CarV1 but we defer that check within code to
 * 	# gracefully handle the V2 case where it's just {version:X}
 * 	version Int
 * }
 *
 * # CarV1Header is the strict form of the header, and requires roots to be
 * # present. This is compatible with the CARv1 specification.
 *
 * # type CarV1Header struct {
 * # 	roots [&Any]
 * # 	version Int
 * # }
 *
 */

const Kinds = {
  Null: /** @returns {undefined|null} */(/** @type {any} */obj) => obj === null ? obj : undefined,
  Int: /** @returns {undefined|number} */(/** @type {any} */obj) => Number.isInteger(obj) ? obj : undefined,
  Float: /** @returns {undefined|number} */(/** @type {any} */obj) => typeof obj === 'number' && Number.isFinite(obj) ? obj : undefined,
  String: /** @returns {undefined|string} */(/** @type {any} */obj) => typeof obj === 'string' ? obj : undefined,
  Bool: /** @returns {undefined|boolean} */(/** @type {any} */obj) => typeof obj === 'boolean' ? obj : undefined,
  Bytes: /** @returns {undefined|Uint8Array} */(/** @type {any} */obj) => obj instanceof Uint8Array ? obj : undefined,
  Link: /** @returns {undefined|object} */(/** @type {any} */obj) => obj !== null && typeof obj === 'object' && obj.asCID === obj ? obj : undefined,
  List: /** @returns {undefined|Array<any>} */(/** @type {any} */obj) => Array.isArray(obj) ? obj : undefined,
  Map: /** @returns {undefined|object} */(/** @type {any} */obj) => obj !== null && typeof obj === 'object' && obj.asCID !== obj && !Array.isArray(obj) && !(obj instanceof Uint8Array) ? obj : undefined
};
/** @type {{ [k in string]: (obj:any)=>undefined|any}} */
const Types = {
  'CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)': Kinds.Link,
  'CarV1HeaderOrV2Pragma > roots (anon)': /** @returns {undefined|any} */(/** @type {any} */obj) => {
    if (Kinds.List(obj) === undefined) {
      return undefined;
    }
    for (let i = 0; i < obj.length; i++) {
      let v = obj[i];
      v = Types['CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)'](v);
      if (v === undefined) {
        return undefined;
      }
      if (v !== obj[i]) {
        const ret = obj.slice(0, i);
        for (let j = i; j < obj.length; j++) {
          let v = obj[j];
          v = Types['CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)'](v);
          if (v === undefined) {
            return undefined;
          }
          ret.push(v);
        }
        return ret;
      }
    }
    return obj;
  },
  Int: Kinds.Int,
  CarV1HeaderOrV2Pragma: /** @returns {undefined|any} */(/** @type {any} */obj) => {
    if (Kinds.Map(obj) === undefined) {
      return undefined;
    }
    const entries = Object.entries(obj);
    /** @type {{[k in string]: any}} */
    let ret = obj;
    let requiredCount = 1;
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      switch (key) {
        case 'roots':
          {
            const v = Types['CarV1HeaderOrV2Pragma > roots (anon)'](obj[key]);
            if (v === undefined) {
              return undefined;
            }
            if (v !== value || ret !== obj) {
              if (ret === obj) {
                /** @type {{[k in string]: any}} */
                ret = {};
                for (let j = 0; j < i; j++) {
                  ret[entries[j][0]] = entries[j][1];
                }
              }
              ret.roots = v;
            }
          }
          break;
        case 'version':
          {
            requiredCount--;
            const v = Types.Int(obj[key]);
            if (v === undefined) {
              return undefined;
            }
            if (v !== value || ret !== obj) {
              if (ret === obj) {
                /** @type {{[k in string]: any}} */
                ret = {};
                for (let j = 0; j < i; j++) {
                  ret[entries[j][0]] = entries[j][1];
                }
              }
              ret.version = v;
            }
          }
          break;
        default:
          return undefined;
      }
    }
    if (requiredCount > 0) {
      return undefined;
    }
    return ret;
  }
};
/** @type {{ [k in string]: (obj:any)=>undefined|any}} */
const Reprs = {
  'CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)': Kinds.Link,
  'CarV1HeaderOrV2Pragma > roots (anon)': /** @returns {undefined|any} */(/** @type {any} */obj) => {
    if (Kinds.List(obj) === undefined) {
      return undefined;
    }
    for (let i = 0; i < obj.length; i++) {
      let v = obj[i];
      v = Reprs['CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)'](v);
      if (v === undefined) {
        return undefined;
      }
      if (v !== obj[i]) {
        const ret = obj.slice(0, i);
        for (let j = i; j < obj.length; j++) {
          let v = obj[j];
          v = Reprs['CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)'](v);
          if (v === undefined) {
            return undefined;
          }
          ret.push(v);
        }
        return ret;
      }
    }
    return obj;
  },
  Int: Kinds.Int,
  CarV1HeaderOrV2Pragma: /** @returns {undefined|any} */(/** @type {any} */obj) => {
    if (Kinds.Map(obj) === undefined) {
      return undefined;
    }
    const entries = Object.entries(obj);
    /** @type {{[k in string]: any}} */
    let ret = obj;
    let requiredCount = 1;
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      switch (key) {
        case 'roots':
          {
            const v = Reprs['CarV1HeaderOrV2Pragma > roots (anon)'](value);
            if (v === undefined) {
              return undefined;
            }
            if (v !== value || ret !== obj) {
              if (ret === obj) {
                /** @type {{[k in string]: any}} */
                ret = {};
                for (let j = 0; j < i; j++) {
                  ret[entries[j][0]] = entries[j][1];
                }
              }
              ret.roots = v;
            }
          }
          break;
        case 'version':
          {
            requiredCount--;
            const v = Reprs.Int(value);
            if (v === undefined) {
              return undefined;
            }
            if (v !== value || ret !== obj) {
              if (ret === obj) {
                /** @type {{[k in string]: any}} */
                ret = {};
                for (let j = 0; j < i; j++) {
                  ret[entries[j][0]] = entries[j][1];
                }
              }
              ret.version = v;
            }
          }
          break;
        default:
          return undefined;
      }
    }
    if (requiredCount > 0) {
      return undefined;
    }
    return ret;
  }
};
const CarV1HeaderOrV2Pragma = {
  toTyped: Types.CarV1HeaderOrV2Pragma,
  toRepresentation: Reprs.CarV1HeaderOrV2Pragma
};

/**
 * @typedef {import('./api').Block} Block
 * @typedef {import('./api').BlockHeader} BlockHeader
 * @typedef {import('./api').BlockIndex} BlockIndex
 * @typedef {import('./coding').BytesBufferReader} BytesBufferReader
 * @typedef {import('./coding').CarHeader} CarHeader
 * @typedef {import('./coding').CarV2Header} CarV2Header
 * @typedef {import('./coding').CarV2FixedHeader} CarV2FixedHeader
 */

/**
 * Reads header data from a `BytesReader`. The header may either be in the form
 * of a `CarHeader` or `CarV2Header` depending on the CAR being read.
 *
 * @name decoder.readHeader(reader)
 * @param {BytesBufferReader} reader
 * @param {number} [strictVersion]
 * @returns {CarHeader | CarV2Header}
 */
function readHeader(reader, strictVersion) {
  const length = decodeVarint(reader.upTo(8), reader);
  if (length === 0) {
    throw new Error('Invalid CAR header (zero length)');
  }
  const header = reader.exactly(length, true);
  const block = decode$5(header);
  if (CarV1HeaderOrV2Pragma.toTyped(block) === undefined) {
    throw new Error('Invalid CAR header format');
  }
  if (block.version !== 1 && block.version !== 2 || strictVersion !== undefined && block.version !== strictVersion) {
    throw new Error(`Invalid CAR version: ${block.version}${strictVersion !== undefined ? ` (expected ${strictVersion})` : ''}`);
  }
  if (block.version === 1) {
    // CarV1HeaderOrV2Pragma makes roots optional, let's make it mandatory
    if (!Array.isArray(block.roots)) {
      throw new Error('Invalid CAR header format');
    }
    return block;
  }
  // version 2
  if (block.roots !== undefined) {
    throw new Error('Invalid CAR header format');
  }
  const v2Header = decodeV2Header(reader.exactly(V2_HEADER_LENGTH, true));
  reader.seek(v2Header.dataOffset - reader.pos);
  const v1Header = readHeader(reader, 1);
  return Object.assign(v1Header, v2Header);
}

/**
 * Reads CID sync
 *
 * @param {BytesBufferReader} reader
 * @returns {CID}
 */
function readCid(reader) {
  const first = reader.exactly(2, false);
  if (first[0] === CIDV0_BYTES.SHA2_256 && first[1] === CIDV0_BYTES.LENGTH) {
    // cidv0 32-byte sha2-256
    const bytes = reader.exactly(34, true);
    const multihash = decode$1(bytes);
    return CID.create(0, CIDV0_BYTES.DAG_PB, multihash);
  }
  const version = decodeVarint(reader.upTo(8), reader);
  if (version !== 1) {
    throw new Error(`Unexpected CID version (${version})`);
  }
  const codec = decodeVarint(reader.upTo(8), reader);
  const bytes = reader.exactly(getMultihashLength(reader.upTo(8)), true);
  const multihash = decode$1(bytes);
  return CID.create(version, codec, multihash);
}

/**
 * Reads the leading data of an individual block from CAR data from a
 * `BytesBufferReader`. Returns a `BlockHeader` object which contains
 * `{ cid, length, blockLength }` which can be used to either index the block
 * or read the block binary data.
 *
 * @name async decoder.readBlockHead(reader)
 * @param {BytesBufferReader} reader
 * @returns {BlockHeader}
 */
function readBlockHead(reader) {
  // length includes a CID + Binary, where CID has a variable length
  // we have to deal with
  const start = reader.pos;
  let length = decodeVarint(reader.upTo(8), reader);
  if (length === 0) {
    throw new Error('Invalid CAR section (zero length)');
  }
  length += reader.pos - start;
  const cid = readCid(reader);
  const blockLength = length - Number(reader.pos - start); // subtract CID length

  return {
    cid,
    length,
    blockLength
  };
}

/**
 * Returns Car header and blocks from a Uint8Array
 *
 * @param {Uint8Array} bytes
 * @returns {{ header : CarHeader | CarV2Header , blocks: Block[]}}
 */
function fromBytes(bytes) {
  let reader = bytesReader(bytes);
  const header = readHeader(reader);
  if (header.version === 2) {
    const v1length = reader.pos - header.dataOffset;
    reader = limitReader(reader, header.dataSize - v1length);
  }
  const blocks = [];
  while (reader.upTo(8).length > 0) {
    const {
      cid,
      blockLength
    } = readBlockHead(reader);
    blocks.push({
      cid,
      bytes: reader.exactly(blockLength, true)
    });
  }
  return {
    header,
    blocks
  };
}

/**
 * Creates a `BytesBufferReader` from a `Uint8Array`.
 *
 * @name decoder.bytesReader(bytes)
 * @param {Uint8Array} bytes
 * @returns {BytesBufferReader}
 */
function bytesReader(bytes) {
  let pos = 0;

  /** @type {BytesBufferReader} */
  return {
    upTo(length) {
      return bytes.subarray(pos, pos + Math.min(length, bytes.length - pos));
    },
    exactly(length, seek = false) {
      if (length > bytes.length - pos) {
        throw new Error('Unexpected end of data');
      }
      const out = bytes.subarray(pos, pos + length);
      if (seek) {
        pos += length;
      }
      return out;
    },
    seek(length) {
      pos += length;
    },
    get pos() {
      return pos;
    }
  };
}

/**
 * Wraps a `BytesBufferReader` in a limiting `BytesBufferReader` which limits maximum read
 * to `byteLimit` bytes. It _does not_ update `pos` of the original
 * `BytesBufferReader`.
 *
 * @name decoder.limitReader(reader, byteLimit)
 * @param {BytesBufferReader} reader
 * @param {number} byteLimit
 * @returns {BytesBufferReader}
 */
function limitReader(reader, byteLimit) {
  let bytesRead = 0;

  /** @type {BytesBufferReader} */
  return {
    upTo(length) {
      let bytes = reader.upTo(length);
      if (bytes.length + bytesRead > byteLimit) {
        bytes = bytes.subarray(0, byteLimit - bytesRead);
      }
      return bytes;
    },
    exactly(length, seek = false) {
      const bytes = reader.exactly(length, seek);
      if (bytes.length + bytesRead > byteLimit) {
        throw new Error('Unexpected end of data');
      }
      if (seek) {
        bytesRead += length;
      }
      return bytes;
    },
    seek(length) {
      bytesRead += length;
      reader.seek(length);
    },
    get pos() {
      return reader.pos;
    }
  };
}

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('./api').Block} Block
 * @typedef {import('./api').CarBufferReader} ICarBufferReader
 * @typedef {import('./coding').CarHeader} CarHeader
 * @typedef {import('./coding').CarV2Header} CarV2Header
 */

/**
 * Provides blockstore-like access to a CAR.
 *
 * Implements the `RootsBufferReader` interface:
 * {@link ICarBufferReader.getRoots `getRoots()`}. And the `BlockBufferReader` interface:
 * {@link ICarBufferReader.get `get()`}, {@link ICarBufferReader.has `has()`},
 * {@link ICarBufferReader.blocks `blocks()`} and
 * {@link ICarBufferReader.cids `cids()`}.
 *
 * Load this class with either `import { CarBufferReader } from '@ipld/car/buffer-reader'`
 * (`const { CarBufferReader } = require('@ipld/car/buffer-reader')`). Or
 * `import { CarBufferReader } from '@ipld/car'` (`const { CarBufferReader } = require('@ipld/car')`).
 * The former will likely result in smaller bundle sizes where this is
 * important.
 *
 * @name CarBufferReader
 * @class
 * @implements {ICarBufferReader}
 * @property {number} version The version number of the CAR referenced by this
 * reader (should be `1` or `2`).
 */
class CarBufferReader {
  /**
   * @constructs CarBufferReader
   * @param {CarHeader|CarV2Header} header
   * @param {Block[]} blocks
   */
  constructor(header, blocks) {
    this._header = header;
    this._blocks = blocks;
    this._cids = undefined;
  }

  /**
   * @property version
   * @memberof CarBufferReader
   * @instance
   */
  get version() {
    return this._header.version;
  }

  /**
   * Get the list of roots defined by the CAR referenced by this reader. May be
   * zero or more `CID`s.
   *
   * @function
   * @memberof CarBufferReader
   * @instance
   * @returns {CID[]}
   */
  getRoots() {
    return this._header.roots;
  }

  /**
   * Check whether a given `CID` exists within the CAR referenced by this
   * reader.
   *
   * @function
   * @memberof CarBufferReader
   * @instance
   * @param {CID} key
   * @returns {boolean}
   */
  has(key) {
    return this._blocks.some(b => b.cid.equals(key));
  }

  /**
   * Fetch a `Block` (a `{ cid:CID, bytes:Uint8Array }` pair) from the CAR
   * referenced by this reader matching the provided `CID`. In the case where
   * the provided `CID` doesn't exist within the CAR, `undefined` will be
   * returned.
   *
   * @function
   * @memberof CarBufferReader
   * @instance
   * @param {CID} key
   * @returns {Block | undefined}
   */
  get(key) {
    return this._blocks.find(b => b.cid.equals(key));
  }

  /**
   * Returns a `Block[]` of the `Block`s (`{ cid:CID, bytes:Uint8Array }` pairs) contained within
   * the CAR referenced by this reader.
   *
   * @function
   * @memberof CarBufferReader
   * @instance
   * @returns {Block[]}
   */
  blocks() {
    return this._blocks;
  }

  /**
   * Returns a `CID[]` of the `CID`s contained within the CAR referenced by this reader.
   *
   * @function
   * @memberof CarBufferReader
   * @instance
   * @returns {CID[]}
   */
  cids() {
    if (!this._cids) {
      this._cids = this._blocks.map(b => b.cid);
    }
    return this._cids;
  }

  /**
   * Instantiate a {@link CarBufferReader} from a `Uint8Array` blob. This performs a
   * decode fully in memory and maintains the decoded state in memory for full
   * access to the data via the `CarReader` API.
   *
   * @static
   * @memberof CarBufferReader
   * @param {Uint8Array} bytes
   * @returns {CarBufferReader}
   */
  static fromBytes(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('fromBytes() requires a Uint8Array');
    }
    const {
      header,
      blocks
    } = fromBytes(bytes);
    return new CarBufferReader(header, blocks);
  }
}

// @ts-check


/**
 * @typedef {{
 *   receiveTimestamp: number,
 *   since: string,
 *   time: string,
 *   messages: FirehoseRecord[],
 *   deletes?: FirehoseRecord[],
 *   unexpected?: FirehoseRecord[],
 *   error?: { message: string, [prop: string]: any }[],
 *   parseTime: number
 * }} FirehoseBlock
 */

/**
 * @typedef {{
 *  'app.bsky.feed.like': import('@atproto/api').AppBskyFeedLike.Record,
 *  'app.bsky.feed.post': import('@atproto/api').AppBskyFeedPost.Record,
 *  'app.bsky.feed.repost': import('@atproto/api').AppBskyFeedRepost.Record,
 *  'app.bsky.feed.threadgate': import('@atproto/api').AppBskyFeedThreadgate.Record,
 *  'app.bsky.graph.follow': import('@atproto/api').AppBskyGraphFollow.Record,
 *  'app.bsky.graph.block': import('@atproto/api').AppBskyGraphBlock.Record,
 *  'app.bsky.graph.list': import('@atproto/api').AppBskyGraphList.Record,
 *  'app.bsky.graph.listitem': import('@atproto/api').AppBskyGraphListitem.Record,
 *  'app.bsky.graph.listblock': import('@atproto/api').AppBskyGraphListblock.Record,
 *  'app.bsky.actor.profile': import('@atproto/api').AppBskyActorProfile.Record
 *  'app.bsky.feed.generator': import('@atproto/api').AppBskyFeedGenerator.Record
 *  'app.bsky.feed.postgate': import('@atproto/api').AppBskyFeedPostgate.Record
 *  'chat.bsky.actor.declaration': import('@atproto/api').ChatBskyActorDeclaration.Record,
 *  'app.bsky.graph.starterpack': import('@atproto/api').AppBskyGraphStarterpack.Record
 * }} RepoRecord$Typed
 */

/**
 * @template {keyof RepoRecord$Typed} $Type
 * @typedef {{ repo: string, uri: string, action: 'create' | 'delete' | 'update', path: string, $type: $Type } &
 *  RepoRecord$Typed[$Type]
 * } FirehoseRecord$Typed
 */

/**
 * @typedef {FirehoseRecord$Typed<'app.bsky.feed.like'> |
 * FirehoseRecord$Typed<'app.bsky.feed.post'> |
 * FirehoseRecord$Typed<'app.bsky.feed.repost'> |
 * FirehoseRecord$Typed<'app.bsky.feed.threadgate'> |
 * FirehoseRecord$Typed<'app.bsky.graph.follow'> |
 * FirehoseRecord$Typed<'app.bsky.graph.block'> |
 * FirehoseRecord$Typed<'app.bsky.graph.list'> |
 * FirehoseRecord$Typed<'app.bsky.graph.listitem'> |
 * FirehoseRecord$Typed<'app.bsky.graph.listblock'> |
 * FirehoseRecord$Typed<'app.bsky.actor.profile'> |
 * FirehoseRecord$Typed<'app.bsky.feed.generator'> |
 * FirehoseRecord$Typed<'app.bsky.feed.postgate'> |
 * FirehoseRecord$Typed<'chat.bsky.actor.declaration'> |
 * FirehoseRecord$Typed<'app.bsky.graph.starterpack'>
 * } FirehoseRecord
 */

const known$Types = ['app.bsky.feed.like', 'app.bsky.feed.post', 'app.bsky.feed.repost', 'app.bsky.feed.threadgate', 'app.bsky.graph.follow', 'app.bsky.graph.block', 'app.bsky.graph.list', 'app.bsky.graph.listitem', 'app.bsky.graph.listblock', 'app.bsky.actor.profile', 'app.bsky.feed.generator', 'app.bsky.feed.postgate', 'chat.bsky.actor.declaration', 'app.bsky.graph.starterpack'];
firehose.knownTypes = known$Types;
let cbor_x_extended = false;
async function* firehoseRecords() {
  for await (const {
    messages,
    deletes,
    unexpected,
    ...rest
  } of firehose()) {
    if (deletes?.length) {
      for (const record of deletes) {
        yield {
          ...rest,
          action: 'delete',
          record
        };
      }
    }
    if (!messages.length) continue;
    for (const record of messages) {
      yield {
        ...rest,
        record
      };
    }
    for (const record of unexpected || []) {
      yield {
        ...rest,
        action: 'unexpected',
        record
      };
    }
  }
}
function requireWebsocket() {
  const globalObj = typeof global !== 'undefined' && global || typeof globalThis !== 'undefined' && globalThis;
  const requireFn = globalObj?.['require'];
  if (typeof requireFn === 'function') return /** @type {typeof WebSocket} */requireFn('ws');
  throw new Error('WebSocket not available');
}

/**
 * @returns {AsyncGenerator<FirehoseBlock, void, void>}
 */
async function* firehose() {
  ensureCborXExtended();

  /** @type {typeof WebSocket} */
  const WebSocketImpl = typeof WebSocket === 'function' ? WebSocket : requireWebsocket();
  const wsAddress = 'wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos';
  const ws = new WebSocketImpl(wsAddress);
  ws.binaryType = 'arraybuffer';
  ws.addEventListener('message', handleMessage);
  ws.addEventListener('error', handleError);
  ws.addEventListener('close', handleClose);
  let buf = createAwaitPromise();
  let closed = false;
  try {
    while (true) {
      await buf.promise;
      const block = buf.block;
      buf = createAwaitPromise();
      if (closed) {
        if (block.messages.length || block.deletes?.length || block.unexpected?.length) yield block;
        break;
      }
      yield block;
    }
  } finally {
    if (!closed) {
      try {
        ws.close();
      } catch (error) {}
    }
  }
  function handleClose() {
    closed = true;
    buf.resolve();
  }
  function handleMessage(event) {
    const receiveTimestamp = Date.now();
    buf.block.receiveTimestamp = receiveTimestamp;
    if (typeof event.data?.byteLength === 'number') {
      parseMessageBufAndResolve(event.data);
    } else if (typeof event.data?.arrayBuffer === 'function') {
      event.data.arrayBuffer().then(parseMessageBufAndResolve);
    } else {
      addBufError('WebSocket message type not supported ' + typeof event.data);
      buf.resolve();
    }
  }
  function parseMessageBufAndResolve(messageBuf) {
    parseMessageBuf(messageBuf);
    buf.resolve();
  }
  function parseMessageBuf(messageBuf) {
    try {
      parseMessageBufWorker(messageBuf);
      buf.resolve();
    } catch (parseError) {
      addBufError(parseError.message);
    }
    buf.resolve();
  }

  /**
   * @param {ArrayBuffer} messageBuf
   */
  function parseMessageBufWorker(messageBuf) {
    const parseStart = Date.now();
    const entry = /** @type {any[]} */decodeMultiple(new Uint8Array(messageBuf));
    if (!entry) return addBufError('CBOR decodeMultiple returned empty.');
    if (entry[0]?.op !== 1) return addBufError('Expected CBOR op:1, received:' + entry[0]?.op);
    const commit = entry[1];
    if (!commit.blocks) return addBufError('Expected operation with commit.blocks, received ' + commit.blocks);
    if (!commit.ops?.length) return addBufError('Expected operation with commit.ops, received ' + commit.ops);
    const car = CarBufferReader.fromBytes(commit.blocks);
    if (!buf.block.since) buf.block.since = commit.since;
    buf.block.time = commit.time;
    let opIndex = 0;
    for (const op of commit.ops) {
      opIndex++;
      if (!op.cid) {
        addBufError('Missing commit[' + (opIndex - 1) + '].op.cid: ' + op.cid);
        continue;
      }
      const block = car.get(/** @type {*} */op.cid);
      if (!block) {
        addBufError('Unresolvable commit[' + (opIndex - 1) + '].op.cid: ' + op.cid);
        continue;
      }
      const record = decode$f(block.bytes);
      // record.seq = commit.seq; 471603945
      // record.since = /** @type {string} */(commit.since); 3ksfhcmgghv2g
      // record.action = op.action;
      // record.cid = cid;
      // record.path = op.path;
      // record.timestamp = commit.time ? Date.parse(commit.time) : Date.now(); 2024-05-13T19:59:10.457Z

      record.repo = commit.repo;
      record.uri = 'at://' + commit.repo + '/' + op.path;
      record.action = op.action;
      let unexpected = op.action !== 'create' && op.action !== 'update' && op.action !== 'delete' || known$Types.indexOf(record.$type) < 0;
      if (unexpected) {
        console.warn('unexpected ', record);
        if (!buf.block.unexpected) buf.block.unexpected = [];
        buf.block.unexpected.push(record);
      } else if (op.action === 'delete') {
        if (!buf.block.deletes) buf.block.deletes = [];
        buf.block.deletes.push(record);
      } else {
        buf.block.messages.push(record);
      }
      buf.block.parseTime += Date.now() - parseStart;
    }
  }

  /**
   * @param {string} errorStr
   */
  function addBufError(errorStr) {
    if (!buf.block.error) buf.block.error = [];
    buf.block.error.push({
      message: errorStr
    });
  }
  function handleError(error) {
    console.error(error);
    const errorText = error.message || 'WebSocket error ' + error;
    buf.reject(new Error(errorText));
  }
}

/** @returns {{
 *  block: FirehoseBlock,
 *  resolve: () => void,
 *  reject: (reason?: any) => void,
 *  promise: Promise<void>
 * }} */
function createAwaitPromise() {
  const result = {
    /** @type {FirehoseBlock} */
    block: {
      receiveTimestamp: 0,
      since: '',
      time: '',
      messages: [],
      parseTime: 0
    }
  };
  result.promise = new Promise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return /** @type {*} */result;
}
function ensureCborXExtended() {
  if (cbor_x_extended) return;
  addExtension({
    Class: CID$2,
    tag: 42,
    encode: () => {
      throw new Error("cannot encode cids");
    },
    decode: bytes => {
      if (bytes[0] !== 0) throw new Error("invalid cid for cbor tag 42");
      return CID$2.decode(bytes.subarray(1)); // ignore leading 0x00
    }
  });
  cbor_x_extended = true;
}

export { ensureCborXExtended, firehose, firehoseRecords, known$Types };
//# sourceMappingURL=firehose.js.map
