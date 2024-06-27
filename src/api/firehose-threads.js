// @ts-check

import Dexie from 'dexie';

import { firehose, ColdskyAgent } from '../../coldsky/lib';
import { throttledAsyncCache } from '../../coldsky/lib/throttled-async-cache';
import { streamBuffer } from '../../coldsky/src/api/akpa';
import { BSKY_PUBLIC_URL } from '../../coldsky/lib/coldsky-agent';

/**
 * @returns {AsyncIterable<import('@atproto/api/dist/client/types/app/bsky/feed/defs').ThreadViewPost>}
 */
export async function* firehoseThreads() {
  for await (const chunk of firehoseThreadsChunked()) {
    for (const thread of chunk)
      yield thread;
  }
}

/**
 * @returns {AsyncIterable<import('@atproto/api/dist/client/types/app/bsky/feed/defs').ThreadViewPost[]>}
 */
function firehoseThreadsChunked() {

  return streamBuffer(async streaming => {
    const publicAgent = new ColdskyAgent({
      service: BSKY_PUBLIC_URL
    });
    keepMonitoringFirehose();

    await streaming.finally;

    async function keepMonitoringFirehose() {
      for await (const chunk of firehose()) {
        if (streaming.isEnded) break;
        for (const entry of chunk) {
          for (const msg of entry.messages) {
            switch (msg.$type) {
              case 'app.bsky.feed.like': handleLike(msg); continue;
              case 'app.bsky.feed.post': handlePost(msg); continue;
              case 'app.bsky.feed.repost': handleRepost(msg); continue;
            }
          }
        }
      }
    }

    /**
     * @param {import('../../coldsky/lib/firehose').FirehoseMessageOfType<'app.bsky.feed.like'>} msg 
     */
    async function handleLike(msg) {
      const thread = (await publicAgent.getPostThread({
        uri: msg.subject.uri
      }))?.data?.thread;
      if (!thread || thread.blocked || thread.notFound) return;
      streaming.yield(thread);
    }

    /**
     * @param {import('../../coldsky/lib/firehose').FirehoseMessageOfType<'app.bsky.feed.post'>} msg 
     */
    async function handlePost(msg) {
      const thread = (await publicAgent.getPostThread({
        uri: 'at://' + msg.repo + '/' + msg.path
      }))?.data?.thread;
      if (!thread || thread.blocked || thread.notFound) return;
      streaming.yield(thread);
    }

    /**
     * @param {import('../../coldsky/lib/firehose').FirehoseMessageOfType<'app.bsky.feed.repost'>} msg 
     */
    function handleRepost(msg) {
      // TODO: store post, queue thread fetching
    }
    
  });

}
