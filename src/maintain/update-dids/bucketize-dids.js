// @ts-check

import { shortenDID } from '../../api';
import { getKeyShortDID } from '../../api/core';

/** @param {string[]} dids */
export function bucketizeDIDs(dids) {
  /** @type {{ [twoLetter: string]: { twoLetter: string, shortDIDs: string[] } }} */
  const bucketMap = {};
  /** @type {typeof bucketMap[0][]} */
  const bucketList = [];
  for (const did of dids) {
    const shortDID = shortenDID(did);
    const twoLetter = getKeyShortDID(did);
    let bucket = bucketMap[twoLetter];
    if (bucket) bucket.shortDIDs.push(shortDID);
    else bucketList.push(bucketMap[twoLetter] = { twoLetter, shortDIDs: [shortDID] });
  }

  return bucketList;
}