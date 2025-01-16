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
 * @typedef {{
 *  $type: '#identity',
 *  repo: string,
 *  handle: string,
 *  time: string
 * }} FirehoseRecordIdentity
 */

/**
 * @typedef {{
 *  $type: '#identity',
 *  repo: string,
 *  active: boolean,
 *  time: string
 * }} FirehoseRecordAccount
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
 * FirehoseRecord$Typed<'app.bsky.graph.starterpack'> |
 * FirehoseRecordIdentity |
 * FirehoseRecordAccount
 * } FirehoseRecord
 */

export const known$Types = [
  'app.bsky.feed.like', 'app.bsky.feed.post', 'app.bsky.feed.repost', 'app.bsky.feed.threadgate',
  'app.bsky.graph.follow', 'app.bsky.graph.block', 'app.bsky.graph.list', 'app.bsky.graph.listitem', 'app.bsky.graph.listblock',
  'app.bsky.actor.profile',
  'app.bsky.feed.generator',
  'app.bsky.feed.postgate',
  'chat.bsky.actor.declaration',
  'app.bsky.graph.starterpack'
];

firehose.knownTypes = known$Types;

let cbor_x_extended = false;

export async function* firehoseRecords() {
  for await (const { messages, deletes, unexpected, ...rest } of firehose()) {
    if (deletes?.length) {
      for (const record of deletes) {
        yield { ...rest, action: 'delete', record };
      }
    }

    if (!messages.length) continue;
    for (const record of messages) {
      yield { ...rest, record };
    }

    for (const record of unexpected || []) {
      yield { ...rest, action: 'unexpected', record };
    }
  }
}

function requireWebsocket() {
  const globalObj = typeof global !== 'undefined' && global || typeof globalThis !== 'undefined' && globalThis;
  const requireFn = globalObj?.['require'];
  if (typeof requireFn === 'function') return /** @type {typeof WebSocket} */(requireFn('ws'));
  throw new Error('WebSocket not available');
}

/**
 * @returns {AsyncGenerator<FirehoseBlock, void, void>}
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
    buf.block.receiveTimestamp = receiveTimestamp;

    if (typeof event.data?.byteLength === 'number') {
      parseMessageBufAndResolve(event.data);
    } else if (typeof event.data?.arrayBuffer === 'function') {
      event.data.arrayBuffer().then(parseMessageBufAndResolve)
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

    const entry = /** @type {any[]} */(cbor_x_decodeMultiple(new Uint8Array(messageBuf)));

    if (!entry) return addBufError('CBOR decodeMultiple returned empty.');
    if (entry[0]?.op !== 1) return addBufError('Expected CBOR op:1, received:' + entry[0]?.op);

    const commit = entry[1];
    const t = entry[0].t;
    if (t === '#identity' && commit.did) {
      /** @type {FirehoseRecordIdentity} */
      const identityRecord = {
        $type: '#identity',
        repo: commit.did,
        handle: commit.handle,
        time: commit.time
      };
      buf.block.messages.push(identityRecord);
      return;
    } else if (t === '#account' && commit.did) {
      /** @type {FirehoseRecordAccount} */
      const accountRecord = {
        $type: '#identity',
        repo: commit.did,
        active: commit.active,
        time: commit.time
      };
      buf.block.messages.push(accountRecord);
      return;
    }

    if (!commit.blocks) return addBufError('Expected operation with commit.blocks, received ' + commit.blocks);
    if (!commit.ops?.length) return addBufError('Expected operation with commit.ops, received ' + commit.ops);

    const car = ipld_CarBufferReader.fromBytes(commit.blocks);

    if (!buf.block.since)
      buf.block.since = commit.since;

    buf.block.time = commit.time;

    let opIndex = 0;
    for (const op of commit.ops) {
      opIndex++;

      if (!op.cid) {
        if (op.action === 'delete') {
          /** @type {FirehoseRecord} */
          const deleteRecord = {
            repo: commit.repo,
            path: op.path,
            uri: 'at://' + commit.repo + '/' + op.path,
            action: 'delete',
            $type: /** @type {*} */(null)
          };
          if (!buf.block.deletes) buf.block.deletes = [deleteRecord];
          else buf.block.deletes.push(deleteRecord);
        } else {
          addBufError('Missing commit[' + (opIndex - 1) + '].op.cid: ' + op.cid);
        }
        continue;
      }

      const block = car.get(/** @type {*} */(op.cid));
      if (!block) {
        addBufError('Unresolvable commit[' + (opIndex - 1) + '].op.cid: ' + op.cid);
        continue;
      }

      const record = cbor_x_decode(block.bytes);
      // record.seq = commit.seq; 471603945
      // record.since = /** @type {string} */(commit.since); 3ksfhcmgghv2g
      // record.action = op.action;
      // record.cid = cid;
      // record.path = op.path;
      // record.timestamp = commit.time ? Date.parse(commit.time) : Date.now(); 2024-05-13T19:59:10.457Z

      record.repo = commit.repo;
      record.uri = 'at://' + commit.repo + '/' + op.path;
      record.action = op.action;

      let unexpected =
        (op.action !== 'create' && op.action !== 'update' && op.action !== 'delete') ||
        known$Types.indexOf(record.$type) < 0;

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
    buf.block.error.push({ message: errorStr });
  }

  function handleError(error) {
    console.error(error);
    const errorText =
      error.message || 'WebSocket error ' + error;
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
  return /** @type {*} */(result);
}

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
