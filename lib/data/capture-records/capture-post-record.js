// @ts-check

import { breakFeedUri, shortenDID } from '../../shorten';
import { makeCompactPost } from '../compact-post';

const REPO_LAST_ACCESSES_COUNT_MAX = 1000;
const REPO_LAST_ACCESS_AGE_MAX = 1000 * 60 * 60 * 24 * 7 * 2; // 2 weeks

/**
 * @param {string} repo
 * @param {string} uri
 * @param {import('../..').RepoRecord$Typed['app.bsky.feed.post']} postRecord
 * @param {Map<string, import('../store-data').RepositoryData>} store
 * @param {number} asOf
 * @param {import('../define-store').Intercepts} [intercepts]
 */
export function capturePostRecord(repo, uri, postRecord, store, asOf, intercepts) {
  const shortDID = shortenDID(repo);

  let repoData = store.get(shortDID);
  if (!repoData) {
    repoData = {
      shortDID,
      profile: undefined,
      posts: new Map(),
      // postLastAccesses: new Map(),
      // lastAccesses: []
    };
    store.set(shortDID, repoData);
  }

  const existingPost = repoData.posts.get(uri);
  if (existingPost && typeof existingPost.asOf === 'number' && existingPost.asOf > asOf)
    return existingPost;

  const createdPost = makeCompactPost(repo, uri, postRecord, asOf);

  if (existingPost) {
    createdPost.likeCount = existingPost.likeCount;
    createdPost.repostCount = existingPost.repostCount;
  }

  repoData.posts.set(uri, createdPost);
  intercepts?.post?.(createdPost);

  return createdPost;
}
