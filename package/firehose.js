// @ts-check

import {
  addExtension as cbor_x_addExtension,
  decodeMultiple as cbor_x_decodeMultiple,
  decode as cbor_x_decode
} from 'cbor-x';
import { CID as multiformats_CID } from 'multiformats';
import { CarBufferReader as ipld_CarBufferReader } from '@ipld/car/buffer-reader';

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

export const known$Types = /** @type {const} */([
  'app.bsky.feed.like', 'app.bsky.feed.post', 'app.bsky.feed.repost', 'app.bsky.feed.threadgate',
  'app.bsky.graph.follow', 'app.bsky.graph.block', 'app.bsky.graph.list', 'app.bsky.graph.listitem', 'app.bsky.graph.listblock',
  'app.bsky.actor.profile',
  'app.bsky.feed.generator',
  'app.bsky.feed.postgate',
  'chat.bsky.actor.declaration',
  'app.bsky.graph.starterpack'
]);

firehose.knownTypes = known$Types;

function requireWebsocket() {
  const globalObj = typeof global !== 'undefined' && global || typeof globalThis !== 'undefined' && globalThis;
  const requireFn = globalObj?.['require'];
  if (typeof requireFn === 'function') return /** @type {typeof WebSocket} */(requireFn('ws'));
  throw new Error('WebSocket not available');
}

/**
 * @returns {AsyncGenerator<FirehoseRecord[], void, void>}
 */
export async function* firehose() {
  ensureCborXExtended();

  /** @type {typeof WebSocket} */
  const WebSocketImpl = typeof WebSocket === 'function' ? WebSocket :
    requireWebsocket();

  const wsAddress = 'wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos';

  const ws = new WebSocketImpl(wsAddress);
  ws.binaryType = 'arraybuffer';
  ws.addEventListener('message', handleMessage);
  ws.addEventListener('error', handleError);
  ws.addEventListener('close', handleClose)

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
      }
    }
  } finally {
    if (!closed) {
      try { ws.close(); }
      catch (error) { }
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
      event.data.arrayBuffer().then(arrayBuffer => parseMessageBufAndResolve(receiveTimestamp, arrayBuffer))
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
    const parseStart = Date.now();
    try {
      parseMessageBufWorker(receiveTimestamp, parseStart, messageBuf);
      buf.resolve();
    } catch (parseError) {
      buf.block.push({
        $type: 'error',
        message: parseError.message,
        receiveTimestamp,
        parseTime: Date.now() - parseStart
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

    const entry = /** @type {any[]} */(cbor_x_decodeMultiple(messageBuf));

    if (!entry)
      return buf.block.push({
        $type: 'error',
        message: 'CBOR decodeMultiple returned empty.',
        receiveTimestamp,
        parseTime: Date.now() - parseStart
      });

    if (entry[0]?.op !== 1) return buf.block.push({
      $type: 'error',
      message: 'Expected CBOR op:1.',
      receiveTimestamp,
      parseTime: Date.now() - parseStart,
      entry: entry
    });

    const commit = entry[1];
    const t = entry[0].t;
    if (t === '#identity' && commit.did) {
      /** @type {FirehoseIdentityRecord} */
      const identityRecord = {
        $type: '#identity',
        repo: commit.did,
        handle: commit.handle,
        time: commit.time,
        receiveTimestamp,
        parseTime: Date.now() - parseStart
      };
      buf.block.push(identityRecord);
      return;
    } else if (t === '#account' && commit.did) {
      /** @type {FirehoseAccountRecord} */
      const accountRecord = {
        $type: '#identity',
        repo: commit.did,
        active: commit.active,
        time: commit.time,
        receiveTimestamp,
        parseTime: Date.now() - parseStart
      };
      buf.block.push(accountRecord);
      return;
    }

    if (!commit.blocks?.length) return buf.block.push({
      $type: 'error',
      message: 'Expected operation with commit.blocks.',
      receiveTimestamp,
      parseTime: Date.now() - parseStart,
      commit
    });

    if (!commit.ops?.length) {
      return buf.block.push({
        $type: 'error',
        message: 'Expected operation with commit.ops.',
        receiveTimestamp,
        parseTime: Date.now() - parseStart,
        commit
      });
    }

    const car = ipld_CarBufferReader.fromBytes(commit.blocks);

    let opIndex = 0;
    for (const op of commit.ops) {
      opIndex++;

      if (!op.cid) {
        if (op.action === 'delete') {
          const posPathSlash = op.path?.indexOf('/');
          const type = posPathSlash > 0 ? op.path.slice(0, posPathSlash) : op.path;
          /** @type {FirehoseDeleteRecord} */
          const deleteRecord = {
            repo: commit.repo,
            uri: 'at://' + commit.repo + '/' + op.path,
            action: 'delete',
            path: op.path,
            $type: type,
            since: commit.since,
            time: commit.time,
            receiveTimestamp,
            parseTime: Date.now() - parseStart
          };
          buf.block.push(deleteRecord);
        } else {
          buf.block.push({
            $type: 'error',
            message: 'Missing commit.ops[' + (opIndex - 1) + '].cid.',
            receiveTimestamp,
            parseTime: Date.now() - parseStart,
            commit
          });
        }
        continue;
      }

      const block = car.get(/** @type {*} */(op.cid));
      if (!block) {
        buf.block.push({
          $type: 'error',
          message: 'Unresolvable commit.ops[' + (opIndex - 1) + '].cid.',
          receiveTimestamp,
          parseTime: Date.now() - parseStart,
          commit
        });
        continue;
      }

      /** @type {FirehoseRepositoryRecord<keyof RepositoryRecordTypes$>} */
      const record = cbor_x_decode(block.bytes);
      record.repo = commit.repo;
      record.uri = 'at://' + commit.repo + '/' + op.path;
      record.action = op.action;
      record.path = op.path;
      record.since = commit.since;
      record.time = commit.time;
      record.receiveTimestamp = receiveTimestamp;
      record.parseTime = Date.now() - parseStart;

      record['seq'] = commit.seq;

      buf.block.push(/** @type {FirehoseRecord} */(record));
    }
  }

  function handleError(error) {
    console.error(error);
    const errorText =
      error.message || 'WebSocket error ' + error;
    buf.reject(new Error(errorText));
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
  return /** @type {*} */(result);
}

let cbor_x_extended = false;

export function ensureCborXExtended() {
  if (cbor_x_extended) return;

  cbor_x_addExtension({
    Class: multiformats_CID,
    tag: 42,
    encode: () => {
      throw new Error("cannot encode cids");
    },
    decode: (bytes) => {
      if (bytes[0] !== 0) throw new Error("invalid cid for cbor tag 42");
      return multiformats_CID.decode(bytes.subarray(1)); // ignore leading 0x00
    },
  });

  cbor_x_extended = true;
}
