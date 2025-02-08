new TextEncoder();
const textDecoder = new TextDecoder();
/**
 * creates an Uint8Array of the requested size, with the contents zeroed
 */
const alloc = size => {
  return new Uint8Array(size);
};
/**
 * creates an Uint8Array of the requested size, where the contents may not be
 * zeroed out. only use if you're certain that the contents will be overwritten
 */
const allocUnsafe = alloc;
/**
 * decodes a UTF-8 string from a buffer
 */
const decodeUtf8From = (from, offset, length) => {
  let buffer;
  if (offset === undefined) {
    buffer = from;
  } else if (length === undefined) {
    buffer = from.subarray(offset);
  } else {
    buffer = from.subarray(offset, offset + length);
  }
  const result = textDecoder.decode(buffer);
  return result;
};

const createRfc4648Encode = (alphabet, bitsPerChar, pad) => {
  return bytes => {
    const mask = (1 << bitsPerChar) - 1;
    let str = '';
    let bits = 0; // Number of bits currently in the buffer
    let buffer = 0; // Bits waiting to be written out, MSB first
    for (let i = 0; i < bytes.length; ++i) {
      // Slurp data into the buffer:
      buffer = buffer << 8 | bytes[i];
      bits += 8;
      // Write out as much as we can:
      while (bits > bitsPerChar) {
        bits -= bitsPerChar;
        str += alphabet[mask & buffer >> bits];
      }
    }
    // Partial character:
    if (bits !== 0) {
      str += alphabet[mask & buffer << bitsPerChar - bits];
    }
    // Add padding characters until we hit a byte boundary:
    if (pad) {
      while ((str.length * bitsPerChar & 7) !== 0) {
        str += '=';
      }
    }
    return str;
  };
};
const createRfc4648Decode = (alphabet, bitsPerChar, pad) => {
  // Build the character lookup table:
  const codes = {};
  for (let i = 0; i < alphabet.length; ++i) {
    codes[alphabet[i]] = i;
  }
  return str => {
    // Count the padding bytes:
    let end = str.length;
    while (pad && str[end - 1] === '=') {
      --end;
    }
    // Allocate the output:
    const bytes = allocUnsafe(end * bitsPerChar / 8 | 0);
    // Parse the data:
    let bits = 0; // Number of bits currently in the buffer
    let buffer = 0; // Bits waiting to be written out, MSB first
    let written = 0; // Next byte to write
    for (let i = 0; i < end; ++i) {
      // Read one character from the string:
      const value = codes[str[i]];
      if (value === undefined) {
        throw new SyntaxError(`invalid base string`);
      }
      // Append the bits to the buffer:
      buffer = buffer << bitsPerChar | value;
      bits += bitsPerChar;
      // Write out some bits if the buffer has a byte's worth:
      if (bits >= 8) {
        bits -= 8;
        bytes[written++] = 0xff & buffer >> bits;
      }
    }
    // Verify that we have received just enough bits:
    if (bits >= bitsPerChar || (0xff & buffer << 8 - bits) !== 0) {
      throw new SyntaxError('unexpected end of data');
    }
    return bytes;
  };
};

const HAS_UINT8_BASE64_SUPPORT = 'fromBase64' in Uint8Array;
const BASE64_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const WS_PAD_RE = /[\s=]/;
// #region base64
/** @internal */
const _fromBase64Polyfill = /*#__PURE__*/createRfc4648Decode(BASE64_CHARSET, 6, false);
/** @internal */
const _toBase64Polyfill = /*#__PURE__*/createRfc4648Encode(BASE64_CHARSET, 6, false);
/** @internal */
const _fromBase64Native = str => {
  if (str.length % 4 === 1 || WS_PAD_RE.test(str)) {
    throw new SyntaxError(`invalid base64 string`);
  }
  return Uint8Array.fromBase64(str, {
    alphabet: 'base64',
    lastChunkHandling: 'loose'
  });
};
/** @internal */
const _toBase64Native = bytes => {
  return bytes.toBase64({
    alphabet: 'base64',
    omitPadding: true
  });
};
const fromBase64 = !HAS_UINT8_BASE64_SUPPORT ? _fromBase64Polyfill : _fromBase64Native;
const toBase64 = !HAS_UINT8_BASE64_SUPPORT ? _toBase64Polyfill : _toBase64Native;
// #endregion

const BASE32_CHARSET = 'abcdefghijklmnopqrstuvwxyz234567';
const toBase32 = /*#__PURE__*/createRfc4648Encode(BASE32_CHARSET, 5, false);

