// @ts-check

import { throttledAsyncCache } from '../../lib/throttled-async-cache';
import { streamBuffer } from '../../lib/akpa';

/**
 * @typedef {import('@atproto/api/dist/client/types/app/bsky/feed/defs').ThreadViewPost} ThreadViewPost
 */


/**
 * @param {import('..').DBAccess} db
 * @returns {AsyncIterable<import('../../lib').CompactThreadPostSet[]>}
 */
export function firehoseThreads(db) {
  return streamBuffer(
    /**
     * @param {import('../../lib/akpa').StreamParameters<import('../../lib').CompactThreadPostSet, import('../../lib').CompactThreadPostSet[]>} streaming 
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
       * @param {import('../../lib').CompactThreadPostSet} thread 
       */
      function yieldThread(thread) {
        streaming.yield(thread, buf => {
          if (!buf) return [thread];
          buf.push(thread);
          return buf;
        });
      }

      /**
       * @param {import('../../lib/firehose').FirehoseRecord$Typed<'app.bsky.feed.like'>} msg 
       */
      async function handleLike(msg) {
        const thread = await getPostThreadCached(msg.subject.uri);
        if (!thread || thread.blocked || thread.notFound) return;
        yieldThread(thread);
      }

      /**
       * @param {import('../../lib/firehose').FirehoseRecord$Typed<'app.bsky.feed.post'>} msg 
       */
      async function handlePost(msg) {
        const thread = await getPostThreadCached('at://' + msg.repo + '/' + msg.path);
        if (!thread || thread.blocked || thread.notFound) return;
        yieldThread(thread);
      }

      /**
       * @param {import('../../lib/firehose').FirehoseRecord$Typed<'app.bsky.feed.repost'>} msg 
       */
      async function handleRepost(msg) {
        const thread = await getPostThreadCached(msg.subject.uri);
        if (!thread || thread.blocked || thread.notFound) return;
        yieldThread(thread);
      }

    });

}
