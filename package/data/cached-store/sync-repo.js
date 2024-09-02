// @ts-check

import { ColdskyAgent } from '../../coldsky-agent';
import { readCAR } from '../../read-car';
import { unwrapShortDID } from '../../shorten';
import { getProfileIncrementally } from './get-profile-incrementally';

/**
 * @typedef {{
 *  shortDID: string | null | undefined,
 *  agent_getProfile_throttled: (did) => ReturnType<import('@atproto/api').BskyAgent['getProfile']>,
 *  agent_resolveHandle_throttled: (handle) => ReturnType<import('@atproto/api').BskyAgent['resolveHandle']>,
 *  dbStore: ReturnType<typeof import('../define-cache-indexedDB-store').defineCacheIndexedDBStore>
 * }} Args
 */

/**
 * @param {Args} args
 */
export async function syncRepo(args) {
  const { shortDID, dbStore } = args;
  if (!shortDID) return;

  if (!shortDID) return;
  const lastRepoSyncRev = await dbStore.getLastRepoSyncRev(shortDID);
  let profile = await dbStore.getProfile(shortDID);
  if (!profile) {
    const profileIterator = getProfileIncrementally({
      ...args,
      didOrHandle: shortDID,
    })

    for await (const profileData of profileIterator) {
      if (!profileData) continue;
      const pds = profileData.history?.map(h => h.pds)?.find(Boolean);
      if (pds) {
        profile = profileData;
        break;
      }
    }
  }

  if (!profile) {
    console.error('Could not resolve profile ', shortDID);
    return;
  }

  const pds = /** @type {string} */(profile.history?.map(h => h.pds)?.find(Boolean));

  const startDownloadCAR = Date.now();

  const repoData = await downloadCAR({ shortDID, pds: pds, lastRev: lastRepoSyncRev });
  if (!repoData) return;

  console.log('@' + profile.handle + ' CAR ' + Math.round(repoData.byteLength / 1024).toLocaleString() + 'Kb downloaded in ', (Date.now() - startDownloadCAR) / 1000, 's');

  const startParse = Date.now();
  const parsed = await readCAR(unwrapShortDID(shortDID), repoData);
  console.log('@' + profile.handle + ' parsed repo in ', (Date.now() - startParse) / 1000, 's');

  const startUploadingToDB = Date.now();
  const uptick = await dbStore.syncRepoWithData(parsed, Date.now());
  console.log('@' + profile.handle + ' uploaded to DB in ', (Date.now() - startUploadingToDB) / 1000, 's');

  return uptick;
}

/**
 * @param {{
 *  shortDID: string,
 *  pds: string,
 *  lastRev?: string
 * }} _
 */
export async function downloadCAR({ shortDID, pds, lastRev }) {

  const fullDID = unwrapShortDID(shortDID);
  const pdsAgent = new ColdskyAgent({
    service: pds
  });

  const repoData = await pdsAgent.com.atproto.sync.getRepo({
    did: fullDID,
    since: lastRev
  });
  return repoData.data;
}
