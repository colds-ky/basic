// @ts-check

import {
  addExtension as cbor_x_addExtension,
  decodeMultiple as cbor_x_decodeMultiple,
  decode as cbor_x_decode
} from 'cbor-x';
import { CarReader as ipld_CarReader } from '../node_modules/@ipld/car/src/reader-browser.js';
import { ensureCborXExtended, known$Types } from './firehose';
import { unwrapShortDID } from './shorten.js';
import { CID } from 'multiformats';

/**
 * @param {string} shortDID
 * @param {ArrayBuffer | Uint8Array} messageBuf
 */
export async function readCAR(shortDID, messageBuf) {
  const bytes = messageBuf instanceof ArrayBuffer ? new Uint8Array(messageBuf) : messageBuf;

  const car = await ipld_CarReader.fromBytes(bytes);

  const recordsByCID = new Map();
  const keyByCID = new Map();
  for await (const block of car.blocks()) {
    const record = cbor_x_decode(block.bytes);
    if (record.$type) recordsByCID.set(String(block.cid), record);
    else if (Array.isArray(record.e)) {
      let key = '';
      const decoder = new TextDecoder();
      for (const sub of record.e) {
        const keySuffix = decoder.decode(sub.k);
        key = key.slice(0, sub.p || 0) + keySuffix;
        const expandWithoutZero =
          sub.v.value[0] ? sub.v.value :
          /** @type {Uint8Array} */(sub.v.value).subarray(1);

        try {
          const cid = CID.decode(expandWithoutZero);
          keyByCID.set(String(cid), key);
        } catch (error) {
        }
      }
    }
  }

  /** @type {import('./firehose').FirehoseRecord[]} */
  const records = [];

  const fullDID = unwrapShortDID(shortDID);
  for (const [cid, record] of recordsByCID) {
    const key = keyByCID.get(cid);
    if (key) {
      record.uri = 'at://' + fullDID + key;
    }
    records.push(record);
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
}
