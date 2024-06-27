// @ts-check

import { firehose, ColdskyAgent, defineCacheIndexedDBStore } from '../../coldsky/lib';
import { throttledAsyncCache } from '../../coldsky/lib/throttled-async-cache';
import { streamBuffer } from '../../coldsky/src/api/akpa';
import { BSKY_PUBLIC_URL } from '../../coldsky/lib/coldsky-agent';

/**
 * @typedef {import('@atproto/api/dist/client/types/app/bsky/feed/defs').ThreadViewPost} ThreadViewPost
 */


/**
 * @param {ReturnType<typeof defineCacheIndexedDBStore>} db
 * @returns {AsyncIterable<ThreadViewPost[]>}
 */
export function firehoseThreads(db) {
  return streamBuffer(
    /**
     * @param {import('../../coldsky/src/api/akpa').StreamParameters<ThreadViewPost, ThreadViewPost[]>} streaming 
     */
    async streaming => {
      const publicAgent = new ColdskyAgent({
        service: BSKY_PUBLIC_URL
      });

      const getPostThreadCached = throttledAsyncCache(
        (uri) => {
          if (streaming.isEnded) return;
          return publicAgent.getPostThread({ uri }).then(res => {
            const threadView = res?.data?.thread;
            if (threadView.post) db.captureThreadView(
              /** @type {ThreadViewPost} */(threadView),
              Date.now());
            return threadView;
          });
        });

      keepMonitoringFirehose();

      await streaming.finally;
      console.log('firehoseThreads ended');

      async function keepMonitoringFirehose() {
        for await (const chunk of firehose()) {
          if (streaming.isEnded) break;
          for (const entry of chunk) {
            for (const msg of entry.messages) {
              db.captureRecord(msg, entry.receiveTimestamp);
              switch (msg.$type) {
                case 'app.bsky.feed.like': handleLike(msg); continue;
                case 'app.bsky.feed.post': handlePost(msg); continue;
                case 'app.bsky.feed.repost': handleRepost(msg); continue;
              }
            }
          }
        }
      }
      
      function yieldThread(thread) {
        cacheAllMentionedAccounts(thread);
        streaming.yield(thread, buf => {
          if (!buf) return [thread];
          buf.push(thread);
          return buf;
        });
      }

      /**
       * @param {ThreadViewPost} thread
       */
      function cacheAllMentionedAccounts(thread) {
        db.captureThreadView(thread, Date.now());
      }

      /**
       * @param {import('../../coldsky/lib/firehose').FirehoseMessageOfType<'app.bsky.feed.like'>} msg 
       */
      async function handleLike(msg) {
        const thread = await getPostThreadCached(msg.subject.uri);
        if (!thread || thread.blocked || thread.notFound) return;
        yieldThread(thread);
      }

      /**
       * @param {import('../../coldsky/lib/firehose').FirehoseMessageOfType<'app.bsky.feed.post'>} msg 
       */
      async function handlePost(msg) {
        const thread = await getPostThreadCached('at://' + msg.repo + '/' + msg.path);
        if (!thread || thread.blocked || thread.notFound) return;
        yieldThread(thread);
      }

      /**
       * @param {import('../../coldsky/lib/firehose').FirehoseMessageOfType<'app.bsky.feed.repost'>} msg 
       */
      async function handleRepost(msg) {
        const thread = await getPostThreadCached(msg.subject.uri);
        if (!thread || thread.blocked || thread.notFound) return;
        yieldThread(thread);
      }

    });

}
