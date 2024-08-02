// @ts-check

import { breakFeedURIPostOnly } from '../../shorten';

/**
 * @typedef {{
 *  uri: string | null | undefined,
 *  agent_getPostThread_throttled: (uri) => ReturnType<import('@atproto/api').BskyAgent['getPostThread']>,
 *  dbStore: ReturnType<typeof import('../define-cache-indexedDB-store').defineCacheIndexedDBStore>
 * }} Args
 */

/**
 * @param {Args} _
 * @returns {AsyncGenerator<import('..').CompactThreadPostSet | undefined>}
 */
export async function* getPostThreadIncrementally({ uri, dbStore, agent_getPostThread_throttled }) {
  if (!uri) return;

  const parsedURL = breakFeedURIPostOnly(uri);
  if (!parsedURL) return;

  const remotePromise = agent_getPostThread_throttled(uri);

  const local = await dbStore.getPostThread(uri);
  if (local && !local.root.placeholder) yield local;

  const remoteThreadRaw = (await remotePromise)?.data?.thread;

  if (!('post' in remoteThreadRaw)) return;

  const remoteThreadRawPost = /** @type {import('../../../app-shared/firehose-threads').ThreadViewPost} */(
    remoteThreadRaw
  );

  const onePart = dbStore.captureThreadView(
        /** @type {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} */(remoteThreadRaw),
    Date.now());

  let allPlaceholders = [];

  const ignoreBrokenPlaceholderUris = new Set();

  let rootRetrieved = false;
  const orphanRepliesPromise = scourAndInjectOrphanReplies();

  while (true) {
    const refreshedThread = await dbStore.getPostThread(uri);
    if (refreshedThread?.all?.length) {
      for (const post of refreshedThread.all) {
        if (post.placeholder && !ignoreBrokenPlaceholderUris.has(post.uri))
          allPlaceholders.push(post.uri);
      }
    }

    yield refreshedThread;

    await orphanRepliesPromise;

    if (!allPlaceholders.length) break;
    if (!rootRetrieved) {
      if (refreshedThread) allPlaceholders.push(refreshedThread.root.uri);
      else if (onePart) allPlaceholders.push(onePart.threadStart || onePart.uri);
    }

    const orphanRemotePromises = allPlaceholders.map(placeholderPostURI =>
          /** @type {const} */(
      [placeholderPostURI, agent_getPostThread_throttled(placeholderPostURI)]
    ));
    allPlaceholders = [];

    for (const [placeholderPost, orphanRemotePromise] of orphanRemotePromises) {
      try {
        const orphanRemoteRaw = (await orphanRemotePromise)?.data?.thread;
        if ('post' in orphanRemoteRaw) {
          dbStore.captureThreadView(
              /** @type {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} */(orphanRemoteRaw),
            Date.now());
        }
      } catch (error) {
        console.warn('Orphan post may be missing ', error);
        ignoreBrokenPlaceholderUris.add(placeholderPost);
      }
    }
  }

 
  async function scourAndInjectOrphanReplies() {
    const orphanReplies = scourOrphanReplies(remoteThreadRawPost);
    const onlyUnknownPosts = (await Promise.all([...orphanReplies].map(async uri => {
      const dbPost = await dbStore.getPostOnly(uri);
      return dbPost ? '' : uri;
    }))).filter(Boolean);

    allPlaceholders = onlyUnknownPosts;
  }
}

/**
 * @param {import('../../../app-shared/firehose-threads').ThreadViewPost} remoteThreadRawPost
 * @param {Set<string>} [set]
 */
function scourOrphanReplies(remoteThreadRawPost, set) {
  if (!set) set = new Set();

  if (!remoteThreadRawPost.replies?.length && remoteThreadRawPost.post.replyCount) {
    console.log('orphan replies likely: ' + remoteThreadRawPost.post.replyCount + ' replies but no replies ', remoteThreadRawPost);
    set.add(remoteThreadRawPost.post.uri);
  }

  if (remoteThreadRawPost.replies?.length) {
    for (const reply of remoteThreadRawPost.replies) {
      if (!reply.post) {
        if (reply.uri && reply.blocked) {
          console.log('orphan replies likely: blocked reply but no post ', reply);
          set.add(/** @type {string} */(reply.uri));
        }
        continue;
      }

      scourOrphanReplies(
        /** @type {import('../../../app-shared/firehose-threads').ThreadViewPost} */(reply),
        set);
    }
  }

  return set;
}
