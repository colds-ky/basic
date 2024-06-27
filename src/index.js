// @ts-check

import { pullPLCDirectoryCompact } from './api/indexing/pull-plc-directory';


import { plcDirectory, plcDirectoryCompact } from '../lib/plc-directory';

export async function pullPLCDirectoryLocal() {
  console.log('Pulling PLC directory...');

  // TODO: load existing directory from disk

  for await (const chunk of plcDirectoryCompact()) {
    console.log(chunk.entries.length, chunk.entries[0], '...', chunk.entries[chunk.entries.length - 1]);
    break;
  }
}

if (typeof require === 'function' && typeof process !== 'undefined' && typeof process.exit === 'function') {
  pullPLCDirectoryCompact();
} else {
  pullPLCDirectoryLocal();
}
