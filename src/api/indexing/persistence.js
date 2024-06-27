// @ts-check
/// <reference path="./types.d.ts" />

import { parseTimestampOffset } from '../../../lib/shorten';

/** @extends {Map<string, RegistrationHistory>} */
class MapExtended extends Map {
  file = '';
  next = undefined;
  earliestRegistration = 0;
  latestRegistration = 0;
  latestAction = 0;
}

/**
 * @typedef {Record<string, HistoryChange[]> & { next?: string }} PersistedStore
 */

/**
 * @param {string} file
 * @param {string} jsonText
 * @returns {RegistrationStore}
 */
export function parseRegistrationStore(file, jsonText) {
  /** @type {PersistedStore} */
  const bucketMap = JSON.parse(jsonText);

  const store = createEmptyStore(file);

  let carryTimestamp = 0;
  for (const shortDID in bucketMap) {
    if (shortDID === 'next') {
      store.next = bucketMap.next;
      continue;
    }

    /** @type {HistoryChange[]} */
    const registrationHistory = bucketMap[shortDID];
    for (const entry of registrationHistory) {
      if (!carryTimestamp) carryTimestamp = new Date(entry.t).getTime();
      else carryTimestamp += parseTimestampOffset(entry.t) || 0;
      break;
    }

    const registrationEntry = {
      created: carryTimestamp,
      updates: registrationHistory
    };
    updateRanges(carryTimestamp, store);
    updateLatestCreation(carryTimestamp, store);

    let carryHistoryOffset = 0;
    let firstHistoryEntry = true;
    for (const dateOrTimestamp in registrationHistory) {
      if (firstHistoryEntry) {
        firstHistoryEntry = false;
        continue;
      }

      carryHistoryOffset += parseTimestampOffset(dateOrTimestamp) || 0;
      updateRanges(carryTimestamp + carryHistoryOffset, store);
    }

    store.set(shortDID, registrationEntry);
  }

  return store;
}

/**
 * @param {number | undefined} prevTimestamp
 * @param {number} timestamp
 */
export function deriveStoreFilenameFromTimestamp(prevTimestamp, timestamp) {
  const dt = new Date(timestamp);
  const dtPrev = prevTimestamp ? new Date(prevTimestamp) : undefined;

  // 2024-02/4
  let filename =
    dt.getUTCFullYear() + '-' +
    (101 + dt.getUTCMonth()).toString().slice(1) + '/' +
    dt.getUTCDate();

  if (dt.getUTCFullYear() === dtPrev?.getUTCFullYear() &&
    dt.getUTCMonth() === dtPrev?.getUTCMonth() &&
    dt.getUTCDate() === dtPrev?.getUTCDate()) {

    // 2024-02/4-634
    filename +=
      '-' + dt.getUTCHours().toString().slice(1) +
      (101 + dt.getUTCMinutes()).toString().slice(1);
    
    if (dt.getUTCHours() === dtPrev.getUTCHours() &&
      dt.getUTCMinutes() === dtPrev.getUTCMinutes()) {
      // 2024-02/4-634-12
      filename +=
        '-' + (101 + dt.getUTCSeconds()).toString().slice(1);

      if (dt.getUTCSeconds() === dtPrev.getUTCSeconds()) {
        filename +=
          '_' + (1001 + dt.getUTCMilliseconds()).toString().slice(1);
        
        if (dt.getUTCMilliseconds() === dtPrev.getUTCMilliseconds()) {
          filename +=
            '-' + Math.random().toString(36).slice(2, 4);
        }
      }
    }
  }

  return filename;
}

/** @param {string} file */
export function createEmptyStore(file) {
  const store = /** @type {RegistrationStore} */(
    new MapExtended());
  store.file = file;
  return store;
}

/**
 * @param {number | undefined} timestamp
 * @param {RegistrationStore} store
 */
function updateRanges(timestamp, store) {
  if (!timestamp) return;
  if (!store.earliestRegistration || timestamp < store.earliestRegistration) store.earliestRegistration = timestamp;
  if (!store.latestAction || timestamp > store.latestAction) store.latestAction = timestamp;
}

/**
 * @param {number | undefined} createdTimestamp
 * @param {RegistrationStore} store
 */
function updateLatestCreation(createdTimestamp, store) {
  if (!createdTimestamp) return;
  if (!store.latestRegistration || createdTimestamp > store.latestRegistration) store.latestRegistration = createdTimestamp;
}


/**
 * @param {RegistrationStore} store
 * @returns {string}
 */
export function stringifyRegistrationStore(store) {
  let jsonText = '{\n';
  let first = true;
  for (const shortDID of store.keys()) {
    const registrationEntry = /** @type {RegistrationHistory} */(store.get(shortDID));
    jsonText += first ?
      '"' + shortDID + '":' + JSON.stringify(registrationEntry.updates) :
      ',\n"' + shortDID + '":' + JSON.stringify(registrationEntry.updates);
    first = false;
  }

  if (store.has('next')) throw new Error('How come store has NEXT?');

  if (store.next) jsonText += ',\n"next":' + JSON.stringify(store.next);
  jsonText += '\n}\n';
  return jsonText;
}