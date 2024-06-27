// @ts-check

import { breakFeedUri, shortenDID } from '../../shorten';
import { createRepoData } from '../repo-data';
import { createSpeculativePost } from './speculative-post';

/**
 * @param {string} repo
 * @param {import('../..').RepoRecord$Typed['app.bsky.feed.like']} likeRecord
 * @param {Map<string, import('../store-data').RepositoryData>} store
 */
export function captureLikeRecord(repo, likeRecord, store) {
  const shortDID = shortenDID(repo);

  const uri = breakFeedUri(likeRecord.subject?.uri);
  if (!uri?.shortDID || !uri.postID) return;

  let repoData = store.get(shortDID);
  if (!repoData)
    store.set(shortDID, repoData = createRepoData(shortDID));

  const existingPost = repoData.posts.get(uri.postID);
  if (existingPost) {
    existingPost.likeCount = (existingPost.likeCount || 0) + 1;
    return existingPost;
  } else {
    const speculativePost = createSpeculativePost(uri.shortDID, uri.postID);
    speculativePost.likeCount = 1;
    repoData.posts.set(uri.postID, speculativePost);
    return speculativePost;
  }
}
