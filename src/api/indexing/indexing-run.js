// @ts-check
/// <reference path="./types.d.ts" />

import { plcDirectoryCompact } from '../../../lib/plc-directory';
import { parseTimestampOffset, timestampOffsetToString } from '../../../lib/shorten';
import { retryFetch } from '../retry-fetch';
import { createEmptyStore, deriveStoreFilenameFromTimestamp, parseRegistrationStore } from './persistence';

/**
 * @typedef {{
 *  read(path: string): Promise<string | undefined>,
 *  fetch?: typeof fetch
 * }} IndexingRunParams
 */

/**
 * @typedef {{
 *  stores: RegistrationStore[],
 *  affectedStores?: RegistrationStore[],
 *  affectedShortDIDs?: string[],
 *  addedShortDIDs?: string[],
 *  earliestRegistration?: number,
 *  latestRegistration?: number,
 *  latestAction?: number,
 *  loadedAllStores?: boolean
 * }} IndexingRunProgress
 */

const MAX_STORE_SIZE = 50_000;

/**
 * @param {IndexingRunParams} params
 * @returns {AsyncIterable<IndexingRunProgress>}
 */
export async function* indexingRun({ read, fetch: useFetch }) {
  /** @type {RegistrationStore[]} */
  let stores = [];

  /** @type {Map<string, RegistrationStore>} */
  const storeByShortDID = new Map();
  let maxDate = new Date('2022-11-01').getTime();
  for await (const progress of loadAllStores({ read })) {
    stores = progress.stores;

    for (const store of stores) {
      for (const shortDID of store.keys()) {
        storeByShortDID.set(shortDID, store);

        if (store.latestRegistration > maxDate)
          maxDate = store.latestRegistration;
      }
      // validateStore(store);
    }
    yield progress;
  }

  if (!useFetch) useFetch = (req, opts) => retryFetch(req, { ...opts, nocorsproxy: true });

  console.log(
    '\n\n\nSTARTING TO PULL DIRECTORY', new Date(maxDate).toISOString());
  
  for await (const progress of pullDirectory({ stores, storeByShortDID, startDate: maxDate, fetch: useFetch })) {
    stores = progress.stores;
    for (const store of stores) {
      validateStore(store);
    }

    yield progress;
    //break;
  }
}

/** @param {RegistrationStore} store */
function validateStore(store) {
  let firstDate = 0;
  let firstDateSource = 'uninitialized';
  const invalidDates = [];
  for (const { date, source } of dates()) {
    if (!firstDate) {
      firstDate = date;
      firstDateSource = source;
    }

    if (getMonthStart(date) !== getMonthStart(firstDate)) {
      invalidDates.push({ date, source });
    }
  }

  if (invalidDates.length) {
    throw new Error(
      invalidDates.length + ' Invalid dates in store ' + store.file + ':\n  ' +
      invalidDates.map(({date, source}) => '[' + new Date(date).toLocaleDateString() + '] ' + source).join('\n  ') +
      '\nfirstDate ' + firstDateSource + ' ' + new Date(firstDate).toLocaleDateString());
  }

  function* dates() {
    yield { date: store.earliestRegistration, source: 'earliestRegistration' };
    yield { date: store.latestRegistration, source: 'latestRegistration' };
    // yield { date: store.latestAction, source: 'latestAction' };

    let carryTimestamp = 0;
    for (const shortDID of store.keys()) {
      if (shortDID === 'next') throw new Error('next should not be a shortDID key');
      const history = store.get(shortDID);
      if (!history) throw new Error('No history for shortDID ' + shortDID);
      yield { date: history.created, source: 'history[' + shortDID + '].created' };

      const update = history.updates[0];
      if (!carryTimestamp) carryTimestamp = new Date(update.t).getTime();
      else carryTimestamp += parseTimestampOffset(update.t) || 0;

      // history.created can differ by up to 1 second due to rounding
      if (Math.abs(carryTimestamp - history.created) > 1001)
        throw new Error(
        store.file + ' ' + shortDID + ' ' +
        'carryTimestamp !== history.created ' +
        (history.created - carryTimestamp) + 'ms ' +
        new Date(carryTimestamp).toISOString() + ' !== ' +
        new Date(history.created).toISOString() + ' ' + shortDID + ' ' + store.file + ' ' + JSON.stringify(update));

      yield { date: carryTimestamp, source: 'history[' + shortDID + '].updates[0] ' + JSON.stringify(update) };
    }
  }
}

/**
 * @param {{
 *  stores: RegistrationStore[],
 *  storeByShortDID: Map<string, RegistrationStore>,
 *  startDate: number,
 *  fetch?: typeof fetch
 * }} _
 * @returns {AsyncIterable<IndexingRunProgress>}
 */