const MSB = 0x80;
const REST = 0x7f;
/**
 * Decodes a varint
 * @param buf Buffer to read from
 * @param offset Starting position on the buffer
 * @returns A tuple containing the resulting number, and the amount of bytes read
 */
const decode$1 = (buf, offset = 0) => {
  // deno-lint-ignore prefer-const
  let l = buf.length;
  let res = 0;
  let shift = 0;
  let counter = offset;
  let b;
  do {
    if (counter >= l) {
      throw new RangeError('could not decode varint');
    }
    b = buf[counter++];
    res += shift < 28 ? (b & REST) << shift : (b & REST) * Math.pow(2, shift);
    shift += 7;
  } while (b >= MSB);
  return [res, counter - offset];
};

const CID_VERSION = 1;
const HASH_SHA256 = 0x12;
const CODEC_RAW = 0x55;
const CODEC_DCBOR = 0x71;

class CidLinkWrapper {
  bytes;
  constructor(bytes) {
    this.bytes = bytes;
  }
  get $link() {
    const encoded = toBase32(this.bytes);
    return `b${encoded}`;
  }
  toJSON() {
    return {
      $link: this.$link
    };
  }
}
const toCidLink = cid => {
  return new CidLinkWrapper(cid.bytes);
};

class BytesWrapper {
  buf;
  constructor(buf) {
    this.buf = buf;
  }
  get $bytes() {
    return toBase64(this.buf);
  }
  toJSON() {
    return {
      $bytes: this.$bytes
    };
  }
}
const toBytes = buf => {
  return new BytesWrapper(buf);
};
const fromBytes = bytes => {
  if (bytes instanceof BytesWrapper) {
    return bytes.buf;
  }
  return fromBase64(bytes.$bytes);
};

