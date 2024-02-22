// @ts-check

import { stringifyRegistrationStore } from './persistence';

export async function pullPLCDirectoryCompact() {
  const fs = require('fs');
  const path = require('path');

  const { indexingRun } = require('./indexing-run');

  console.log('PLC directory CACHE');

  const directoryPath = path.resolve(__dirname, 'src/api/indexing/repos');
  const rootPath = path.resolve(directoryPath, 'colds-ky-dids-history.github.io');

  const run = indexingRun({
    read: (localPath) => new Promise((resolve, reject) => {
      const normalizeLocalPath = localPath.replace(/^\//, '');
      const filePath = path.resolve(
        /^20/.test(normalizeLocalPath) ? directoryPath : rootPath,
        normalizeLocalPath);

      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) resolve(undefined);
        else resolve(data);
      });
    })
  });

  for await (const progress of run) {
    const reportProgress = {};
    if (progress.affectedStores) reportProgress.affectedStores = progress.affectedStores.map(store => store.file);
    if (progress.earliestRegistration) reportProgress.earliestRegistration = new Date(progress.earliestRegistration);
    if (progress.latestRegistration) reportProgress.latestRegistration = new Date(progress.latestRegistration);
    if (progress.latestAction) reportProgress.latestAction = new Date(progress.latestAction);
    if (progress.addedShortDIDs) reportProgress.addedShortDIDs = progress.addedShortDIDs.length;
    if (progress.affectedShortDIDs) reportProgress.affectedShortDIDs = progress.affectedShortDIDs.length;

    console.log(reportProgress);
    console.log('  WRITE>>');

    if (progress.affectedStores) {
      for (const sto of progress.affectedStores) {
        const filePath = path.resolve(directoryPath, sto.file + '.json');
        process.stdout.write('  ' + filePath);
        const json = stringifyRegistrationStore(sto);
        fs.writeFileSync(filePath, json);
        console.log();
      }
    }

    console.log(' OK');
  }
}

