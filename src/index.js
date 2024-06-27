// @ts-check

import { pullPLCDirectoryCompact } from './api/indexing/pull-plc-directory';
import { indexingRun } from './api/indexing';
import { retryFetch } from './api/retry-fetch';

async function pullPLCDirectoryLocal() {
  console.log('Pulling PLC directory...');

  // TODO: load existing directory from disk

  const run = indexingRun({
    read: async (localPath) => {
      return;
      try {
        const re = await fetch(
          location.protocol + '//' +
          'history.dids.colds.ky' + '/' + localPath.replace(/^\//, ''));
        if (re.status !== 200) return;
        const text = await re.text();
        return text;
      } catch (fetchError) {
        console.warn(localPath, fetchError);
      }
    },
    fetch: retryFetch,
  });

  let count = 0;
  for await (const progress of run) {
    console.log({
      progress,
      ...progress,
      earliestRegistration: progress.earliestRegistration && new Date(progress.earliestRegistration),
      latestRegistration: progress.latestRegistration && new Date(progress.latestRegistration),
      latestAction: progress.latestAction && new Date(progress.latestAction),
      affectedStores: progress.affectedStores?.map(store => store.file),
      stores: progress.stores?.map(store => store.file),
    });
    console.log('\n\n\n');
    count++;
    // if (count >= 5)
    //   break;
  }
}

if (typeof require === 'function' && typeof process !== 'undefined' && typeof process.exit === 'function') {
  console.log('node');
  // if (require.main === module) {
  //   console.log('main: run the pullPLCDirectoryCompact');
  pullPLCDirectoryCompact();
  // } else {
  //   console.log('require.main: ', { ['require.main']: require.main, ['module']: module })
  //   module.exports = { indexingRun }
  // }
} else {
  console.log('browser, see window.pullPLCDirectoryLocal / handleFirehoseToStore ');
  window['pullPLCDirectoryLocal'] = pullPLCDirectoryLocal;

  window['handleFirehoseToStore'] = handleFirehoseToStore;
  // pullPLCDirectoryLocal();
}

async function handleFirehoseToStore() {

  var INTERVAL_FIREHOSE = 2000;
  console.log('libs...');

  /** @type {import('../lib/index')} */
  const coldsky = await waitForLib();

  const store = coldsky.defineCacheIndexedDBStore();
  window['store'] = store;

  console.log('firehose connect...');

  let lastProcess = Date.now();
  let addedTotal = 0;
  /** @type {import('../lib/firehose').FirehoseRecord[] | undefined} */
  let unexpected;

  for await (const blocks of coldsky.firehose()) {
    for (const block of blocks) {
      if (block.messages.length) {
        for (const p of block.messages) {
          store.captureRecord(p, block.receiveTimestamp);
          addedTotal++;
        }
      }
      if (block.unexpected?.length) {
        if (!unexpected) unexpected = block.unexpected;
        else unexpected = unexpected.concat(block.unexpected);
      }
    }

    console.log('processed ', addedTotal, ' into store');
    if (unexpected)
      console.log('unexpected ', unexpected);

    addedTotal = 0;

    const waitMore = INTERVAL_FIREHOSE - (Date.now() - lastProcess);
    if (waitMore > 0) await new Promise((resolve, reject) => setTimeout(resolve, waitMore));

    lastProcess = Date.now();
  }

  function waitForLib() {
    if (window['coldsky']) return window['coldsky'];

    return new Promise((resolve, reject) => {
      let stopInterval = setInterval(() => {
        if (window['coldsky']) {
          clearInterval(stopInterval);
          resolve(window['coldsky']);
        }
      }, 300);
    });
  }
}
