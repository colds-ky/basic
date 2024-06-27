// @ts-check

import { streamBuffer } from '../src/api/akpa';
import { retryFetch } from '../src/api/retry-fetch';

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
 *    prev: string | null,
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
 * @returns {AsyncGenerator<{ entries: PLCDirectoryEntry[] }>}
 */
export async function* plcDirectory(since, overrides) {
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
        EXPORT_URL + (sinceTime ? '?since=' + sinceTime : '')
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

        nextChunkEnitres.push(JSON.parse(line));
      }

      if (nextChunkEnitres.length) {
        lastChunkLines.clear();
        for (const line of chunkLines) {
          lastChunkLines.add(line);
        }

        collectedEntriesSinceLastWaitedForConsumption += nextChunkEnitres.length;
      }

      const waitForConsumption = stream.yield({ entries: nextChunkEnitres });
      if (stream.isEnded) return;

      const shouldWaitForConsumption =
        collectedEntriesSinceLastWaitedForConsumption > FETCH_AHEAD_COUNT_MAX ||
        Date.now() - lastWaitedForConsumptionAt > FETCH_AHEAD_MSEC_MAX ||
        !nextChunkEnitres.length;
      
      if (shouldWaitForConsumption) {
        await waitForConsumption;
        if (stream.isEnded) return;
      }
    }

  });
}