// @ts-check

import { decode as cbor_x_decode } from 'cbor-x';
import { CID } from 'multiformats';
import { CarReader as ipld_CarReader } from '@ipld/car/reader';

import { ensureCborXExtended } from './firehose';
import { unwrapShortDID } from './shorten';

var READING_CYCLES_BEFORE_REST = 5000;
var COLLECTING_CYCLES_BEFORE_REST = 15000;

/**
 * @param {string} did
 * @param {ArrayBuffer | Uint8Array} messageBuf
 * @param {{ sleep?: number }} [options]
 */
export async function readCAR(did, messageBuf, options) {
  const fullDID = unwrapShortDID(did);
  const bytes = messageBuf instanceof ArrayBuffer ? new Uint8Array(messageBuf) : messageBuf;

  const car = await ipld_CarReader.fromBytes(bytes);
  ensureCborXExtended();

  const recordsByCID = new Map();
  const keyByCID = new Map();
  let lastRest = Date.now();
  const errors = [];
  const blocks = typeof car._blocks === 'object' && car._blocks && Array.isArray(car._blocks) ? car._blocks : car.blocks();

  let entriesChunk = 0;
  for await (const block of blocks) {
    entriesChunk++;
    if (entriesChunk > READING_CYCLES_BEFORE_REST) {
      entriesChunk = 0;
      await restRegularly();
    }

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

          entriesChunk++;
          if (entriesChunk > READING_CYCLES_BEFORE_REST) {
            entriesChunk = 0;
            await restRegularly();
          }
        } catch (error) {
          if (!errors.length) console.error(error);
          errors.push(error);
        }
      }
    }
  }

  /** @type {import('./firehose').FirehoseRecord[]} */
  const records = [];

  entriesChunk = 0;
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

    // let's recreate the record, to pack the GC and avoid deoptimized objects
    records.push({ ...record });

    entriesChunk++;
    if (entriesChunk > COLLECTING_CYCLES_BEFORE_REST) {
      entriesChunk = 0;
      await restRegularly();
    }
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
    const sleep = typeof options?.sleep === 'number' ? options.sleep : 200;
    if (now - lastRest > sleep) {
      lastRest = now;
      return new Promise(resolve => setTimeout(resolve, 1)).then(setLastRestNow);
    }
  }

  function setLastRestNow() {
    lastRest = Date.now();
  }
}
