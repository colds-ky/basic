// @ts-check

import { breakFeedUri, shortenDID } from '../shorten';

/**
 * @param {string} repo
 * @param {import('..').RepoRecord$Typed['app.bsky.feed.like']} likeRecord
 * @param {Map<string, import('./store-data').RepositoryData>} store
 */
export function captureLikeRecord(repo, likeRecord, store) {
  const shortDID = shortenDID(repo);

  const uri = breakFeedUri(likeRecord.subject?.uri);
  if (!uri?.shortDID || !uri.postID) return;

  const now = Date.now();

  let repoData = store.get(shortDID);
  if (!repoData) {
    repoData = {
      shortDID,
      profile: undefined,
      posts: new Map(),
      postLastAccesses: new Map(),
      lastAccesses: []
    };
    store.set(shortDID, repoData);
  }

  const existingPost = repoData.posts.get(uri.postID);
  if (existingPost) {
    // TODO: update likes on existing post
  } else {
    // TODO: create speculative post
  }
}