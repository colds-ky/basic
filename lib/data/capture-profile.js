// @ts-check

import { shortenDID } from '../shorten';
import { detectWordStartsNormalized } from './capture-records/compact-post-words';
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
    repoData.profile.handle = profileView.handle;
  } else {
    repoData.profile = /** @type {import('.').CompactProfile} */ ({
      shortDID,
      handle: profileView.handle
    });
  }

  if ('displayName' in profileView) repoData.profile.displayName = profileView.displayName;
  if ('description' in profileView) repoData.profile.description = profileView.description;
  if ('avatar' in profileView) repoData.profile.avatar = profileView.avatar;
  if ('banner' in profileView) repoData.profile.banner = profileView.banner;
  if ('followersCount' in profileView) repoData.profile.followersCount = profileView.followersCount;
  if ('followsCount' in profileView) repoData.profile.followsCount = profileView.followsCount;
  if ('postsCount' in profileView) repoData.profile.postsCount = profileView.postsCount;

  let words = detectWordStartsNormalized(profileView.handle, undefined);
  words = detectWordStartsNormalized(profileView.displayName, words);
  words = detectWordStartsNormalized(profileView.description, words);
  if (words) repoData.profile.words = words;

  repoData.profile.asOf =
    profileView.indexedAt ? Date.parse(profileView.indexedAt) : now;
}