const readArgument = (state, info) => {
  if (info < 24) {
    return info;
  }
  switch (info) {
    case 24:
      {
        return readUint8(state);
      }
    case 25:
      {
        return readUint16(state);
      }
    case 26:
      {
        return readUint32(state);
      }
    case 27:
      {
        return readUint53(state);
      }
  }
  throw new Error(`invalid argument encoding; got ${info}`);
};
const readFloat64 = state => {
  const view = state.v ??= new DataView(state.b.buffer, state.b.byteOffset, state.b.byteLength);
  const value = view.getFloat64(state.p);
  state.p += 8;
  return value;
};
const readUint8 = state => {
  return state.b[state.p++];
};
const readUint16 = state => {
  let pos = state.p;
  const buf = state.b;
  const value = buf[pos++] << 8 | buf[pos++];
  state.p = pos;
  return value;
};
const readUint32 = state => {
  let pos = state.p;
  const buf = state.b;
  const value = (buf[pos++] << 24 | buf[pos++] << 16 | buf[pos++] << 8 | buf[pos++]) >>> 0;
  state.p = pos;
  return value;
};
const readUint53 = state => {
  let pos = state.p;
  const buf = state.b;
  const hi = (buf[pos++] << 24 | buf[pos++] << 16 | buf[pos++] << 8 | buf[pos++]) >>> 0;
  if (hi > 0x1fffff) {
    throw new RangeError(`can't decode integers beyond safe integer range`);
  }
  const lo = (buf[pos++] << 24 | buf[pos++] << 16 | buf[pos++] << 8 | buf[pos++]) >>> 0;
  const value = hi * 2 ** 32 + lo;
  state.p = pos;
  return value;
};
const readString = (state, length) => {
  const string = decodeUtf8From(state.b, state.p, length);
  state.p += length;
  return string;
};
const readBytes = (state, length) => {
  const slice = state.b.subarray(state.p, state.p += length);
  return toBytes(slice);
};
const readTypeInfo = state => {
  const prelude = readUint8(state);
  return [prelude >> 5, prelude & 0x1f];
};
const readCid$1 = (state, length) => {
  // CID bytes are prefixed with 0x00 for historical reasons, apparently.
  const slice = state.b.subarray(state.p + 1, state.p += length);
  return new CidLinkWrapper(slice);
};
var ContainerType;
(function (ContainerType) {
  ContainerType[ContainerType["MAP"] = 0] = "MAP";
  ContainerType[ContainerType["ARRAY"] = 1] = "ARRAY";
})(ContainerType || (ContainerType = {}));
const decodeFirst = buf => {
  const len = buf.length;
  const state = {
    b: buf,
    v: null,
    p: 0
  };
  let stack = null;
  let result;
  jump: while (state.p < len) {
    const prelude = readUint8(state);
    const type = prelude >> 5;
    const info = prelude & 0x1f;
    const arg = type < 7 ? readArgument(state, info) : 0;
    let value;
    switch (type) {
      case 0:
        {
          value = arg;
          break;
        }
      case 1:
        {
          value = -1 - arg;
          break;
        }
      case 2:
        {
          value = readBytes(state, arg);
          break;
        }
      case 3:
        {
          value = readString(state, arg);
          break;
        }
      case 4:
        {
          const arr = new Array(arg);
          value = arr;
          if (arg > 0) {
            stack = {
              t: ContainerType.ARRAY,
              c: arr,
              k: null,
              r: arg,
              n: stack
            };
            continue jump;
          }
          break;
        }
      case 5:
        {
          const obj = {};
          value = obj;
          if (arg > 0) {
            // `arg * 2` because we're reading both keys and values
            stack = {
              t: ContainerType.MAP,
              c: obj,
              k: null,
              r: arg * 2,
              n: stack
            };
            continue jump;
          }
          break;
        }
      case 6:
        {
          switch (arg) {
            case 42:
              {
                const [type, info] = readTypeInfo(state);
                if (type !== 2) {
                  throw new TypeError(`expected cid-link to be type 2 (bytes); got type ${type}`);
                }
                const len = readArgument(state, info);
                value = readCid$1(state, len);
                break;
              }
            default:
              {
                throw new TypeError(`unsupported tag; got ${arg}`);
              }
          }
          break;
        }
      case 7:
        {
          switch (info) {
            case 20:
            case 21:
              {
                value = info === 21;
                break;
              }
            case 22:
              {
                value = null;
                break;
              }
            case 27:
              {
                value = readFloat64(state);
                break;
              }
            default:
              {
                throw new Error(`invalid simple value; got ${info}`);
              }
          }
          break;
        }
      default:
        {
          throw new TypeError(`invalid type; got ${type}`);
        }
    }
    while (stack !== null) {
      const node = stack;
      switch (node.t) {
        case ContainerType.ARRAY:
          {
            const index = node.c.length - node.r;
            node.c[index] = value;
            break;
          }
        case ContainerType.MAP:
          {
            if (node.k === null) {
              if (typeof value !== 'string') {
                throw new TypeError(`expected map to only have string keys; got ${type}`);
              }
              node.k = value;
            } else {
              if (node.k === '__proto__') {
                // Guard against prototype pollution. CWE-1321
                Object.defineProperty(node.c, node.k, {
                  enumerable: true,
                  configurable: true,
                  writable: true
                });
              }
              node.c[node.k] = value;
              node.k = null;
            }
            break;
          }
      }
      if (--node.r !== 0) {
        // We still have more values to decode, continue
        continue jump;
      }
      // Unwrap the stack
      value = node.c;
      stack = node.n;
    }
    result = value;
    break;
  }
  return [result, buf.subarray(state.p)];
};
const decode = buf => {
  const [value, remainder] = decodeFirst(buf);
  if (remainder.length !== 0) {
    throw new Error(`decoded value contains remainder`);
  }
  return value;
};

const createUint8Reader = buf => {
  let pos = 0;
  return {
    get pos() {
      return pos;
    },
    seek(size) {
      if (size > buf.length - pos) {
        throw new RangeError('unexpected end of data');
      }
      pos += size;
    },
    upto(size) {
      return buf.subarray(pos, pos + Math.min(size, buf.length - pos));
    },
    exactly(size, seek) {
      if (size > buf.length - pos) {
        throw new RangeError('unexpected end of data');
      }
      const slice = buf.subarray(pos, pos + size);
      if (seek) {
        pos += size;
      }
      return slice;
    }
  };
};

const isCarV1Header = value => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const {
    version,
    roots
  } = value;
  return version === 1 && Array.isArray(roots) && roots.every(root => root instanceof CidLinkWrapper);
};

