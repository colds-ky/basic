// @ts-check

import { shortenDID } from '../../shorten';
import { createRepoData } from '../repo-data';
import { createSpeculativePost } from './speculative-post';

/**
 * @param {string} repo
 * @param {import('../..').RepoRecord$Typed['app.bsky.feed.repost']} repostRecord
 * @param {Map<string, import('../store-data').RepositoryData>} store
 * @param {import('../define-store').Intercepts} [intercepts]
 */
export function captureRepostRecord(repo, repostRecord, store, intercepts) {
  const shortDID = shortenDID(repo);

  let repoData = store.get(shortDID);
  if (!repoData)
    store.set(shortDID, repoData = createRepoData(shortDID));

  const existingPost = repoData.posts.get(repostRecord.subject.uri);
  if (existingPost) {
    if (existingPost.repostedBy) {
      if (!existingPost.repostedBy.includes(shortDID)) {
        let lastPlaceholderRepost = existingPost.repostedBy.length;
        while (lastPlaceholderRepost > 0 && existingPost.repostedBy[lastPlaceholderRepost - 1] === '?')
          lastPlaceholderRepost--;
        existingPost.repostedBy[lastPlaceholderRepost] = shortDID;
      }
    } else {
      existingPost.repostedBy = [shortDID];
    }
    intercepts?.post?.(existingPost);
    return existingPost;
  } else {
    const speculativePost = createSpeculativePost(shortDID, repostRecord.subject.uri);
    speculativePost.repostedBy = [shortDID];
    repoData.posts.set(repostRecord.subject.uri, speculativePost);
    intercepts?.post?.(speculativePost);
    return speculativePost;
  }
}