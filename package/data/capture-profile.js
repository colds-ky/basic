// @ts-check

import { shortenDID } from '../shorten';
import { detectWordStartsNormalized } from './capture-records/compact-post-words';
import { createRepoData } from './repo-data';

/**
 * @param {import('@atproto/api').AppBskyActorDefs.ProfileViewDetailed} profileView
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 * @param {import('./define-store').Intercepts} [intercepts]
 */
export function captureProfile(profileView, store, now, intercepts) {
  const shortDID = shortenDID(profileView.did);
  let repoData = store.get(shortDID);
  if (!repoData)
    store.set(shortDID, repoData = createRepoData(shortDID));

  if (!repoData.profile) {
    repoData.profile = /** @type {import('.').CompactProfile} */ ({
      shortDID,
      handle: profileView.handle
    });
  }

  const asOf = profileView.indexedAt ? Date.parse(profileView.indexedAt) : now;

  if (!repoData.profile?.asOf || repoData.profile.asOf <= asOf) {
    if ('handle' in profileView) repoData.profile.handle = profileView.handle;
    if ('displayName' in profileView) repoData.profile.displayName = profileView.displayName;
    if ('description' in profileView) repoData.profile.description = profileView.description;
    if ('avatar' in profileView) repoData.profile.avatar = profileView.avatar;
    if ('banner' in profileView) repoData.profile.banner = profileView.banner;
    if ('followersCount' in profileView) repoData.profile.followersCount = profileView.followersCount;
    if ('followsCount' in profileView) repoData.profile.followsCount = profileView.followsCount;
    if ('postsCount' in profileView) repoData.profile.postsCount = profileView.postsCount;

    let words = detectWordStartsNormalized(repoData.profile.handle, undefined);
    words = detectWordStartsNormalized(repoData.profile.displayName, words);
    words = detectWordStartsNormalized(repoData.profile.description, words);
    if (words) repoData.profile.words = words;

    repoData.profile.asOf = asOf;
  } else {
    // banner sometimes gets dropped from short profile views
    if (profileView.banner && !repoData.profile.banner)
      repoData.profile.banner = profileView.banner;
  }

  intercepts?.profile?.(repoData.profile);

  return repoData.profile;
}