// @ts-check

import { decode as cbor_x_decode } from 'cbor-x';
import { CID } from 'multiformats';
import { CarReader as ipld_CarReader } from '../node_modules/@ipld/car/src/reader-browser.js';

import { ensureCborXExtended } from './firehose';
import { unwrapShortDID } from './shorten.js';

/**
 * @param {string} shortDID
 * @param {ArrayBuffer | Uint8Array} messageBuf
 */
export async function readCAR(shortDID, messageBuf) {
  const bytes = messageBuf instanceof ArrayBuffer ? new Uint8Array(messageBuf) : messageBuf;

  const car = await ipld_CarReader.fromBytes(bytes);
  ensureCborXExtended();

  const recordsByCID = new Map();
  const keyByCID = new Map();
  let lastRest = Date.now();
  const errors = [];
  for await (const block of car.blocks()) {
    await restRegularly();

    const record = cbor_x_decode(block.bytes);
    if (record.$type) recordsByCID.set(String(block.cid), record);
    else if (Array.isArray(record.e)) {
      let key = '';
      const decoder = new TextDecoder();
      for (const sub of record.e) {
        if (!sub.k || !sub.v) continue;
        try {
          const keySuffix = decoder.decode(sub.k);
          key = key.slice(0, sub.p || 0) + keySuffix;

          let cid;
          if (sub.v.multihash) {
            cid = sub.v;
          } else if (sub.v.value) {
            const expandWithoutZero =
              sub.v.value[0] ? sub.v.value :
            /** @type {Uint8Array} */(sub.v.value).subarray(1);
            cid = CID.decode(expandWithoutZero);
          }

          if (!cid) continue;

          keyByCID.set(String(cid), key);
        } catch (error) {
          if (!errors.length) console.error(error);
          errors.push(error);
        }
      }
    }
  }

  /** @type {import('./firehose').FirehoseRecord[]} */
  const records = [];

  const fullDID = unwrapShortDID(shortDID);
  for (const entry of recordsByCID) {
    const cid = entry[0];
    /** @type {import('./firehose').FirehoseRecord} */
    const record= entry[1];
    record.repo = fullDID;
    const key = keyByCID.get(cid);
    if (key) {
      record.path = key;
      record.uri = 'at://' + fullDID + '/' + key;
    }
    records.push(record);

    await restRegularly();
  }

    // record.seq = commit.seq; 471603945
    // record.since = /** @type {string} */(commit.since); 3ksfhcmgghv2g
    // record.action = op.action;
    // record.cid = cid;
    // record.path = op.path;
    // record.timestamp = commit.time ? Date.parse(commit.time) : Date.now(); 2024-05-13T19:59:10.457Z

    // record.repo = fullDID;
    // record.uri = fullDID + '/' + 'op.path';
    // record.action = 'create';

  return records;

  function restRegularly() {
    const now = Date.now();
    if (now - lastRest > 20) {
      lastRest = now;
      return new Promise(resolve => setTimeout(resolve, 1));
    }
  }
}
