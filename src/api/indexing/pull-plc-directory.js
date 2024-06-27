// @ts-check

import fs from 'fs';
import path from 'path';

import { plcDirectoryCompact } from '../../../lib/plc-directory';
import { parseTimestampOffset, timestampOffsetToString } from '../../../lib/shorten';
import { retryFetch } from '../retry-fetch';

const alertIfRecent = new Date(2023, 11, 1);

export async function pullPLCDirectoryCompact() {
  console.log('PLC directory CACHE');

  const directoryPath = path.resolve(__dirname, 'src/api/indexing/repos/directory');
  console.log('Reading new directory files now...');
  const wholeDirectory = readAllDirectoryFiles(directoryPath);
  let maxDate = 0;
  let maxContext;
  for (const [shortDID, history] of Object.entries(wholeDirectory)) {
    for (const entry of history) {
      if (entry.timestamp > maxDate) {
        if (entry.timestamp > alertIfRecent.getTime()) {
          console.log(shortDID, history);
          throw new Error('Incorrect timestamp! ' + new Date(entry.timestamp));
        }

        maxDate = entry.timestamp;
        maxContext = { [shortDID]: history };
      }
    }
  }

  console.log('last: ', new Date(maxDate), ' ', maxContext);

  console.log('Saving in new format...');
  await saveAllDirectoryFiles(directoryPath, wholeDirectory);

  let lastSave = Date.now();

  console.log('Pulling PLC directory: ', new Date(maxDate), '...');
  let lastChunkEntry;
  for await (const chunk of plcDirectoryCompact(maxDate - 1000, { fetch: (req, opts) => retryFetch(req, { ...opts, nocorsproxy: true }) })) {
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
        shortHandle:
          !entry.shortHandle ? undefined :
            entry.shortHandle.length > 20 ? entry.shortHandle.slice(0, 15) + '..' + entry.shortHandle.slice(-3) :
              entry.shortHandle,
        shortPDC: entry.shortPDC
      };

      const dirEntry = wholeDirectory[entry.shortDID];
      if (!dirEntry) wholeDirectory[entry.shortDID] = [historyEntry];
      else dirEntry.push(historyEntry);
    }

    if (Date.now() > lastSave + 40000) {
      console.log('saving new format...');
      await saveAllDirectoryFiles(directoryPath, wholeDirectory);
      console.log('OK.\n\n');
      lastSave = Date.now();
    }
  }
}

/**
 * @param {string} directoryPath
 * @param {{
 *  [shortDID: string]: HistoryEntry[];
 * }} wholeDirectory 
 */
async function saveAllDirectoryFiles(directoryPath, wholeDirectory) {
  const shortDIDsRaw = Object.keys(wholeDirectory);
  const shortDIDsOrdered = shortDIDsRaw.slice().sort((shortDID1, shortDID2) => wholeDirectory[shortDID1][0].timestamp - wholeDirectory[shortDID2][0].timestamp);

  let bucket = [];
  for (const shortDID of shortDIDsOrdered) {
    if (bucket.length >= 50000) {
      saveBucket(shortDID);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    bucket.push(shortDID);
  }

  saveBucket();

  function saveBucket(nextShortDID) {
    const localPath = getTimestampFilePath(wholeDirectory[bucket[0]][0].timestamp);
    const filePath = path.resolve(directoryPath, localPath);
    process.stdout.write(' ' + localPath);
    const saveJSON = stringifyDIDs(bucket, wholeDirectory, nextShortDID);
    if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });

    process.stdout.write('.');
    const curTxt = !fs.existsSync(filePath) ? undefined :  fs.readFileSync(filePath, 'utf-8');
    if (curTxt !== saveJSON) {
      process.stdout.write('.');
      fs.writeFileSync(filePath, saveJSON);
    }
    process.stdout.write('.');
    bucket = [];
  }
}

/**
 * @param {string[]} shortDIDs
 * @param {{
 *  [shortDID: string]: HistoryEntry[];
 * }} wholeDirectory
 * @param {string} [nextShortDID]
 */
function stringifyDIDs(shortDIDs, wholeDirectory, nextShortDID) {
  let saveJSON = '{\n';

  let carryTimestamp;
  let commaBeforeNextEntry = false;

  for (const shortDID of shortDIDs) {
    if (commaBeforeNextEntry) saveJSON += ',\n';
    else commaBeforeNextEntry = true;

    saveJSON += JSON.stringify(shortDID) + ':{';

    const history = wholeDirectory[shortDID];

    let timestamp = carryTimestamp;
    let firstHistoryEntry= true;
    for (let iEntry = 0; iEntry < history.length; iEntry++) {
      const entry = history[iEntry];
      const prevEntry = !iEntry ? undefined : history[iEntry - 1];
      if (iEntry && // always include the first entry
        prevEntry?.shortHandle === entry.shortHandle && prevEntry?.shortPDC === entry.shortPDC) continue;

      if (firstHistoryEntry) {
        firstHistoryEntry = false;
        carryTimestamp = entry.timestamp;
      }
      else {
        saveJSON += ',';
      }

      const timestampStr =
        timestamp ? timestampOffsetToString(entry.timestamp - timestamp) : new Date(entry.timestamp).toISOString();
      timestamp = entry.timestamp;

      saveJSON += JSON.stringify(timestampStr) + ':' + JSON.stringify({
        h: entry.shortHandle === prevEntry?.shortHandle ? undefined : entry.shortHandle,
        p: entry.shortPDC === prevEntry?.shortPDC ? undefined : entry.shortPDC
      });
    }

    saveJSON += '}';
  }

  if (nextShortDID) {
    const nextHistory = wholeDirectory[nextShortDID];
    const nextFilePath = getTimestampFilePath(nextHistory[0].timestamp);
    saveJSON += ',\n' + JSON.stringify('next') + ':' + JSON.stringify('..' + nextFilePath);
  }
  saveJSON += '\n}\n';

  return saveJSON;
}

