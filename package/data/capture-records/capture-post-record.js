// @ts-check

import { shortenDID } from '../../shorten';
import { makeCompactPost } from '../compact-post';

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
  if (!shortDID || !uri || !postRecord) return;

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
  if (existingPost &&
    !existingPost.placeholder &&
    typeof existingPost.asOf === 'number' && existingPost.asOf > asOf)
    return existingPost;

  const createdPost = makeCompactPost(repo, uri, postRecord, asOf);

  if (existingPost) {
    createdPost.likedBy = existingPost.likedBy?.slice();
    createdPost.repostedBy = existingPost.repostedBy?.slice();
  }

  repoData.posts.set(uri, createdPost);
  intercepts?.post?.(createdPost);

  return createdPost;
}
