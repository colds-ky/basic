// @ts-check

import { streamBuffer } from '../src/api/akpa';
import { retryFetch } from '../src/api/retry-fetch';
import { shortenDID, shortenHandle, shortenPDC, unwrapShortDID } from './shorten';

/**
 * @typedef {{
 *  fetch?: typeof retryFetch
 * }} Overrides
 */

/** @typedef {import('./data/define-store').PLCDirectoryEntry} PLCDirectoryEntry */
/** @typedef {import('./data/define-store').PlcDirectoryAuditLogEntry} PlcDirectoryAuditLogEntry */

const FETCH_AHEAD_MSEC_MAX = 10000;
const FETCH_AHEAD_COUNT_MAX = 10000

/**
 * @param {string | Date | number | null} [since]
 * @param {Overrides} [overrides]
 * @returns {AsyncGenerator<{ entries: PLCDirectoryEntry[], overlap: number }>}
 */
export function plcDirectoryRaw(since, overrides) {
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
  const iteration = plcDirectoryRaw(since, overrides);
  for await (const chunk of iteration) {
    const compactEntries = [];
    for (const entry of chunk.entries) {
      const timestamp = Date.parse(entry.createdAt);
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

/**
 * @param {string} shortDID
 * @param {Overrides} [overrides]
 * @returns {Promise<PlcDirectoryAuditLogEntry[]>}
 */
export async function plcDirectoryHistoryRaw(shortDID, overrides) {
  const useFetch = overrides?.fetch || fetch;
  const fullDID = unwrapShortDID(shortDID);
  /** @type {PlcDirectoryAuditLogEntry[]} */
  const entries = await useFetch(`https://plc.directory/${fullDID}/log/audit`).then(x => x.json());
  return entries;
}

/**
 * @param {string} shortDID
 * @param {Overrides} [overrides]
 * @returns {Promise<PLCDirectoryEntryCompact[]>}
 */
export async function plcDirectoryHistoryCompact(shortDID, overrides) {
  const entries = await plcDirectoryHistoryRaw(shortDID, overrides);
  const compactEntries = [];
  for (const entry of entries) {
    const timestamp = Date.parse(entry.createdAt);
    const compact = {
      timestamp,
      shortDID: shortenDID(entry.did),
      shortHandle: shortenHandle(
        entry.operation.alsoKnownAs?.[0] || /** @type {*} */(entry.operation).handle),
      shortPDC: shortenPDC(
        entry.operation.services?.atproto_pds?.endpoint ||
        /** @type {*} */(entry.operation).service)
    };
    compactEntries.push(compact);
  }
  return compactEntries;
}