// @ts-check

import {
  addExtension as cbor_x_addExtension,
  decodeMultiple as cbor_x_decodeMultiple,
  decode as cbor_x_decode
} from 'cbor-x';
import { CID as multiformats_CID } from 'multiformats';
import { BSKY_NETWORK_URL } from './coldsky-agent';
import { CarReader } from '../node_modules/@ipld/car/src/reader-browser.js';

import { shortenDID } from './shorten';

/**
 * @typedef {{
 *   receiveTimestamp: number,
 *   since: string,
 *   created: FirehoseMessage[],
 *   deleted: FirehoseMessage[],
 *   unexpected?: (FirehoseMessage & { action: string })[]
 * }} FirehoseBlock
 */

/**
 * @typedef {{ repo: string, cid: string, path: string } & (
 *  { $type: 'app.bsky.feed.like' } & import('@atproto/api').AppBskyFeedLike.Record |
 *  { $type: 'app.bsky.feed.post' } & import('@atproto/api').AppBskyFeedPost.Record |
 *  { $type: 'app.bsky.feed.repost' } & import('@atproto/api').AppBskyFeedRepost.Record |
 *  { $type: 'app.bsky.graph.follow' } & import('@atproto/api').AppBskyGraphFollow.Record |
 *  { $type: 'app.bsky.graph.block' } & import('@atproto/api').AppBskyGraphBlock.Record |
 *  { $type: string } & { [key: string]: any }
 * )} FirehoseMessage
 */

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
  ws.addEventListener('error', error => handleError(error));

  let buf = createAwaitPromise();

  try {

    while (true) {
      await buf.promise;
      const blocks = buf.blocks;
      buf = createAwaitPromise();
      yield blocks;
    }
  } finally {
    ws.close();
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
    const commitShortDID = shortenDID(commit.repo);
    if (!commitShortDID) return; // TODO: alert unusual commit

    const car = await CarReader.fromBytes(commit.blocks);

    /** @type {FirehoseBlock} */
    const blockEntry = {
      receiveTimestamp,
      since: commit.since,
      created: [],
      deleted: []
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

      record.cid = op.cid && String(op.cid);
      record.path = op.path;

      if (op.action === 'create') {
        blockEntry.created.push(record);
      }else if (op.action === 'delete') {
        blockEntry.deleted.push(record);
      } else {
        if (!blockEntry.unexpected) blockEntry.unexpected = [];
        blockEntry.unexpected.push({
          action: op.action,
          ...record
        });
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