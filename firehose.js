// @ts-check

/**
 * @typedef {{
 *  readonly pos: number;
 *  upto(size: number): Uint8Array;
 *  exactly(size: number, seek: boolean): Uint8Array;
 *  seek(size: number): void;
 * }} SyncByteReader
 */

/**
 * @param {Uint8Array} buf
 * @returns {SyncByteReader}
 */
const createUint8Reader = buf => {
  let pos = 0;
  return {
    get pos() {
      return pos;
    },
    seek(size) {
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

// @ts-check

const allocUnsafe = size => {
  return new Uint8Array(size);
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
    while (pad) {
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

// @ts-check

const BASE32_CHARSET = 'abcdefghijklmnopqrstuvwxyz234567';
const toBase32 = /*#__PURE__*/createRfc4648Encode(BASE32_CHARSET, 5);

// @ts-check

const MSB = 0x80;
const REST = 0x7f;
const MSBALL = -128;
const INT = 2 ** 31;
const N1 = 2 ** 7;
const N2 = 2 ** 14;
const N3 = 2 ** 21;
const N4 = 2 ** 28;
const N5 = 2 ** 35;
const N6 = 2 ** 42;
const N7 = 2 ** 49;
const N8 = 2 ** 56;
const N9 = 2 ** 63;
/**
 * Encodes a varint
 * @param num Number to encode
 * @param buf Buffer to write on
 * @param offset Starting position on the buffer
 * @returns The amount of bytes written
 */
const encode$1 = (num, buf, offset = 0) => {
  if (num > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('could not encode varint');
  }
  const start = offset;
  while (num >= INT) {
    buf[offset++] = num & 0xff | MSB;
    num /= 128;
  }
  while (num & MSBALL) {
    buf[offset++] = num & 0xff | MSB;
    num >>>= 7;
  }
  buf[offset] = num | 0;
  return offset - start + 1;
};
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
/**
 * Returns encoding length
 * @param num The number to encode
 * @returns Amount of bytes needed for encoding
 */
const encodingLength = num => {
  return num < N1 ? 1 : num < N2 ? 2 : num < N3 ? 3 : num < N4 ? 4 : num < N5 ? 5 : num < N6 ? 6 : num < N7 ? 7 : num < N8 ? 8 : num < N9 ? 9 : 10;
};

// @ts-check

const encode = (version, code, multihash) => {
  const codeOffset = encodingLength(version);
  const hashOffset = codeOffset + encodingLength(code);
  const bytes = new Uint8Array(hashOffset + multihash.byteLength);
  encode$1(version, bytes, 0);
  encode$1(code, bytes, codeOffset);
  bytes.set(multihash, hashOffset);
  return bytes;
};

// @ts-check

const BASE64_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const HAS_UINT8_BASE64_SUPPORT = 'fromBase64' in Uint8Array;
const _fromBase64Polyfill = /*#__PURE__*/createRfc4648Decode(BASE64_CHARSET, 6, false);
const _toBase64Polyfill = /*#__PURE__*/createRfc4648Encode(BASE64_CHARSET, 6);
const WS_PAD_RE = /[\s=]/;
const _fromBase64Native = str => {
  if (str.length % 4 === 1 || WS_PAD_RE.test(str)) {
    throw new SyntaxError(`invalid base64 string`);
  }
  return /** @type {*} */Uint8Array.fromBase64(str, {
    alphabet: 'base64',
    lastChunkHandling: 'loose'
  });
};
const _toBase64Native = bytes => {
  return bytes.toBase64({
    alphabet: 'base64',
    omitPadding: true
  });
};
const fromBase64 = !HAS_UINT8_BASE64_SUPPORT ? _fromBase64Polyfill : _fromBase64Native;
const toBase64 = !HAS_UINT8_BASE64_SUPPORT ? _toBase64Polyfill : _toBase64Native;

// @ts-check

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

// @ts-check

const toCIDLink = value => {
  return 'b' + toBase32(value.bytes || value);
};

// @ts-check

const utf8d = new TextDecoder();
const readArgument = (state, info) => {
  if (info < 24) {
    return info;
  }
  switch (info) {
    case 24:
      return readUint8(state);
    case 25:
      return readUint16(state);
    case 26:
      return readUint32(state);
    case 27:
      return readUint64(state);
  }
  throw new Error(`invalid argument encoding; got ${info}`);
};
const readFloat64 = state => {
  const value = state.v.getFloat64(state.p);
  state.p += 8;
  return value;
};
const readUint8 = state => {
  const value = state.v.getUint8(state.p);
  state.p += 1;
  return value;
};
const readUint16 = state => {
  const value = state.v.getUint16(state.p);
  state.p += 2;
  return value;
};
const readUint32 = state => {
  const value = state.v.getUint32(state.p);
  state.p += 4;
  return value;
};
const readUint64 = state => {
  const hi = state.v.getUint32(state.p);
  const lo = state.v.getUint32(state.p + 4);
  if (hi > 0x1fffff) {
    throw new RangeError(`can't decode integers beyond safe integer range`);
  }
  // prettier-ignore
  const value = hi * 2 ** 32 + lo;
  state.p += 8;
  return value;
};
const readString = (state, length) => {
  const slice = state.b.subarray(state.p, state.p += length);
  return utf8d.decode(slice);
};
const readBytes = (state, length) => {
  const slice = state.b.subarray(state.p, state.p += length);
  return toBytes(slice);
};
const readCid$1 = (state, length) => {
  // CID bytes are prefixed with 0x00 for historical reasons, apparently.
  const slice = state.b.subarray(state.p + 1, state.p += length);
  return toCIDLink(slice);
};
const readValue = state => {
  const prelude = readUint8(state);
  const type = prelude >> 5;
  const info = prelude & 0x1f;
  if (type === 0) {
    const value = readArgument(state, info);
    return value;
  }
  if (type === 1) {
    const value = readArgument(state, info);
    return -1 - value;
  }
  if (type === 2) {
    const len = readArgument(state, info);
    return readBytes(state, len);
  }
  if (type === 3) {
    const len = readArgument(state, info);
    return readString(state, len);
  }
  if (type === 4) {
    const len = readArgument(state, info);
    const array = new Array(len);
    for (let idx = 0; idx < len; idx++) {
      array[idx] = readValue(state);
    }
    return array;
  }
  if (type === 5) {
    const len = readArgument(state, info);
    const object = {};
    for (let idx = 0; idx < len; idx++) {
      const key = readValue(state);
      if (typeof key !== 'string') {
        throw new TypeError(`expected map to only have string keys; got ${typeof key}`);
      }
      object[key] = readValue(state);
    }
    return object;
  }
  if (type === 6) {
    const tag = readArgument(state, info);
    if (tag === 42) {
      const prelude = readUint8(state);
      const type = prelude >> 5;
      const info = prelude & 0x1f;
      if (type !== 2) {
        throw new TypeError(`expected cid tag to have bytes value; got ${type}`);
      }
      const len = readArgument(state, info);
      return readCid$1(state, len);
    }
    throw new TypeError(`unsupported tag; got ${tag}`);
  }
  if (type === 7) {
    switch (info) {
      case 20:
        return false;
      case 21:
        return true;
      case 22:
        return null;
      case 27:
        return readFloat64(state);
    }
    throw new Error(`invalid simple value; got ${info}`);
  }
  throw new TypeError(`invalid type; got ${type}`);
};
const decodeFirst = buf => {
  const state = {
    b: buf,
    v: new DataView(buf.buffer, buf.byteOffset, buf.byteLength),
    p: 0
  };
  const value = readValue(state);
  const remainder = buf.subarray(state.p);
  return [value, remainder];
};
const decode = buf => {
  const [value, remainder] = decodeFirst(buf);
  if (remainder.length !== 0) {
    throw new Error(`decoded value contains remainder`);
  }
  return value;
};

// @ts-check


/**
 * @typedef {{
 *  version: 1;
 *  roots: string[];
 * }} CarV1Header
 */

/** @returns {value is CarV1Header} */
const isCarV1Header = value => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const {
    version,
    roots
  } = value;
  return version === 1 && Array.isArray(roots) && roots.every(root => typeof root === 'string');
};

/**
 * @param {import('./byte-reader').SyncByteReader} reader
 * @param {number} size
 */
const readVarint = (reader, size) => {
  const buf = reader.upto(size);
  if (buf.length === 0) {
    throw new RangeError(`unexpected end of data`);
  }
  const [int, read] = decode$1(buf);
  reader.seek(read);
  return int;
};

/**
 * @param {import('./byte-reader').SyncByteReader} reader
 */
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

/**
 * @param {import('./byte-reader').SyncByteReader} reader
 */
const readMultihashDigest = reader => {
  const first = reader.upto(8);
  const [code, codeOffset] = decode$1(first);
  const [size, sizeOffset] = decode$1(first.subarray(codeOffset));
  const offset = codeOffset + sizeOffset;
  const bytes = reader.exactly(offset + size, true);
  const digest = bytes.subarray(offset);
  return {
    code: code,
    size: size,
    digest: digest,
    bytes: bytes
  };
};

/**
 * @param {import('./byte-reader').SyncByteReader} reader
 */
const readCid = reader => {
  const version = readVarint(reader, 8);
  if (version !== 1) {
    throw new Error(`expected a cidv1`);
  }
  const codec = readVarint(reader, 8);
  const digest = readMultihashDigest(reader);
  const cid = {
    version: version,
    code: codec,
    digest: digest,
    bytes: encode(version, codec, digest.bytes)
  };
  return cid;
};

/**
 * @param {import('./byte-reader').SyncByteReader} reader
 */
const readBlockHeader = reader => {
  const start = reader.pos;
  let size = readVarint(reader, 8);
  if (size === 0) {
    throw new Error(`invalid car section; length=0`);
  }
  size += reader.pos - start;
  const cid = readCid(reader);
  const blockSize = size - Number(reader.pos - start);
  return {
    cid,
    blockSize
  };
};

/**
 * @param {import('./byte-reader').SyncByteReader} reader
 */
const createCarReader = reader => {
  const {
    roots
  } = readHeader(reader);
  return {
    roots,
    /** @returns {Generator<{ cid: import('../../cbor/cid').CID; bytes: Uint8Array }>} */
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

// @ts-check


/** @param {Uint8Array} buffer */
const readCar = buffer => {
  const reader = createUint8Reader(buffer);
  return createCarReader(reader);
};

var version = "0.9.5";

// @ts-check
/// <reference types='@atproto/api' />

const emptyUint8Array = new Uint8Array();

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
        const now = performance.now();
        const record = op.cid ? car.get(op.cid) : undefined;
        if (action === 'create' || action === 'update') {
          if (!op.cid) {
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
              message: 'Unresolved commit.ops[' + (opIndex - 1) + '].cid ' + op.cid,
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
          record.cid = op.cid;
          record.receiveTimestamp = receiveTimestamp;
          record.parseTime = now - parseStart;
          buf.block.push(record);
          continue;
        } else if (action === 'delete') {
          buf.block.push({
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
async function* each() {
  for await (const block of firehose$1()) {
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
    records.set(toCIDLink(cid), decode(bytes));
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