function getTimestampFilePath(timestamp) {
  const dt = new Date(timestamp);
  const path =
    dt.getUTCFullYear() + '/' +
    (dt.getUTCMonth() + 1) + '-' +
    dt.getUTCDate() + '-' +
    dt.getUTCHours() +
    (100 + dt.getMinutes()).toString().slice(1) +
    (100 + dt.getSeconds()).toString().slice(1) + '.json';
  return path;
}

/**
 * @param {string} directoryPath
 * @param {{
 *  [shortDID: string]: HistoryEntry[];
 * }} wholeDirectory 
 */
function saveAllDirectoryFilesOld(directoryPath, wholeDirectory) {
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

  // it's always single file in 2022
  /** @type {string | undefined} */
  let localPath = path.relative(
    directoryPath,
    fs.readdirSync(path.join(directoryPath, '2022')).map(f => path.resolve(directoryPath, '2022', f)).filter(f => f.endsWith('.json'))[0]);

  /** @type { {[shortDID: string]: HistoryEntry[] }} */
  const wholeDirectory = {};
  let filesCount = 0;
  let chCount = 0;

  while (localPath) {
    const directoryJSON = path.join(directoryPath, localPath.replace(/^\.\.\/?/, ''));

    if (!fs.existsSync(directoryJSON)) break;
    process.stdout.write(' ' + localPath);
    localPath = undefined;
    // { did: { dtOffset: { h: 'handle', p: 'pdc' }, dtOffset1: {h:'handle', p: 'pdc'} }  }
    const txt = fs.readFileSync(directoryJSON, 'utf-8');
    chCount += txt.length;
    process.stdout.write('..');
    const directoryObj = JSON.parse(txt);
    process.stdout.write('.');
    let carryTimestamp = 0;

    for (const [shortDID, history] of Object.entries(directoryObj)) {
      if (shortDID === 'next') {
        localPath = history;
        if (localPath?.startsWith('..') && !localPath.startsWith('../')) localPath = '../' + localPath.slice(2);
        continue;
      }

      const historyList = wholeDirectory[shortDID] = [];

      let firstHistoryEntry = true;
      let timestamp = carryTimestamp;
      for (const [dateStr, compact] of Object.entries(history)) {

        if (!carryTimestamp) {
          timestamp = carryTimestamp = new Date(dateStr).getTime();
          firstHistoryEntry = false;
        } else if (firstHistoryEntry) {
          firstHistoryEntry = false;
          carryTimestamp += parseTimestampOffset(dateStr);
          timestamp = carryTimestamp;
        } else {
          timestamp += parseTimestampOffset(dateStr);
        }

        if (timestamp > alertIfRecent.getTime()) {
          console.log(shortDID, history);
          throw new Error('Incorrect timestamp! ' + new Date(timestamp));
        }

        historyList.push({
          timestamp,
          shortHandle: compact.h,
          shortPDC: compact.p
        });
      }
    }

    filesCount++;
  }

  console.log(' ' + filesCount + ' files ' + chCount + ' characters');

  return wholeDirectory;
}

function readAllDirectoryFilesOld(directoryPath) {
  let year = 2022;
  let month = 11;

  const untilYear = new Date().getUTCFullYear(), untilMonth = new Date().getUTCMonth() + 1;

  /** @type { {[shortDID: string]: HistoryEntry[] }} */
  const wholeDirectory = {};
  let filesCount = 0;
  let chCount = 0;

  while (year < untilYear || (year === untilYear && month <= untilMonth)) {
    const localPath = year.toString() + '-/' + month.toString() + '.json';
    const directoryJSON = path.join(directoryPath, localPath);

    if (fs.existsSync(directoryJSON)) {
      process.stdout.write(' ' + localPath);
      // { did: { dtOffset: { h: 'handle', p: 'pdc' }, dtOffset1: {h:'handle', p: 'pdc'} }  }
      const txt = fs.readFileSync(directoryJSON, 'utf-8');
      chCount += txt.length;
      process.stdout.write('..');
      const directoryObj = JSON.parse(txt);
      process.stdout.write('.');
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

          if (timestamp > alertIfRecent.getTime()) {
            console.log(did, history);
            throw new Error('Incorrect timestamp! ' + new Date(timestamp));
          }

          wholeDirectory[did].push({
            timestamp,
            shortHandle: !compact.h ? undefined : compact.h.length > 20 ? compact.h.slice(0, 15) + '..' + compact.h.slice(-3) : compact.h,
            shortPDC: compact.p
          });
        }
      }

      filesCount++;
    }

    month++;
    if (month > 12) {
      year++;
      month = 1;
    }
  }

  console.log(' ' + filesCount + ' files ' + chCount + ' characters');

  return wholeDirectory;
}

