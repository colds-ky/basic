// @ts-check

import { breakFeedUri, shortenDID, unwrapShortDID } from '../../shorten';
import { createRepoData } from '../repo-data';
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

  repoData.profile.asOf = asOf;

  intercepts?.profile?.(repoData.profile);
}

/**
 * @param {string} did
 * @param {string} cid
 */
export function getProfileBlobUrl(did, cid) {
  if (!did || !cid) return undefined;
  return `https://cdn.bsky.app/img/avatar/plain/${unwrapShortDID(did)}/${cid}@jpeg`;
}
