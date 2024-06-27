// @ts-check

import { breakFeedUri, makeFeedUri } from "../shorten";
import { captureProfile } from "./capture-profile";
import { capturePostRecord } from "./capture-records/capture-post-record";
import { createSpeculativePost } from "./capture-records/speculative-post";
import { createRepoData } from "./repo-data";

/**
 * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} threadView
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 * @param {import('./define-store').Intercepts} [intercepts]
 */
export function captureThread(threadView, store, now, intercepts) {
  /** @type {Set<string>} */
  const visitedRevs = new Set();

  return captureThreadViewPostOrVariants(
    visitedRevs,
    threadView,
    undefined,
    store,
    now,
    intercepts,
  );
}

/**
 * @param {Set<string>} visitedRevs
 * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost |
 *  import('@atproto/api').AppBskyFeedDefs.NotFoundPost |
 *  import('@atproto/api').AppBskyFeedDefs.BlockedPost | Record<string, unknown>} threadViewPostOrVariants
 * @param {{ threadStart?: string, replyTo?: string } | undefined} parentPostHint
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 * @param {import('./define-store').Intercepts} [intercepts]
 */
function captureThreadViewPostOrVariants(
  visitedRevs,
  threadViewPostOrVariants,
  parentPostHint,
  store,
  now,
  intercepts,
) {
  const threadViewPost =
    /** @type {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} */ (
      threadViewPostOrVariants
    );

  if (threadViewPost?.post)
    return captureThreadViewPost(
      visitedRevs,
      threadViewPost,
      store,
      now,
      intercepts,
    );

  const lostURI =
    /** @type {import('@atproto/api').AppBskyFeedDefs.NotFoundPost} */ (
      threadViewPostOrVariants
    ).uri;

  const lostPost = getPostOrPlaceholder(lostURI, store);
  if (lostPost && parentPostHint) {
    const replyTo = parentPostHint.replyTo || parentPostHint.threadStart;
    const threadStart = parentPostHint.threadStart || parentPostHint.replyTo;
    if (lostPost.replyTo !== replyTo || lostPost.threadStart !== threadStart) {
      lostPost.replyTo = replyTo;
      lostPost.threadStart = threadStart;
      intercepts?.post?.(lostPost);
    }
  }

  return lostPost;
}

/**
 * @param {Set<string>} visitedRevs
 * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} threadViewPost
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 * @param {import('./define-store').Intercepts} [intercepts]
 */
function captureThreadViewPost(
  visitedRevs,
  threadViewPost,
  store,
  now,
  intercepts,
) {
  const compactPost = capturePostView(
    visitedRevs,
    threadViewPost.post,
    store,
    now,
    intercepts,
  );

  if (threadViewPost.parent)
    captureThreadViewPostOrVariants(
      visitedRevs,
      threadViewPost.parent,
      { threadStart: compactPost?.threadStart },
      store,
      now,
      intercepts,
    );

  if (threadViewPost.replies?.length) {
    for (const reply of threadViewPost.replies)
      captureThreadViewPostOrVariants(
        visitedRevs,
        reply,
        compactPost,
        store,
        now,
        intercepts,
      );
  }

  return compactPost;
}

/**
 * @param {Set<string>} visitedRevs
 * @param {import('@atproto/api').AppBskyFeedDefs.PostView | undefined} postView
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 * @param {import('./define-store').Intercepts} [intercepts]
 */
export function capturePostView(visitedRevs, postView, store, now, intercepts) {
  if (!postView || visitedRevs.has(postView.cid)) return; // TODO: if visitedRevs is expected, use REV not CID, and update it after

  captureProfile(postView.author, store, now, intercepts);

  const parsedPostURI = breakFeedUri(postView.uri);
  const compactPost = capturePostRecord(
    postView.author.did,
    postView.uri,
    /** @type {*} */ (postView.record),
    store,
    now,
    intercepts,
  );

  compactPost.likeCount = postView.likeCount;
  compactPost.repostCount = postView.repostCount;
  compactPost.labels = capturePostLabels(postView.labels);

  return compactPost;
}

/**
 * @param {import('@atproto/api').AppBskyFeedDefs.PostView['labels'] | undefined} labels
 */
function capturePostLabels(labels) {
  if (!labels?.length) return;
  /** @type {Record<string, string>} */
  let labelsObj = {};
  for (const lab of labels) {
    if (lab.neg) continue;
    labelsObj[lab.val] = lab.cts;
  }
  return labelsObj;
}

/**
 * @param {string | null | undefined} postURI
 * @param {Map<string, import('./store-data').RepositoryData>} store
 */
function getPostOrPlaceholder(postURI, store) {
  if (!postURI) return;
  const shortDID = breakFeedUri(postURI)?.shortDID;
  if (!shortDID) return;

  let repoData = store.get(shortDID);
  if (!repoData) store.set(shortDID, (repoData = createRepoData(shortDID)));

  const existingPost = repoData.posts.get(postURI);
  if (existingPost) return existingPost;

  const speculativePost = createSpeculativePost(shortDID, postURI);
  repoData.posts.set(postURI, speculativePost);
  return speculativePost;
}
