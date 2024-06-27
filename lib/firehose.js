// @ts-check

import {
  addExtension as cbor_x_addExtension,
  decodeMultiple as cbor_x_decodeMultiple,
  decode as cbor_x_decode
} from 'cbor-x';
import { CID as multiformats_CID } from 'multiformats';
import { CarReader as ipld_CarReader } from '../node_modules/@ipld/car/src/reader-browser.js';

/**
 * @typedef {{
 *   receiveTimestamp: number,
 *   since: string,
 *   time: string,
 *   messages: FirehoseRecord[],
 *   deletes?: FirehoseRecord[],
 *   unexpected?: FirehoseRecord[]
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
 * }} RepoRecord$Typed
 */

/**
 * @template {keyof RepoRecord$Typed} $Type
 * @typedef {{ repo: string, rev: string, cid: string, action: 'create' | 'delete' | 'update', path: string, $type: $Type } &
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
 * FirehoseRecord$Typed<'app.bsky.actor.profile'> |
 * FirehoseRecord$Typed<'app.bsky.feed.generator'>
 * } FirehoseRecord
 */

const known$Types = [
  'app.bsky.feed.like', 'app.bsky.feed.post', 'app.bsky.feed.repost', 'app.bsky.feed.threadgate',
  'app.bsky.graph.follow', 'app.bsky.graph.block', 'app.bsky.graph.list', 'app.bsky.graph.listitem',
  'app.bsky.actor.profile',
  'app.bsky.feed.generator'
];

firehose.knownTypes = known$Types;

let cbor_x_extended = false;

/**
 * @returns {AsyncGenerator<FirehoseBlock[], void, void>}
 */
export async function* firehose() {
  ensureCborXExtended();

  /** @type {typeof WebSocket} */
  const WebSocketImpl = typeof WebSocket === 'function' ? WebSocket :
    /** @type {typeof WebSocket} */(require('ws'));

  const wsAddress = 'wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos';

  const ws = new WebSocketImpl(wsAddress);
  ws.addEventListener('message', handleMessage);
  ws.addEventListener('error', handleError);
  ws.addEventListener('close', handleClose)

  let buf = createAwaitPromise();
  let closed = false;

  try {

    while (true) {
      await buf.promise;
      const blocks = buf.blocks;
      buf = createAwaitPromise();
      if (closed) {
        if (blocks.length) yield blocks;
        break;
      }
      yield blocks;
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

    if (typeof event.data?.arrayBuffer === 'function')
      return event.data.arrayBuffer().then(arrayBuf => convertMessageBuf(receiveTimestamp, arrayBuf));
    else if (typeof event.data?.byteLength === 'number')
      return convertMessageBuf(receiveTimestamp, event.data);
  }

  /** @param {ArrayBuffer} messageBuf */
  async function convertMessageBuf(receiveTimestamp, messageBuf) {
    const entry = /** @type {any[]} */(cbor_x_decodeMultiple(new Uint8Array(messageBuf)));
    if (!entry || entry[0]?.op !== 1) return;

    const commit = entry[1];
    if (!commit.blocks) return; // TODO: alert unusual commit

    if (!commit.ops?.length) return; // TODO: alert unusual commit

    const car = await ipld_CarReader.fromBytes(commit.blocks);

    /** @type {FirehoseBlock} */
    const blockEntry = {
      receiveTimestamp,
      since: commit.since,
      time: commit.time,
      messages: []
    };

    for (const op of commit.ops) {
      const block = op.cid && await car.get(/** @type {*} */(op.cid));
      if (!block) continue; // TODO: alert unusual op

      const record = cbor_x_decode(block.bytes);
      // record.repo = commit.repo;
      // record.rev = /** @type {string} */(commit.rev);
      // record.seq = commit.seq;
      // record.since = /** @type {string} */(commit.since);
      // record.action = op.action;
      // record.cid = cid;
      // record.path = op.path;
      // record.timestamp = commit.time ? Date.parse(commit.time) : Date.now();

      record.repo = commit.repo;
      record.rev = commit.rev;
      record.cid = op.cid && String(op.cid);
      record.path = op.path;
      record.action = op.action;

      let unexpected =
        (op.action !== 'create' && op.action !== 'update' && op.action !== 'delete') ||
        known$Types.indexOf(record.$type) < 0;

      if (unexpected) {
        if (!blockEntry.unexpected) blockEntry.unexpected = [];
        blockEntry.unexpected.push(record);
      } else if (op.action === 'delete') {
        if (!blockEntry.deletes) blockEntry.deletes = [];
        blockEntry.deletes.push(record);
      } else {
        blockEntry.messages.push(record);
      }
    }

    buf.blocks.push(blockEntry);
    buf.resolve();
  }

  function handleError(error) {
    console.error(error);
    const errorText =
      error.message || 'WebSocket error ' + error;
    buf.reject(new Error(errorText));
  }

}

/** @returns {{
 *  blocks: FirehoseBlock[],
 *  resolve: () => void,
 *  reject: (reason?: any) => void,
 *  promise: Promise<void>
 * }} */
function createAwaitPromise() {
  const result = { blocks: [] };
  result.promise = new Promise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return /** @type {*} */(result);
}

function ensureCborXExtended() {
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
