// @ts-check

import { firehose, ColdskyAgent, defineCacheIndexedDBStore } from '../../coldsky/lib';
import { throttledAsyncCache } from '../../coldsky/lib/throttled-async-cache';
import { streamBuffer } from '../../coldsky/src/api/akpa';
import { BSKY_PUBLIC_URL } from '../../coldsky/lib/coldsky-agent';

/**
 * @typedef {import('@atproto/api/dist/client/types/app/bsky/feed/defs').ThreadViewPost} ThreadViewPost
 */


/**
 * @param {import('..').DBAccess} db
 * @returns {AsyncIterable<import('../../coldsky/lib').CompactThreadPostSet[]>}
 */
export function firehoseThreads(db) {
  return streamBuffer(
    /**
     * @param {import('../../coldsky/src/api/akpa').StreamParameters<import('../../coldsky/lib').CompactThreadPostSet, import('../../coldsky/lib').CompactThreadPostSet[]>} streaming 
     */
    async streaming => {

      const getPostThreadCached = throttledAsyncCache(
        async (uri) => {
          if (streaming.isEnded) return;
          let lastUpdatedThread;
          for await (const thread of db.getPostThreadIncrementally(uri)) {
            if (streaming.isEnded) return;

            if (thread) lastUpdatedThread = thread;
          }
          return lastUpdatedThread;
        });

      keepMonitoringFirehose();

      await streaming.finally;
      console.log('firehoseThreads ended');

      async function keepMonitoringFirehose() {
        for await (const chunk of db.firehose()) {
          if (streaming.isEnded) break;
          for (const msg of chunk.messages) {
            switch (msg.$type) {
              case 'app.bsky.feed.like': handleLike(msg); continue;
              case 'app.bsky.feed.post': handlePost(msg); continue;
              case 'app.bsky.feed.repost': handleRepost(msg); continue;
            }
          }
        }
      }

      /**
       * @param {import('../../coldsky/lib').CompactThreadPostSet} thread 
       */
      function yieldThread(thread) {
        streaming.yield(thread, buf => {
          if (!buf) return [thread];
          buf.push(thread);
          return buf;
        });
      }

      /**
       * @param {import('../../coldsky/lib/firehose').FirehoseRecord$Typed<'app.bsky.feed.like'>} msg 
       */
      async function handleLike(msg) {
        const thread = await getPostThreadCached(msg.subject.uri);
        if (!thread || thread.blocked || thread.notFound) return;
        yieldThread(thread);
      }

      /**
       * @param {import('../../coldsky/lib/firehose').FirehoseRecord$Typed<'app.bsky.feed.post'>} msg 
       */
      async function handlePost(msg) {
        const thread = await getPostThreadCached('at://' + msg.repo + '/' + msg.path);
        if (!thread || thread.blocked || thread.notFound) return;
        yieldThread(thread);
      }

      /**
       * @param {import('../../coldsky/lib/firehose').FirehoseRecord$Typed<'app.bsky.feed.repost'>} msg 
       */
      async function handleRepost(msg) {
        const thread = await getPostThreadCached(msg.subject.uri);
        if (!thread || thread.blocked || thread.notFound) return;
        yieldThread(thread);
      }

    });

}
