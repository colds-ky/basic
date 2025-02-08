// @ts-check

import { throttledAsyncCache } from '../package/throttled-async-cache';
import { streamBuffer } from '../package/akpa';

/**
 * @typedef {import('../package').CompactThreadPostSet & {
 *  hotInteractions?: number
 * }} HotThread
 */

/**
 * @param {import('../app').DBAccess} db
 */
export function* getFirehoseConversationThreads(db) {
  return streamBuffer(
    /**
     * @param {import('../package/akpa').StreamParameters<import('../package').CompactThreadPostSet, import('../package').CompactThreadPostSet[]>} streaming 
     */
    async streaming => {

      /**
       * @type {Map<string, HotThread>}
      */
      const hotThreads = new Map();

      const getPostThreadCached = throttledAsyncCache(
        async (uri) => {
          if (streaming.isEnded) return;
          let lastUpdatedThread;
          for await (const thread of db.getPostThreadIncrementally(uri)) {
            if (streaming.isEnded) return;

            if (thread) lastUpdatedThread = thread;
            if (!thread?.current?.placeholder) break;
          }
          return lastUpdatedThread;
        });

      keepMonitoringFirehose();

      await streaming.finally;
      console.log('firehoseThreads ended');

      async function keepMonitoringFirehose() {
        for await (const chunk of db.firehose()) {
          if (streaming.isEnded) break;
          for (const msg of chunk.records) {
            if (msg.action === 'delete') continue;

            switch (msg.$type) {
              case 'app.bsky.feed.like': handleLike(msg); continue;
              case 'app.bsky.feed.post': handlePost(msg); continue;
              case 'app.bsky.feed.repost': handleRepost(msg); continue;
            }
          }
        }
      }

      /**
       * @param {import('../package').CompactThreadPostSet} thread 
       */
      function yieldThread(thread) {
        let hot = hotThreads.get(thread.root.uri);
        if (!hot) {
          hot = thread;
          hot.hotInteractions = 1;
        } else {
          const hotInteractions = (hot.hotInteractions || 0) + 1;
          hot = thread;
          hot.hotInteractions = hotInteractions;
        }

        streaming.yield(thread, buf => {
          if (!buf) return [thread];
          buf.push(thread);
          return buf;
        });
      }

      /**
       * @param {import('bski').FirehoseRepositoryRecord<'app.bsky.feed.like'>} msg 
       */
      async function handleLike(msg) {
        const thread = await getPostThreadCached(msg.subject.uri);
        if (!thread) return;
        yieldThread(thread);
      }

      /**
       * @param {import('bski').FirehoseRepositoryRecord<'app.bsky.feed.post'>} msg 
       */
      async function handlePost(msg) {
        const thread = await getPostThreadCached(msg.uri);
        if (!thread) return;
        yieldThread(thread);
      }

      /**
       * @param {import('bski').FirehoseRepositoryRecord<'app.bsky.feed.repost'>} msg 
       */
      async function handleRepost(msg) {
        const thread = await getPostThreadCached(msg.subject.uri);
        if (!thread) return;
        yieldThread(thread);
      }

    });

}