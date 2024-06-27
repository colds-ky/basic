// @ts-check

import { stringifyRegistrationStore } from './persistence';

export async function pullPLCDirectoryCompact() {
  const fs = require('fs');
  const path = require('path');

  const { indexingRun } = require('./indexing-run');

  console.log('\n\n\nPLC directory CACHE');

  const directoryPath = path.resolve(__dirname, 'src/api/indexing/repos');
  const rootPath = path.resolve(directoryPath, 'colds-ky-dids-history.github.io');

  const run = indexingRun({
    read: (localPath) => new Promise((resolve, reject) => {
      const normalizeLocalPath = localPath.replace(/^\//, '');
      const filePath = path.resolve(
        /^20/.test(normalizeLocalPath) ? directoryPath : rootPath,
        normalizeLocalPath);

      fs.readFile(filePath, 'utf8', (err, data) => {
        console.log('  READ>>', filePath, err ? 'ERROR' : 'OK');

        if (err) resolve(undefined);
        else resolve(data);
      });
    })
  });

  let firstLoaded = true;
  for await (const progress of run) {
    const reportProgress = { registrations: 0 };

    if (progress.affectedStores) reportProgress.affectedStores = progress.affectedStores.map(store => store.file);
    if (progress.earliestRegistration) reportProgress.earliestRegistration = new Date(progress.earliestRegistration);
    if (progress.latestRegistration) reportProgress.latestRegistration = new Date(progress.latestRegistration);
    if (progress.latestAction) reportProgress.latestAction = new Date(progress.latestAction);
    if (progress.addedShortDIDs) reportProgress.addedShortDIDs = progress.addedShortDIDs.length;
    if (progress.affectedShortDIDs) reportProgress.affectedShortDIDs = progress.affectedShortDIDs.length;

    if (progress.stores) {
      for (const sto of progress.stores)
        reportProgress.registrations += sto.size;
    }

    if (firstLoaded && progress.loadedAllStores) {
      firstLoaded = false;
      console.log('\n\n');
    }
    console.log(reportProgress);

    // no write back if not all stores are loaded yet
    if (!progress.loadedAllStores) continue;

    console.log('  WRITE>>');

    if (progress.affectedStores) {
      const storesInWritingOrder = progress.affectedStores.slice().sort((a, b) =>
        a.latestRegistration - b.latestRegistration);

      for (const sto of storesInWritingOrder) {
        const filePath = path.resolve(directoryPath, sto.file + '.json');
        process.stdout.write('    ' + filePath);
        const json = stringifyRegistrationStore(sto);
        await new Promise((resolve, reject) => {
          fs.writeFile(filePath, json, error => {
            if (error) reject(error);
            else resolve(undefined);
          });
        });
        console.log();
      }

      const inceptionPath = path.resolve(rootPath, 'inception.json');
      const inceptionStr = JSON.stringify({
        next: progress.stores[0].file,
        stores: progress.stores.map(store => store.file)
      }, null, 2);
      const currentInception = fs.existsSync(inceptionPath) ?
        fs.readFileSync(inceptionPath, 'utf8') : '';
      if (currentInception !== inceptionStr) {
        process.stdout.write('  ' + path.resolve(rootPath, 'inception.json'));
        fs.writeFileSync(inceptionPath, inceptionStr);
        console.log(' ++++ CHANGED.');
      }
    }

    console.log(' OK');
  }
}