async function* pullDirectory({ stores, storeByShortDID, startDate, fetch }) {

  for await (const chunk of plcDirectoryCompact(startDate, { fetch })) {
    const affectedShortDIDs = new Set();
    const affectedStores = new Set();

    /** @type {number | undefined} */
    let earliestRegistration;
    /** @type {number | undefined} */
    let latestRegistration;
    /** @type {number | undefined} */
    let latestAction;

    /** @type {string[]} */
    let addedShortDIDs = [];

    for (const entry of chunk.entries) {
      if (affectedShortDIDs.has(entry.shortDID) && !storeByShortDID.has(entry.shortDID)) {
        console.warn('How is it possible for affectedShortDIDs.has(entry.shortDID) but not storeByShortDID.has(entry.shortDID) ', entry.shortDID);
        console.log();
      }

      // /** @type {HistoryChange} */
      // const historyChange = {
      //   h: clampShortHandle(entry.shortHandle),
      //   p: entry.shortPDC
      // };

      const existingStore = storeByShortDID.get(entry.shortDID);
      if (existingStore) {
        // update history for the already registered shortDID
        const existingHistory = /** @type {RegistrationHistory} */(
          existingStore.get(entry.shortDID));
        if (!addHistoryToExistingShortDID(existingHistory, entry)) {
          // no update required
          continue;
        }

        if (!latestAction || entry.timestamp > latestAction)
          latestAction = entry.timestamp;

        affectedStores.add(existingStore);
        affectedShortDIDs.add(entry.shortDID);
      } else {
        affectedShortDIDs.add(entry.shortDID);

        /** @type {RegistrationHistory} */
        const history = {
          created: entry.timestamp,
          updates: [{
            t: new Date(entry.timestamp).toISOString(),
            h: clampShortHandle(entry.shortHandle),
            p: entry.shortPDC === '.s' ? undefined : entry.shortPDC
          }]
        };

        addedShortDIDs.push(entry.shortDID);
        if (addedShortDIDs.length > affectedShortDIDs.size) {
          console.warn('How is it possible for [', addedShortDIDs.length, ']addedShortDIDs.length > [' + affectedShortDIDs.size + ']affectedShortDIDs.size');
          console.log();
        }

        if (!earliestRegistration || entry.timestamp < earliestRegistration)
          earliestRegistration = entry.timestamp;
        if (!latestRegistration || entry.timestamp > latestRegistration)
          latestRegistration = entry.timestamp;
        if (!latestAction || entry.timestamp > latestAction)
          latestAction = entry.timestamp;

        const { store, insertStoreAt } = findStoreToAddTimestamp(stores, entry.timestamp);
        if (store) {
          affectedStores.add(store);
          // insert into the store
          if (!store.latestRegistration || entry.timestamp >= store.latestRegistration) {
            // at the end
            addNewShortDIDToExistingStoreEnd(store, history, entry);
          } else {
            // in the middle: recreate the store
            addNewShortDIDToExistingStoreMiddle(store, history, entry);
          }

          storeByShortDID.set(entry.shortDID, store);
          affectedStores.add(store);
        } else {
          // add a new store
          const { newStore, prevStore } = createNewStoreAddShortDID(stores, insertStoreAt, history, entry);

          storeByShortDID.set(entry.shortDID, newStore);
          stores.push(newStore);

          affectedStores.add(newStore);
          if (prevStore) affectedStores.add(prevStore);
        }
      }
   }

    yield {
      stores: stores,
      loadedAllStores: true,
      addedShortDIDs,
      affectedShortDIDs: Array.from(affectedShortDIDs),
      affectedStores: Array.from(affectedStores),
      earliestRegistration,
      latestRegistration,
      latestAction
    };

    earliestRegistration = latestRegistration = latestAction = undefined;
  }
}

/**
 * @param {RegistrationHistory} history
 * @param {import('../../../lib/plc-directory').PLCDirectoryEntryCompact} entry
 */