const readVarint = (reader, size) => {
  const buf = reader.upto(size);
  if (buf.length === 0) {
    throw new RangeError(`unexpected end of data`);
  }
  const [int, read] = decode$1(buf);
  reader.seek(read);
  return int;
};
const readHeader = reader => {
  const length = readVarint(reader, 8);
  if (length === 0) {
    throw new RangeError(`invalid car header; length=0`);
  }
  const rawHeader = reader.exactly(length, true);
  const header = decode(rawHeader);
  if (!isCarV1Header(header)) {
    throw new TypeError(`expected a car v1 archive`);
  }
  return header;
};
const readCid = reader => {
  const head = reader.upto(3 + 4);
  const version = head[0];
  const codec = head[1];
  const digestCodec = head[2];
  if (version !== CID_VERSION) {
    throw new RangeError(`incorrect cid version (got v${version})`);
  }
  if (codec !== CODEC_DCBOR && codec !== CODEC_RAW) {
    throw new RangeError(`incorrect cid codec (got 0x${codec.toString(16)})`);
  }
  if (digestCodec !== HASH_SHA256) {
    throw new RangeError(`incorrect cid hash type (got 0x${digestCodec.toString(16)})`);
  }
  const [digestSize, digestLebSize] = decode$1(head, 3);
  const bytes = reader.exactly(3 + digestLebSize + digestSize, true);
  const digest = bytes.subarray(3 + digestLebSize);
  const cid = {
    version: version,
    codec: codec,
    digest: {
      codec: digestCodec,
      contents: digest
    },
    bytes: bytes
  };
  return cid;
};
const readBlockHeader = reader => {
  const start = reader.pos;
  let size = readVarint(reader, 8);
  if (size === 0) {
    throw new Error(`invalid car section; length=0`);
  }
  size += reader.pos - start;
  const cid = readCid(reader);
  const blockSize = size - (reader.pos - start);
  return {
    cid,
    blockSize
  };
};
const createCarReader = reader => {
  const {
    roots
  } = readHeader(reader);
  return {
    roots,
    *iterate() {
      while (reader.upto(8).length > 0) {
        const {
          cid,
          blockSize
        } = readBlockHeader(reader);
        const bytes = reader.exactly(blockSize, true);
        yield {
          cid,
          bytes
        };
      }
    }
  };
};

const readCar = buffer => {
  const reader = createUint8Reader(buffer);
  return createCarReader(reader);
};

var version = "0.9.15";

// @ts-check
/// <reference types='./records' />

const emptyUint8Array = new Uint8Array();

/**
 * @typedef {{
 *  'app.bsky.feed.like': AppBskyFeedLike,
 *  'app.bsky.feed.post': AppBskyFeedPost,
 *  'app.bsky.feed.repost': AppBskyFeedRepost,
 *  'app.bsky.feed.threadgate': AppBskyFeedThreadgate,
 *  'app.bsky.graph.follow': AppBskyGraphFollow,
 *  'app.bsky.graph.block': AppBskyGraphBlock,
 *  'app.bsky.graph.list': AppBskyGraphList,
 *  'app.bsky.graph.listitem': AppBskyGraphListitem,
 *  'app.bsky.graph.listblock': AppBskyGraphListblock,
 *  'app.bsky.actor.profile': AppBskyActorProfile
 *  'app.bsky.feed.generator': AppBskyFeedGenerator
 *  'app.bsky.feed.postgate': AppBskyFeedPostgate
 *  'chat.bsky.actor.declaration': ChatBskyActorDeclaration,
 *  'app.bsky.graph.starterpack': AppBskyGraphStarterpack
 * }} RepositoryRecordTypes$
 */

/**
 * @template {keyof RepositoryRecordTypes$} $Type
 * @typedef {RepositoryRecordTypes$[$Type] & {
 *  repo: string,
 *  uri: string,
 *  cid: string,
 *  action: 'create' | 'update',
 *  path: string,
 *  $type: $Type,
 *  since: string,
 *  time: string,
 *  receiveTimestamp: number,
 *  parseTime: number
 * }} FirehoseRepositoryRecord
 */

/**
 * @typedef {{
 *  repo: string,
 *  uri: string,
 *  action: 'delete',
 *  path: string,
 *  $type: keyof RepositoryRecordTypes$,
 *  since: string,
 *  time: string,
 *  receiveTimestamp: number,
 *  parseTime: number
 * }} FirehoseDeleteRecord
 */

/**
 * @typedef {{
 *  $type: '#identity',
 *  repo: string,
 *  action?: never,
 *  handle: string,
 *  time: string,
 *  receiveTimestamp: number,
 *  parseTime: number
 * }} FirehoseIdentityRecord
 */

/**
 * @typedef {{
 *  $type: '#identity',
 *  repo: string,
 *  action?: never,
 *  active: boolean,
 *  time: string,
 *  receiveTimestamp: number,
 *  parseTime: number
 * }} FirehoseAccountRecord
 */

