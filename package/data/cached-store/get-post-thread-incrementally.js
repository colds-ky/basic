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

  if ('post' in remoteThreadRaw) {
    const onePart = dbStore.captureThreadView(
        /** @type {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} */(remoteThreadRaw),
      Date.now());

    const ignoreBrokenPlaceholderUris = new Set();

    let rootRetrieved = false;

    while (true) {
      const refreshedThread = await dbStore.getPostThread(uri);
      /** @type {string[]} */
      const allPlaceholders = [];
      if (refreshedThread?.all?.length) {
        for (const post of refreshedThread.all) {
          if (post.placeholder && !ignoreBrokenPlaceholderUris.has(post.uri))
            allPlaceholders.push(post.uri);
        }
      }

      yield refreshedThread;
      if (!allPlaceholders.length) break;
      if (!rootRetrieved) {
        if (refreshedThread) allPlaceholders.push(refreshedThread.root.uri);
        else if (onePart) allPlaceholders.push(onePart.threadStart || onePart.uri);
      }

      const orphanRemotePromises = allPlaceholders.map(placeholderPostURI =>
          /** @type {const} */(
        [placeholderPostURI, agent_getPostThread_throttled(placeholderPostURI)]
      ));

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
  }
}