function addHistoryToExistingShortDID(history, entry) {
  const clampedShortHandle = entry.shortHandle ? clampShortHandle(entry.shortHandle) : undefined;
  const defaultedPDC = entry.shortPDC === '.s' ? undefined : entry.shortPDC;

  let firstHistoryEntry = true;
  let carryTimestamp = history.created;
  let carryClampedShortHandle;
  let carryPDC;
  for (let i = 0; i < history.updates.length; i++) {
    const existingUpdate = history.updates[i];
    const dateOrTimestamp = existingUpdate.t;
    let carryTimestampNext =
      firstHistoryEntry ? carryTimestamp :
        carryTimestamp += parseTimestampOffset(dateOrTimestamp) || 0;

    if (firstHistoryEntry) firstHistoryEntry = false;

    if (carryTimestampNext > entry.timestamp) {
      console.warn(
        'Past history update? ',
        {
          entry,
          history,
          carryTimestamp: new Date(carryTimestamp),
          carryTimestampNext: new Date(carryTimestampNext)
        }
      );

      const updateRequired = checkUpdateRequired(clampedShortHandle, defaultedPDC, carryClampedShortHandle, carryPDC);
      if (!updateRequired) return false;

      history.updates.splice(i, 0, {
        t: timestampOffsetToString(entry.timestamp - carryTimestamp),
        h: clampedShortHandle === carryClampedShortHandle ? undefined : clampedShortHandle,
        p: defaultedPDC === carryPDC ? undefined : defaultedPDC
      });

      return true;
    }

    carryTimestamp = carryTimestampNext;
    if (existingUpdate.h) carryClampedShortHandle = existingUpdate.h;
    if (existingUpdate.p) carryPDC = existingUpdate.p;
  }

  const updateRequired = checkUpdateRequired(clampedShortHandle, defaultedPDC, carryClampedShortHandle, carryPDC);
  if (!updateRequired) return false;

  history.updates.push({
    t: timestampOffsetToString(entry.timestamp - carryTimestamp),
    h: clampedShortHandle === carryClampedShortHandle ? undefined : clampedShortHandle,
    p: defaultedPDC === carryPDC ? undefined : defaultedPDC
  });

  return true;
}

/**
 * @param {string | undefined} clampedShortHandle
 * @param {string | undefined} defaultedPDC
 * @param {string | undefined} carryClampedShortHandle
 * @param {string | undefined} carryPDC
 */
function checkUpdateRequired(clampedShortHandle, defaultedPDC, carryClampedShortHandle, carryPDC) {
  const updateRequired =
    (clampedShortHandle || carryClampedShortHandle) && clampedShortHandle !== carryClampedShortHandle ||
    (defaultedPDC || carryPDC) && defaultedPDC !== carryPDC;
  return updateRequired;
}

/**
 * @param {RegistrationStore} store
 * @param {RegistrationHistory} history
 * @param {import('../../../lib/plc-directory').PLCDirectoryEntryCompact} entry
 */
function addNewShortDIDToExistingStoreEnd(store, history, entry) {
  store.set(entry.shortDID, history);
  if (!store.earliestRegistration) store.earliestRegistration = entry.timestamp;

  if (store.latestRegistration) {
    // store history start as a relative offset from the latest registration
    history.updates[0].t = timestampOffsetToString(entry.timestamp - store.latestRegistration);
  }
  store.latestRegistration = entry.timestamp;

  if (!store.latestAction || entry.timestamp > store.latestAction)
    store.latestAction = entry.timestamp;
}

/**
 * @param {RegistrationStore} store
 * @param {RegistrationHistory} history
 * @param {import('../../../lib/plc-directory').PLCDirectoryEntryCompact} entry
 */
function addNewShortDIDToExistingStoreMiddle(store, history, entry) {
  const entries = Array.from(store.entries());
  store.clear();

  let added = false;
  let prevTimestamp = 0;
  for (const [existingShortDID, existingHistory] of entries) {
    if (entry.timestamp > existingHistory.created) {

      // we are into history after the entry was created
      if (!added) {
        // not added: this is the place to add
        if (prevTimestamp) {
          // this condition would happen always,
          // unless strange situation where the insert is needed before the first entry
          history.updates[0].t = timestampOffsetToString(entry.timestamp - prevTimestamp);
        }

        store.set(entry.shortDID, history);
        prevTimestamp = history.created; // subsequent entry should offset from this newly added
        added = true;
      }

      // all subsequent entries should get recalculated timestamps
      history.updates[0].t = timestampOffsetToString(existingHistory.created - prevTimestamp);
    }
    store.set(existingShortDID, existingHistory);
    prevTimestamp = existingHistory.created;
  }

  if (!store.has(entry.shortDID)) {
    console.warn(
      'This shortDID should not appear at the end according to latestCreation ' +
      new Date(/** @type {number} */(store.latestRegistration)) +
      ' being after' + new Date(history.created),
      { entry, store });
    store.set(entry.shortDID, history);
  }

  if (!store.latestAction || entry.timestamp > store.latestAction)
    store.latestAction = entry.timestamp;
}

/**
 * @param {RegistrationStore[]} stores
 * @param {number} insertStoreAt
 * @param {RegistrationHistory} history
 * @param {import('../../../lib/plc-directory').PLCDirectoryEntryCompact} entry
 */
function createNewStoreAddShortDID(stores, insertStoreAt, history, entry) {
  const prevStore = stores[insertStoreAt - 1];

  const file = deriveStoreFilenameFromTimestamp(
    prevStore?.values().next().value?.created,
    entry.timestamp);

  const newStore = createEmptyStore(file);
  newStore.next = prevStore?.next;
  if (prevStore) prevStore.next = file;

  newStore.latestAction =
    newStore.latestRegistration =
    newStore.earliestRegistration =
    entry.timestamp;

  newStore.set(entry.shortDID, history);
  return { newStore, prevStore };
}

