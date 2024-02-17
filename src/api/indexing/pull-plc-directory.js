// @ts-check

const alertIfRecent = new Date(2023, 11, 1);

export async function pullPLCDirectoryCompact() {
  const fs = require('fs');
  const path = require('path');

  const { indexingRun } = require('./indexing-run');

  console.log('PLC directory CACHE');

  const directoryPath = path.resolve(__dirname, 'src/api/indexing/repos/directory');
  const run = indexingRun({
    read: (localPath) => new Promise((resolve, reject) => {
      const filePath = path.resolve(directoryPath, localPath.replace(/^\//, ''));
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    })
  });

  for await (const progress of run) {
  }
}

