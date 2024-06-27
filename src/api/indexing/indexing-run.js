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

    if (progress.latestAction) maxDate = progress.latestAction;
    for (const store of stores) {
      for (const shortDID of store.keys()) {
        storeByShortDID.set(shortDID, store);
      }
    }
    yield progress;
  }

  if (!useFetch) useFetch = (req, opts) => retryFetch(req, { ...opts, nocorsproxy: true });

  for await (const progress of pullDirectory({ stores, storeByShortDID, startDate: maxDate, fetch: useFetch })) {
    stores = progress.stores;
    yield progress;
  }

}

/**
 * @param {{
 *  stores: RegistrationStore[],
 *  storeByShortDID: Map<string, RegistrationStore>,
 *  startDate: number,
 *  fetch?: typeof fetch
 * }} _
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
      affectedShortDIDs.add(entry.shortDID);

      /** @type {HistoryChange} */
      const historyChange = {
        h: clampShortHandle(entry.shortHandle),
        p: entry.shortPDC
      };

      const existingStore = storeByShortDID.get(entry.shortDID);
      if (existingStore) {
        affectedStores.add(existingStore);
        // update history for the already registered shortDID
        const existingHistory = /** @type {RegistrationHistory} */(
          existingStore.get(entry.shortDID));
        addHistoryToExistingShortDID(existingHistory, historyChange, entry);
        if (!latestAction || entry.timestamp > latestAction)
          latestAction = entry.timestamp;

      } else {
        /** @type {RegistrationHistory} */
        const history = {
          created: entry.timestamp,
          updates: {
            [new Date(entry.timestamp).toISOString()]: historyChange
          }
        };

        addedShortDIDs.push(entry.shortDID);
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
  }
}

/**
 * @param {RegistrationHistory} history
 * @param {HistoryChange} historyChange
 * @param {import('../../../lib/plc-directory').PLCDirectoryEntryCompact} entry
 */
function addHistoryToExistingShortDID(history, historyChange, entry) {
  let firstHistoryEntry = true;
  let carryTimestamp = history.created;
  for (const dateOrTimestamp in history.updates) {
    let carryTimestampNext =
      firstHistoryEntry ? carryTimestamp :
        carryTimestamp = parseTimestampOffset(dateOrTimestamp) || 0;

    if (firstHistoryEntry) firstHistoryEntry = false;

    if (carryTimestamp > entry.timestamp) {
      console.warn(
        'Past history update? ',
        {
          entry,
          history,
          carryTimestamp: new Date(carryTimestamp),
          carryTimestampNext: new Date(carryTimestampNext)
        }
      );

      /** @type {RegistrationHistory['updates']} */
      const newUpdates = {};
      for (const prevDateOrTimestamp in history.updates) {
        if (prevDateOrTimestamp === dateOrTimestamp)
          newUpdates[timestampOffsetToString(entry.timestamp)] = historyChange;
        newUpdates[prevDateOrTimestamp] = history.updates[prevDateOrTimestamp];
      }

      return;
    }

    carryTimestamp = carryTimestampNext;
  }

  history.updates[timestampOffsetToString(entry.timestamp)] = historyChange;
}

/**
 * @param {RegistrationStore} store
 * @param {RegistrationHistory} history
 * @param {import('../../../lib/plc-directory').PLCDirectoryEntryCompact} entry
 */
function addNewShortDIDToExistingStoreEnd(store, history, entry) {
  store.set(entry.shortDID, history);
  if (!store.earliestRegistration) store.earliestRegistration = entry.timestamp;
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
  for (const [existingShortDID, existingHistory] of entries) {
    if (entry.timestamp >= existingHistory.created)
      store.set(entry.shortDID, history);
    store.set(existingShortDID, existingHistory);
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
    if (latestStore.size < MAX_STORE_SIZE) return { store: latestStore };
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
    const storeText = await read(next);
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