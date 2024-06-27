// @ts-check

import { breakFeedUri, shortenDID } from '../../shorten';
import { createRepoData } from '../repo-data';
import { createSpeculativePost } from './speculative-post';

/**
 * @param {string} repo
 * @param {import('../..').RepoRecord$Typed['app.bsky.feed.repost']} repostRecord
 * @param {Map<string, import('../store-data').RepositoryData>} store
 */
export function captureRepostRecord(repo, repostRecord, store) {
  const shortDID = shortenDID(repo);

  const uri = breakFeedUri(repostRecord.subject?.uri);
  if (!uri?.shortDID || !uri.postID) return;

  let repoData = store.get(shortDID);
  if (!repoData)
    store.set(shortDID, repoData = createRepoData(shortDID));

  const existingPost = repoData.posts.get(uri.postID);
  if (existingPost) {
    existingPost.repostCount = (existingPost.repostCount || 0) + 1;
    return existingPost;
  } else {
    const speculativePost = createSpeculativePost(uri.shortDID, uri.postID);
    speculativePost.repostCount = 1;
    repoData.posts.set(uri.postID, speculativePost);
    return speculativePost;
  }
}