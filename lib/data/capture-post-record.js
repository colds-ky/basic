// @ts-check

import { breakFeedUri, shortenDID } from '../shorten';
import { makeCompactPost } from './compact-post';

const REPO_LAST_ACCESSES_COUNT_MAX = 1000;
const REPO_LAST_ACCESS_AGE_MAX = 1000 * 60 * 60 * 24 * 7 * 2; // 2 weeks

/**
 * @param {string} repo
 * @param {string} cid
 * @param {import('..').RepoRecord$Typed['app.bsky.feed.post']} postRecord
 * @param {Map<string, import('./store-data').RepositoryData>} store
 */
export function capturePostRecord(repo, cid, postRecord, store) {
  const shortDID = shortenDID(repo);

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

  const existingPost = repoData.posts.get(cid);
  if (existingPost) {
    // TODO: Update post
  } else {
    const createPost = makeCompactPost(repo, cid, postRecord);
    repoData.posts.set(cid, createPost);
    repoData.postLastAccesses.set(cid, [now]);
    repoData.lastAccesses.push(now);
    trimRepoDataLastAccesses(repoData.lastAccesses);
  }
}

/**
 * @param {number[]} lastAccesses
 */
function trimRepoDataLastAccesses(lastAccesses) {
}