// @ts-check

import { shortenDID } from '../shorten';
import { createRepoData } from './repo-data';

/**
 * @param {import('@atproto/api').AppBskyActorDefs.ProfileViewDetailed} profileView
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 */
export function captureProfile(profileView, store, now) {
  const shortDID = shortenDID(profileView.did);
  let repoData = store.get(shortDID);
  if (!repoData)
    store.set(shortDID, repoData = createRepoData(shortDID));

  if (repoData.profile) {
    repoData.profile.avatar
    // TODO: update existing profile
  } else {
    // TODO: create new profile
  }
}