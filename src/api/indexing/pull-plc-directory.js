// @ts-check

import fs from 'fs';
import path from 'path';

import { plcDirectoryCompact } from '../../../lib/plc-directory';
import { parseTimestampOffset, timestampOffsetToString } from '../../../lib/shorten';

export async function pullPLCDirectoryCompact() {
  console.log('PLC directory CACHE');

  const directoryPath = path.resolve(__dirname, 'src/api/indexing/repos/directory');
  console.log('Reading directory files...');
  const wholeDirectory = readAllDirectoryFiles(directoryPath);
  let maxDate = 0;
  for (const history of Object.values(wholeDirectory)) {
    for (const entry of history) {
      if (entry.timestamp > maxDate) maxDate = entry.timestamp;
    }
  }

  console.log('Pulling PLC directory...');
  let lastChunkEntry;
  for await (const chunk of plcDirectoryCompact(maxDate - 1000)) {
    if (!chunk.entries.length) {
      console.log('No new entries, last ', lastChunkEntry || new Date(maxDate));
      continue;
    }

    lastChunkEntry = chunk.entries[chunk.entries.length - 1];

    console.log(
      chunk.entries.length,
      { ...chunk.entries[0], timestamp: new Date(chunk.entries[0].timestamp).toISOString() },
      '...',
      {...chunk.entries[chunk.entries.length - 1], timestamp: new Date(chunk.entries[chunk.entries.length - 1].timestamp).toISOString() });

    for (const entry of chunk.entries) {
      const historyEntry = {
        timestamp: entry.timestamp,
        shortHandle: entry.shortHandle,
        shortPDC: entry.shortPDC
      };

      const dirEntry = wholeDirectory[entry.shortDID];
      if (!dirEntry) wholeDirectory[entry.shortDID] = [historyEntry];
      else dirEntry.push(historyEntry);
    }


    console.log('saving...');
    saveAllDirectoryFiles(directoryPath, wholeDirectory);
    console.log('OK.\n\n');
  }
}

/**
 * @param {string} directoryPath
 * @param {{
 *  [shortDID: string]: HistoryEntry[];
 * }} wholeDirectory 
 */
function saveAllDirectoryFiles(directoryPath, wholeDirectory) {
  /** @type {{ [yearMonth: string]: { [shortDID: string]: HistoryEntry[] } }} */
  const byMonth = {};
  for (const [did, history] of Object.entries(wholeDirectory)) {
    const dt = new Date(history[0].timestamp);
    const yearMonth = dt.getUTCFullYear() + '/' + (dt.getUTCMonth() + 1);

    const monthMap = byMonth[yearMonth] || (byMonth[yearMonth] = {});
    monthMap[did] = history;
  }

  for (const [yearMonth, monthMap] of Object.entries(byMonth)) {
    const directoryJSON = path.join(directoryPath, yearMonth + '.json');
    if (!fs.existsSync(path.dirname(directoryJSON)))
      fs.mkdirSync(path.dirname(directoryJSON), { recursive: true });

    let saveJSON = '{\n';

    let carryTimestamp = Date.UTC(parseInt(yearMonth.split('/')[0]), parseInt(yearMonth.split('/')[1]) - 1, 1, 0, 0, 0, 0);
    let firstShortDID = true;

    const orderDIDs = Object.keys(monthMap).sort((shortDID1, shortDID2) => monthMap[shortDID1][0].timestamp - monthMap[shortDID2][0].timestamp);
    for (const shortDID of orderDIDs) {
      if (firstShortDID) firstShortDID = false;
      else saveJSON += ',\n';

      saveJSON += JSON.stringify(shortDID) + ':{';

      const history = monthMap[shortDID];

      let timestamp = carryTimestamp;
      let first = true;
      for (const entry of history) {
        if (first) {
          first = false;
          carryTimestamp = entry.timestamp;
        }
        else {
          saveJSON += ',';
        }

        const dtOffset = timestampOffsetToString(entry.timestamp - timestamp);
        timestamp = entry.timestamp;

        saveJSON += JSON.stringify(dtOffset) + ':' + JSON.stringify({
          h: !entry.shortHandle ? undefined : entry.shortHandle.length > 20 ? entry.shortHandle.slice(0, 15) + '..' + entry.shortHandle.slice(-3) : entry.shortHandle,
          p: entry.shortPDC
        });
      }
      saveJSON += '}';
    }

    saveJSON += '\n}\n';

    fs.writeFileSync(directoryJSON, saveJSON);
  }
}

/**
 * @typedef {{
 *  timestamp: number,
 *  shortHandle?: string,
 *  shortPDC?: string
 * }} HistoryEntry
 */

/**
 * @typedef {{
 *  h?: string,
 *  p?: string
 * }} CompactHistoryEntry
 */

function readAllDirectoryFiles(directoryPath) {
  let year = 2022, month = 11;

  const untilYear = new Date().getUTCFullYear(), untilMonth = new Date().getUTCMonth() + 1;

  /** @type { {[shortDID: string]: HistoryEntry[] }} */
  const wholeDirectory = {};

  while (year < untilYear || (year === untilYear && month <= untilMonth)) {
    const monthStr = month.toString();
    const directoryJSON = path.join(directoryPath, year.toString(), monthStr + '.json');

    if (fs.existsSync(directoryJSON)) {
      // { did: { dtOffset: { h: 'handle', p: 'pdc' }, dtOffset1: {h:'handle', p: 'pdc'} }  }
      const directoryObj = JSON.parse(fs.readFileSync(directoryJSON, 'utf-8'));
      let carryTimestamp = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);

      for (const [did, history] of Object.entries(directoryObj)) {
        if (!wholeDirectory[did]) wholeDirectory[did] = [];

        let first = true;
        let timestamp = carryTimestamp;
        for (const [dtOffsetStr, compact] of Object.entries(history)) {
          const dtOffset = parseTimestampOffset(dtOffsetStr);
          if (first) {
            carryTimestamp += dtOffset;
            first = false;
          }
          timestamp += dtOffset;

          wholeDirectory[did].push({
            timestamp,
            shortHandle: !compact.h ? undefined : compact.h.length > 20 ? compact.h.slice(0, 15) + '..' + compact.h.slice(-3) : compact.h,
            shortPDC: compact.p
          });
        }
      }
    }

    month++;
    if (month > 12) {
      year++;
      month = 1;
    }
  }

  return wholeDirectory;
}

