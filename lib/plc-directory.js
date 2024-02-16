// @ts-check

import { streamBuffer } from '../src/api/akpa';
import { retryFetch } from '../src/api/retry-fetch';
import { shortenDID, shortenHandle, shortenPDC } from './shorten';

/**
 * @typedef {{
 *  fetch?: typeof retryFetch
 * }} Overrides
 */

/**
 * @typedef {{
 *  did: string,
 *  cid: string,
 *  nullified: boolean,
 *  createdAt: string,
 *  operation: {
 *    type: 'create' | 'plc_operation',
 *    sig: string,
 *    alsoKnownAs?: string[],
 *    handle?: string,
 *    prev: string | null,
 *    service?: string,
 *    services?: {
 *      atproto_pds?: {
 *        type: 'AtprotoPersonalDataServer',
 *        endpoint: string
 *      }
 *    },
 *    rotationKeys: any[],
 *    verificationMethods: {}
 *  }
 * }} PLCDirectoryEntry
 */

const FETCH_AHEAD_MSEC_MAX = 10000;
const FETCH_AHEAD_COUNT_MAX = 10000

/**
 * @param {string | Date | number | null} [since]
 * @param {Overrides} [overrides]
 * @returns {AsyncGenerator<{ entries: PLCDirectoryEntry[], overlap: number }>}
 */
export function plcDirectory(since, overrides) {
  const useFetch = overrides?.fetch || fetch;
  return streamBuffer(async stream => {
    const EXPORT_URL = 'https://plc.directory/export';

    let sinceTime;
    if (since) {
      if (typeof since === 'string') {
        since = new Date(since);
      } else if (typeof since === 'number') {
        since = new Date(since);
      }

      if (Number.isFinite(since.getTime()))
        sinceTime = since.toISOString();
    }

    const lastChunkLines = new Set();
    let lastWaitedForConsumptionAt = Date.now();
    let collectedEntriesSinceLastWaitedForConsumption = 0;

    while (true) {
      const nextChunkRe = await useFetch(
        EXPORT_URL + (sinceTime ? '?after=' + sinceTime : '')
      );

      if (stream.isEnded) return;

      const nextChunkText = await nextChunkRe.text();

      const chunkLines = nextChunkText.split('\n');
      let overlap = 0;
      const nextChunkEnitres = [];
      for (const line of chunkLines) {
        if (lastChunkLines.has(line)) {
          overlap++;
          continue;
        }

        if (!line) continue;
        nextChunkEnitres.push(JSON.parse(line));
      }

      if (nextChunkEnitres.length) {
        lastChunkLines.clear();
        for (const line of chunkLines) {
          lastChunkLines.add(line);
        }

        collectedEntriesSinceLastWaitedForConsumption += nextChunkEnitres.length;
      }

      const waitForConsumption = stream.yield(
        { entries: nextChunkEnitres, overlap },
        (buffer, item) => {
          if (!buffer) return item;
          buffer.entries = buffer.entries.concat(item.entries);
          buffer.overlap += item.overlap;
          return buffer;
        }
      );
      if (stream.isEnded) return;

      const shouldWaitForConsumption =
        collectedEntriesSinceLastWaitedForConsumption > FETCH_AHEAD_COUNT_MAX ||
        Date.now() - lastWaitedForConsumptionAt > FETCH_AHEAD_MSEC_MAX ||
        !nextChunkEnitres.length;
      
      if (shouldWaitForConsumption) {
        await waitForConsumption;
        if (stream.isEnded) return;
      }

      /** @type {Date | undefined} */
      let nextSinceTime;
      // iterate backwards to find timestamp just before latest
      for (let i = 0; i < nextChunkEnitres.length; i++) {
        const entry = nextChunkEnitres[nextChunkEnitres.length - i - 1];
        if (entry.createdAt) {
          const timestamp = new Date(entry.createdAt);
          if (!nextSinceTime && timestamp.getTime()) {
            nextSinceTime = timestamp;
          } else if (nextSinceTime && timestamp.getTime() &&
            timestamp.getTime() < nextSinceTime.getTime()) {
            sinceTime = timestamp.toISOString();
            break;
          }
        }
      }
    }

  });
}

/**
 * @typedef {{
 *  timestamp: number,
 *  shortDID: string,
 *  shortHandle?: string,
 *  shortPDC?: string;
 * }} PLCDirectoryEntryCompact
 */

/**
 * @param {string | Date | number | null} [since]
 * @param {Overrides} [overrides]
 * @returns {AsyncGenerator<{ entries: PLCDirectoryEntryCompact[] }>}
 */
export async function* plcDirectoryCompact(since, overrides) {
  const iteration = plcDirectory(since, overrides);
  for await (const chunk of iteration) {
    const compactEntries = [];
    for (const entry of chunk.entries) {
      const timestamp = new Date(entry.createdAt).getTime();
      const compact = {
        timestamp,
        shortDID: shortenDID(entry.did),
        shortHandle: shortenHandle(
          entry.operation.alsoKnownAs?.[0] || entry.operation.handle),
        shortPDC: shortenPDC(
          entry.operation.services?.atproto_pds?.endpoint ||
          entry.operation.service)
      };
      compactEntries.push(compact);
    }

    yield { entries: compactEntries };
  }
}