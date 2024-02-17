// @ts-check

import { pullPLCDirectoryCompact } from './api/indexing/pull-plc-directory';
import { indexingRun } from './api/indexing';

async function pullPLCDirectoryLocal() {
  console.log('Pulling PLC directory...');

  // TODO: load existing directory from disk

  const run = indexingRun({
    read: async (localPath) => {
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
    }
  });

  for await (const progress of run) {
    console.log(progress);
  }
}

if (typeof require === 'function' && typeof process !== 'undefined' && typeof process.exit === 'function') {
  if (require.main === module) pullPLCDirectoryCompact();
  else module.exports = { indexingRun }
} else {
  pullPLCDirectoryLocal();
}
