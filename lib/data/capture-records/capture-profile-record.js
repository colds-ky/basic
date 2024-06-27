// @ts-check

import { breakFeedUri, shortenDID } from '../../shorten';
import { createRepoData } from '../repo-data';
import { createSpeculativePost } from './speculative-post';

/**
 * @param {string} repo
 * @param {import('../..').RepoRecord$Typed['app.bsky.actor.profile']} profileRecord
 * @param {Map<string, import('../store-data').RepositoryData>} store
 * @param {number} asOf
 */
export function captureProfileRecord(repo, profileRecord, store, asOf) {
  const shortDID = shortenDID(repo);

  let repoData = store.get(shortDID);
  if (!repoData)
    store.set(shortDID, repoData = createRepoData(shortDID));

  // TODO update with profileRecord
  repoData.profile
}