/**
 * @typedef {{
 *  $type: 'error',
 *  action?: never,
 *  message: string,
 *  receiveTimestamp: number,
 *  parseTime: number
 * } & Record<string, unknown>} FirehoseErrorRecord
 */

/**
 * @typedef {FirehoseRepositoryRecord<'app.bsky.feed.like'> |
 * FirehoseRepositoryRecord<'app.bsky.feed.post'> |
 * FirehoseRepositoryRecord<'app.bsky.feed.repost'> |
 * FirehoseRepositoryRecord<'app.bsky.feed.threadgate'> |
 * FirehoseRepositoryRecord<'app.bsky.graph.follow'> |
 * FirehoseRepositoryRecord<'app.bsky.graph.block'> |
 * FirehoseRepositoryRecord<'app.bsky.graph.list'> |
 * FirehoseRepositoryRecord<'app.bsky.graph.listitem'> |
 * FirehoseRepositoryRecord<'app.bsky.graph.listblock'> |
 * FirehoseRepositoryRecord<'app.bsky.actor.profile'> |
 * FirehoseRepositoryRecord<'app.bsky.feed.generator'> |
 * FirehoseRepositoryRecord<'app.bsky.feed.postgate'> |
 * FirehoseRepositoryRecord<'chat.bsky.actor.declaration'> |
 * FirehoseRepositoryRecord<'app.bsky.graph.starterpack'> |
 * FirehoseDeleteRecord |
 * FirehoseIdentityRecord |
 * FirehoseAccountRecord |
 * FirehoseErrorRecord
 * } FirehoseRecord
 */

const known$Types = /** @type {const} */['app.bsky.feed.like', 'app.bsky.feed.post', 'app.bsky.feed.repost', 'app.bsky.feed.threadgate', 'app.bsky.graph.follow', 'app.bsky.graph.block', 'app.bsky.graph.list', 'app.bsky.graph.listitem', 'app.bsky.graph.listblock', 'app.bsky.actor.profile', 'app.bsky.feed.generator', 'app.bsky.feed.postgate', 'chat.bsky.actor.declaration', 'app.bsky.graph.starterpack'];
firehose$1.knownTypes = known$Types;
function requireWebsocket() {
  const globalObj = typeof global !== 'undefined' && global || typeof globalThis !== 'undefined' && globalThis;
  const requireFn = globalObj?.['require'];
  if (typeof requireFn === 'function') return /** @type {typeof WebSocket} */requireFn('ws');
  throw new Error('WebSocket not available');
}
firehose$1.each = each;
firehose$1.version = version;

/**
 * @param {string} [address]
 * @returns {AsyncGenerator<FirehoseRecord[], void, void>}
 */
