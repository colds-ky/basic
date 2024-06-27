// @ts-check

import { breakFeedUri, getProfileBlobUrl, shortenDID, unwrapShortDID } from '../../shorten';
import { createRepoData } from '../repo-data';
import { detectWordStartsNormalized } from './compact-post-words';
import { createSpeculativePost } from './speculative-post';

/**
 * @param {string} repo
 * @param {import('../..').RepoRecord$Typed['app.bsky.actor.profile']} profileRecord
 * @param {Map<string, import('../store-data').RepositoryData>} store
 * @param {number} asOf
 * @param {import('../define-store').Intercepts} [intercepts]
 */
export function captureProfileRecord(repo, profileRecord, store, asOf, intercepts) {
  const shortDID = shortenDID(repo);

  let repoData = store.get(shortDID);
  if (!repoData)
    store.set(shortDID, repoData = createRepoData(shortDID));

  if (!repoData.profile) {
    repoData.profile = /** @type {import('..').CompactProfile} */ ({
      shortDID,
      // handle: profileRecord.handle
    });
  }

  if ('displayName' in profileRecord) repoData.profile.displayName = profileRecord.displayName;
  if ('description' in profileRecord) repoData.profile.description = profileRecord.description;
  if ('avatar' in profileRecord) repoData.profile.avatar =
    getProfileBlobUrl(shortDID, profileRecord.avatar?.ref + '');
  if ('banner' in profileRecord) repoData.profile.banner =
    getProfileBlobUrl(shortDID, profileRecord.banner?.ref + '');
  
  let words = detectWordStartsNormalized(repoData.profile.handle, undefined);
  words = detectWordStartsNormalized(repoData.profile.displayName, words);
  words = detectWordStartsNormalized(repoData.profile.description, words);
  if (words) repoData.profile.words = words;

  repoData.profile.asOf = asOf;

  intercepts?.profile?.(repoData.profile);
}