/**
 * @param {RegistrationStore[]} stores
 * @param {number} timestamp
 * @returns {{ store: RegistrationStore, insertStoreAt?: undefined } |
 *  {store?: undefined, insertStoreAt: number }}
 */
function findStoreToAddTimestamp(stores, timestamp) {
  if (!stores?.length) return { insertStoreAt: 0 };

  const latestStore = stores[stores.length - 1];
  if (!latestStore.earliestRegistration || timestamp >= latestStore.earliestRegistration ||
    stores.length === 1) {
    const canAddToExistingStore =
      latestStore.size < MAX_STORE_SIZE &&
      getMonthStart(latestStore.latestRegistration) === getMonthStart(timestamp);

    if (canAddToExistingStore) return { store: latestStore };
    else return { insertStoreAt: stores.length };
  }

  // timestamp falls before the latestStore, probably need to insert in the past history

  const monthStartTimestamp = getMonthStart(timestamp);

  for (let storeIndex = stores.length - 1; storeIndex > 0; storeIndex--) { // if storeIndex hit zero, that's our store
    const tryStore = stores[storeIndex];
    if (timestamp < (tryStore.earliestRegistration || 0)) continue;

    // we found the point!
    // is this within the store's range?

    if (timestamp < (tryStore.latestAction || 0)) return { store: tryStore };

    const nextStore = stores[storeIndex + 1];
    const monthStartNext = getMonthStart(nextStore.earliestRegistration || 0);

    if (monthStartTimestamp === monthStartNext) {
      // nextStore is in the right range
      // but do we have space?
      // (allow expanding stores in the middle a little bit)
      if (nextStore.size < MAX_STORE_SIZE * 1.2) return { store: nextStore };
      else return { insertStoreAt: storeIndex + 1 };
    } else {
      // neither, insert in between
      return { insertStoreAt: storeIndex + 1 };
    }
  }

  return { insertStoreAt: 0 };
}

const dt = new Date();
function getMonthStart(timestamp) {
  dt.setTime(timestamp);
  dt.setUTCDate(1);
  dt.setUTCHours(0);
  dt.setUTCMinutes(0);
  dt.setUTCSeconds(0);
  dt.setUTCMilliseconds(0);
  return dt.getTime();
}

function clampShortHandle(shortHandle) {
  let clampShortHandle = shortHandle;
  if (clampShortHandle && clampShortHandle.length > 30)
    clampShortHandle = clampShortHandle.slice(0, 25) + '...' + clampShortHandle.slice(-2);
  return clampShortHandle;
}

/**
 * @param {IndexingRunParams} params
 * @returns {AsyncIterable<IndexingRunProgress>}
 */
async function* loadAllStores({ read }) {
  const inceptionText = await read('inception.json');

  /** @type {string | undefined} */
  let next = inceptionText ? JSON.parse(inceptionText).next : undefined;
  if (!next) return yield { stores: [], loadedAllStores: true };

  /** @type {RegistrationStore[]} */
  const stores = [];
  /** @type {number | undefined} */
  let earliestRegistration;
  /** @type {number | undefined} */
  let latestRegistration;
  /** @type {number | undefined} */
  let latestAction;

  while (next) {
    const storeText = await read(next + '.json');
    if (!storeText) break;

    const store = parseRegistrationStore(next, storeText);
    const affectedShortDIDs = Array.from(store.keys());
    if (!earliestRegistration || store.earliestRegistration && store.earliestRegistration < earliestRegistration)
      earliestRegistration = store.earliestRegistration;
    if (!latestRegistration || store.latestRegistration && store.latestRegistration > latestRegistration)
      latestRegistration = store.latestRegistration;
    if (!latestAction || store.latestAction && store.latestAction > latestAction)
      latestAction = store.latestAction;

    stores.push(store);

    if (!store.next) {
      yield {
        loadedAllStores: true,
        stores, // last yield, return raw underlying array
        earliestRegistration,
        latestRegistration,
        latestAction,
        affectedStores: [store],
        affectedShortDIDs,
        addedShortDIDs: affectedShortDIDs
      };
      return;
    }

    next = store.next;
    yield {
      loadedAllStores: false,
      stores: stores.slice(),
      earliestRegistration,
      latestRegistration,
      latestAction,
      affectedStores: [store],
      affectedShortDIDs
    };
    earliestRegistration = latestRegistration = latestAction = undefined;
  }

  yield {
    loadedAllStores: true,
    stores, // last yield, return raw underlying array
    earliestRegistration,
    latestRegistration,
    latestAction
    // no affectedStores or affectedShortDIDs - last read was empty
  };
}