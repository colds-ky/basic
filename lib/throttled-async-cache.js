// @ts-check

import { isPromise } from './is-promise';

/**
 * @template {Function} TFunction
 * @param {TFunction} call
 * @param {{ maxConcurrency?: number, interval?: number }} _
 * @returns {TFunction & { prepopulate: (value: any, ...args: any[]) => void, evict: (...args: any[]) => void }}
 */
export function throttledAsyncCache(call, { maxConcurrency = 3, interval = 100 } = {}) {
  const cache = multikeyMap();

  const outstandingRequests = new Set();
  const waitingRequests = new Set();

  var scheduleMoreLaterTimeout;

  throttledCall.prepopulate = prepopulate;
  throttledCall.evict = evict;

  return throttledCall;

  function prepopulate(value, ...args) {
    cache.set(...args, { value });
  }

  function evict(...args) {
    cache.delete(...args);
  }

  function throttledCall(...args) {
    let result = cache.get(...args);
    if (result) {
      if (isPromise(result.value)) result.priority++;
      return result.value;
    }

    let scheduleNow;
    const schedulePromise = new Promise(resolve => scheduleNow = resolve);

    const entry = {
      priority: 0,
      value: invokeCall(),
      scheduleNow
    };

    cache.set(...args, entry);
    waitingRequests.add(entry);

    scheduleAsAppropriate();

    return entry.value;

    async function invokeCall() {
      await schedulePromise;
      waitingRequests.delete(entry);
      outstandingRequests.add(entry);
      try {
        const result = await call(...args);
        entry.value = result;
        return result;
      } finally {
        outstandingRequests.delete(entry);
        scheduleAsAppropriate();
      }
    }
  }

  async function scheduleAsAppropriate() {
    if (outstandingRequests.size >= maxConcurrency) return;

    if (interval) {
      await new Promise(resolve => setTimeout(resolve, interval));
      if (outstandingRequests.size >= maxConcurrency) return;
    }

    const nextRequest = [...waitingRequests].sort((a, b) => b.priority - a.priority)[0];
    if (!nextRequest) return;
    nextRequest.scheduleNow();

    if (outstandingRequests.size < maxConcurrency) {
      clearTimeout(scheduleMoreLaterTimeout);
      scheduleMoreLaterTimeout = setTimeout(scheduleAsAppropriate, (interval || 100));
    }
  }
}

function multikeyMap() {
  /** @type {Map & { _value?: any }} */
  const storeMap = new Map();

  const resultMap = {
    get,
    set,
    delete: deleteKeys,
    has,
    clear
  };

  return resultMap;

  function get(...keys) {
    let entry = storeMap;
    for (const key of keys) {
      entry = entry.get(key);
      if (!entry) return;
    }
    return entry._value;
  }

  function set(...keys) {
    let entry = storeMap;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      entry = entry.get(key) || entry.set(key, new Map()).get(key);
    }
    entry._value = keys[keys.length - 1];
    return resultMap;
  }

  function deleteKeys(...keys) {
    let entry = storeMap;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      entry = entry.get(key);
      if (!entry) return false;
    }
    return entry.delete(keys[keys.length - 1]);
  }

  function has(...keys) {
    let entry = storeMap;
    for (const key of keys) {
      entry = entry.get(key);
      if (!entry) return false;
    }
    return true;
  }

  function clear() {
    return storeMap.clear();
  }
}