async function* firehose$1(address) {
  const WebSocketImpl = typeof WebSocket === 'function' ? WebSocket : requireWebsocket();
  const wsAddress = address || 'wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos';
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
      if (buf.block?.length) {
        const block = buf.block;
        buf = createAwaitPromise();
        if (closed) {
          block['messages'] = block; // backwards compatibility trick
          if (block.length) yield block;
          break;
        }
        yield block;
      } else {
        buf = createAwaitPromise();
      }
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
    if (typeof event.data?.byteLength === 'number') {
      parseMessageBufAndResolve(receiveTimestamp, event.data);
    } else if (typeof event.data?.arrayBuffer === 'function') {
      event.data.arrayBuffer().then(arrayBuffer => parseMessageBufAndResolve(receiveTimestamp, arrayBuffer));
    } else {
      buf.block.push({
        $type: 'error',
        message: 'WebSocket message type not supported.',
        data: event.data,
        receiveTimestamp,
        parseTime: 0
      });
      buf.resolve();
    }
  }

  /**
   * @param {number} receiveTimestamp
   * @param {ArrayBuffer} arrayBuf
   */
  function parseMessageBufAndResolve(receiveTimestamp, arrayBuf) {
    parseMessageBuf(receiveTimestamp, new Uint8Array(arrayBuf));
    buf.resolve();
  }

  /**
   * @param {number} receiveTimestamp
   * @param {Uint8Array} messageBuf
   */
  function parseMessageBuf(receiveTimestamp, messageBuf) {
    const parseStart = performance.now();
    try {
      parseMessageBufWorker(receiveTimestamp, parseStart, messageBuf);
      buf.resolve();
    } catch (parseError) {
      buf.block.push({
        $type: 'error',
        message: parseError.message,
        receiveTimestamp,
        parseTime: performance.now() - parseStart
      });
    }
    buf.resolve();
  }

  /**
  * @param {number} receiveTimestamp
  * @param {number} parseStart
  * @param {Uint8Array} messageBuf
  */
  function parseMessageBufWorker(receiveTimestamp, parseStart, messageBuf) {
    const [header, remainder] = decodeFirst(messageBuf);
    const [body, remainder2] = decodeFirst(remainder);
    if (remainder2.length > 0) {
      return buf.block.push({
        $type: 'error',
        message: 'Excess bytes in message.',
        receiveTimestamp,
        parseTime: performance.now() - parseStart
      });
    }
    const {
      t,
      op
    } = header;
    if (op === -1) {
      return buf.block.push({
        $type: 'error',
        message: 'Error header#' + body.error + ': ' + body.message,
        receiveTimestamp,
        parseTime: performance.now() - parseStart
      });
    }
    if (t === '#commit') {
      const commit = body;

      // A commit can contain no changes
      if (!('blocks' in commit) || !commit.blocks.$bytes.length) {
        return buf.block.push({
          $type: 'com.atproto.sync.subscribeRepos#commit',
          ...commit,
          blocks: emptyUint8Array,
          ops: [],
          receiveTimestamp,
          parseTime: performance.now() - parseStart
        });
      }
      const blocks = fromBytes(commit.blocks);
      const car = readCarToMap(blocks);
      for (let opIndex = 0; opIndex < commit.ops.length; opIndex++) {
        const op = commit.ops[opIndex];
        const action = op.action;
        const cid = op.cid?.$link;
        const now = performance.now();
        const record = cid ? car.get(cid) : undefined;
        if (action === 'create' || action === 'update') {
          if (!cid) {
            buf.block.push({
              $type: 'error',
              message: 'Missing commit.ops[' + (opIndex - 1) + '].cid.',
              receiveTimestamp,
              parseTime: now - parseStart,
              commit
            });
            parseStart = now;
            continue;
          }
          if (!record) {
            buf.block.push({
              $type: 'error',
              message: 'Unresolved commit.ops[' + (opIndex - 1) + '].cid ' + cid,
              receiveTimestamp,
              parseTime: now - parseStart,
              commit
            });
            parseStart = now;
            continue;
          }
          record.action = action;
          record.uri = 'at://' + commit.repo + '/' + op.path;
          record.path = op.path;
          record.cid = cid;
          record.receiveTimestamp = receiveTimestamp;
          record.parseTime = now - parseStart;
          buf.block.push(record);
          continue;
        } else if (action === 'delete') {
          buf.block.push(/** @type {FirehoseDeleteRecord} */{
            action,
            path: op.path,
            receiveTimestamp,
            parseTime: now - parseStart
          });
          parseStart = now;
        } else {
          buf.block.push({
            $type: 'error',
            message: 'Unknown action ' + op.action,
            ...record,
            receiveTimestamp,
            parseTime: now - parseStart
          });
          parseStart = now;
          continue;
        }
      }
      return;
    }
    return buf.block.push({
      $type: t,
      ...body,
      receiveTimestamp,
      parseTime: performance.now() - parseStart
    });
  }
  function handleError(error) {
    console.error(error);
    const errorText = error.message || 'WebSocket error ' + error;
    buf.reject(new Error(errorText));
  }
}

/**
 * @param {string} [address]
 * @returns {AsyncGenerator<FirehoseRecord, void, void>}
 */
async function* each(address) {
  for await (const block of firehose$1(address)) {
    yield* block;
  }
}

/**
 * @returns {{
 *  block: FirehoseRecord[],
 *  resolve: () => void,
 *  reject: (reason?: any) => void,
 *  promise: Promise<void>
 * }} */
function createAwaitPromise() {
  const result = {
    /** @type {FirehoseRecord[]} */
    block: []
  };
  result.promise = new Promise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return /** @type {*} */result;
}

/** @param {Uint8Array} buffer */
function readCarToMap(buffer) {
  const records = new Map();
  for (const {
    cid,
    bytes
  } of readCar(buffer).iterate()) {
    records.set(toCidLink(cid).$link, decode(bytes));
  }
  return records;
}

// @ts-check


/** @param {string} [address] */
async function* firehose(address) {
  for await (const record of firehose$1(address)) {
    record['messages'] = record;
    yield record;
  }
}

export { firehose };
//# sourceMappingURL=firehose.js.map
