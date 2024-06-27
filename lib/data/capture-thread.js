// @ts-check

import { breakFeedUri, makeFeedUri } from '../shorten';
import { captureProfile } from './capture-profile';
import { capturePostRecord } from './capture-records/capture-post-record';
import { createSpeculativePost } from './capture-records/speculative-post';
import { createRepoData } from './repo-data';


/**
 * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} threadView
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 */
export function captureThread(threadView, store, now) {
  /** @type {Set<string>} */
  const visitedCIDs = new Set();

  return captureThreadViewPostOrVariants(visitedCIDs, threadView, undefined, store, now);
}

/**
 * @param {Set<string>} visitedCIDs
 * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost | 
 *  import('@atproto/api').AppBskyFeedDefs.NotFoundPost |
 *  import('@atproto/api').AppBskyFeedDefs.BlockedPost | Record<string, unknown>} threadViewPostOrVariants
 * @param {{ threadStart?: string, replyTo?: string } | undefined} parentPostHint
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 */
function captureThreadViewPostOrVariants(visitedCIDs, threadViewPostOrVariants, parentPostHint, store, now) {
  const threadViewPost = /** @type {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} */(
    threadViewPostOrVariants);
  
  if (threadViewPost?.post) return captureThreadViewPost(visitedCIDs, threadViewPost, store, now);

  const lostURI = /** @type {import('@atproto/api').AppBskyFeedDefs.NotFoundPost} */(
    threadViewPostOrVariants).uri;

  const lostPost = getPostOrPlaceholder(lostURI, store);
  if (lostPost && parentPostHint) {
    lostPost.replyTo = parentPostHint.replyTo || parentPostHint.threadStart;
    lostPost.threadStart = parentPostHint.threadStart || parentPostHint.replyTo;
  }

  return lostPost;
}

/**
 * @param {Set<string>} visitedCIDs
 * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} threadViewPost
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 */
function captureThreadViewPost(visitedCIDs, threadViewPost, store, now) {
  const compactPost = capturePostView(visitedCIDs, threadViewPost.post, store, now);

  if (threadViewPost.parent)
    captureThreadViewPostOrVariants(
      visitedCIDs,
      threadViewPost.parent,
      { threadStart: compactPost?.threadStart },
      store,
      now);

  if (threadViewPost.replies?.length) {
    for (const reply of threadViewPost.replies)
      captureThreadViewPostOrVariants(
        visitedCIDs,
        reply,
        compactPost,
        store,
        now);
  }

  return compactPost;
}

/**
 * @param {Set<string>} visitedCIDs
 * @param {import('@atproto/api').AppBskyFeedDefs.PostView | undefined} postView
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 */
function capturePostView(visitedCIDs, postView, store, now) {
  if (!postView || visitedCIDs.has(postView.cid)) return;

  captureProfile(postView.author, store, now);

  const compactPost = capturePostRecord(
    postView.author.did,
    postView.cid,
    /** @type {*} */(postView.record),
    store,
    now);

  compactPost.likeCount = postView.likeCount;
  compactPost.repostCount = postView.repostCount;

  return compactPost;
}

/**
 * @param {string | null | undefined} postURI
 * @param {Map<string, import('./store-data').RepositoryData>} store
 */
function getPostOrPlaceholder(postURI, store) {
  if (!postURI) return;
  const uri = breakFeedUri(postURI);
  if (!uri?.shortDID || !uri.postID) return;

  let repoData = store.get(uri.shortDID);
  if (!repoData)
    store.set(uri.shortDID, repoData = createRepoData(uri.shortDID));

  const existingPost = repoData.posts.get(uri.postID);
  if (existingPost) return existingPost;
  
  const speculativePost = createSpeculativePost(uri.shortDID, uri.postID);
  repoData.posts.set(uri.postID, speculativePost);
  return speculativePost;
}