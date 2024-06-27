// @ts-check

import { updateDIDs } from '../updateDIDs';
import { createShellAPIs } from './shell-api';

export { createShellAPIs } from './shell-api';

export async function nodeRunUpdateDIDs() {
  console.log('Updating DIDs:');
  const shellAPIs = createShellAPIs();
  const updating = await updateDIDs(shellAPIs);
  console.log('Start at: ' + updating.listRepos.cursor);

  while (!updating.populatedDIDs.reachedEnd) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    if (updating.populatedDIDs.reachedEnd)
      break;
    const bucketEntries = Object.entries(updating.populatedDIDs.buckets)
      .map(([twoLetter, bucket]) => /** @type {const} */([twoLetter, bucket.length]))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const buckets = {};
    for (const [twoLetter, count] of bucketEntries) {
      buckets[twoLetter] = count;
    }
    buckets.count = Object.keys(updating.populatedDIDs.buckets).length;

    console.log(
      'Updated: ',
      {
        ...updating,
        populatedDIDs: {
          ...updating.populatedDIDs,
          shortDIDs: updating.populatedDIDs.shortDIDs.length,
          buckets
        }
      });
  }
}