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
  console.log('browser');
  pullPLCDirectoryLocal();
}
