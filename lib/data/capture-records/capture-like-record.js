// @ts-check

import { breakFeedUri, shortenDID } from '../../shorten';
import { createRepoData } from '../repo-data';
import { createSpeculativePost } from './speculative-post';

/**
 * @param {string} repo
 * @param {import('../..').RepoRecord$Typed['app.bsky.feed.like']} likeRecord
 * @param {Map<string, import('../store-data').RepositoryData>} store
 * @param {import('../define-store').Intercepts} [intercepts]
 */
export function captureLikeRecord(repo, likeRecord, store, intercepts) {
  const shortDID = shortenDID(repo);

  let repoData = store.get(shortDID);
  if (!repoData)
    store.set(shortDID, repoData = createRepoData(shortDID));

  const existingPost = repoData.posts.get(likeRecord.subject.uri);
  if (existingPost) {
    existingPost.likeCount = (existingPost.likeCount || 0) + 1;
    intercepts?.post?.(existingPost);
    return existingPost;
  } else {
    const speculativePost = createSpeculativePost(shortDID, likeRecord.subject.uri);
    speculativePost.likeCount = 1;
    repoData.posts.set(likeRecord.subject.uri, speculativePost);
    intercepts?.post?.(speculativePost);
    return speculativePost;
  }
}
