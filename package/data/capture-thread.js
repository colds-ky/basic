// @ts-check

import { breakFeedURIPostOnly } from "../shorten";
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
  return captureThreadViewPostOrVariants(
    threadView,
    undefined,
    store,
    now,
    intercepts,
  );
}

/**
 * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost |
 *  import('@atproto/api').AppBskyFeedDefs.NotFoundPost |
 *  import('@atproto/api').AppBskyFeedDefs.BlockedPost | Record<string, unknown>} threadViewPostOrVariants
 * @param {{ threadStart?: string, replyTo?: string } | undefined} parentPostHint
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 * @param {import('./define-store').Intercepts} [intercepts]
 */
function captureThreadViewPostOrVariants(
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
 * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} threadViewPost
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 * @param {import('./define-store').Intercepts} [intercepts]
 */
function captureThreadViewPost(
  threadViewPost,
  store,
  now,
  intercepts,
) {
  const compactPost = capturePostView(
    threadViewPost.post,
    store,
    now,
    intercepts,
  );

  if (threadViewPost.parent)
    captureThreadViewPostOrVariants(
      threadViewPost.parent,
      { threadStart: compactPost?.threadStart },
      store,
      now,
      intercepts,
    );

  if (threadViewPost.replies?.length) {
    for (const reply of threadViewPost.replies)
      captureThreadViewPostOrVariants(
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
 * @param {import('@atproto/api').AppBskyFeedDefs.PostView | undefined} postView
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {number} now
 * @param {import('./define-store').Intercepts} [intercepts]
 */
export function capturePostView(postView, store, now, intercepts) {
  if (!postView) return;

  captureProfile(postView.author, store, now, intercepts);

  const compactPost = capturePostRecord(
    postView.author.did,
    postView.uri,
    /** @type {*} */ (postView.record),
    store,
    now,
    intercepts,
  );
  if (!compactPost) return;

  compactPost.likedBy = adjustCountWithPlaceholders(postView.likeCount, compactPost.likedBy);
  compactPost.repostedBy = adjustCountWithPlaceholders(postView.repostCount, compactPost.repostedBy);

  compactPost.labels = capturePostLabels(postView.labels);

  return compactPost;
}

/**
 * @param {number | undefined} count
 * @param {string[] | undefined} array
 */
function adjustCountWithPlaceholders(count, array) {
  if (typeof count !== 'number') return;

  if (!array || array.length < count) {
    if (!array) array = [];
    for (let i = array.length; i < count; i++) {
      array.push('?');
    }
  } else if (array.length > count) {
    let setLength = count;
    // do not remove non-placeholder likes
    while (array[setLength - 1] !== '?') setLength++;
    if (setLength < array.length)
      array.length = setLength;
  }

  return array;
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
  const shortDID = breakFeedURIPostOnly(postURI)?.shortDID;
  if (!shortDID) return;

  let repoData = store.get(shortDID);
  if (!repoData) store.set(shortDID, (repoData = createRepoData(shortDID)));

  const existingPost = repoData.posts.get(postURI);
  if (existingPost) return existingPost;

  const speculativePost = createSpeculativePost(shortDID, postURI);
  repoData.posts.set(postURI, speculativePost);
  return speculativePost;
}
