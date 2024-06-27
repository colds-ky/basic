// @ts-check

import React from 'react';

import './fun-background.css';
import { calcHash, firehoseThreads, nextRandom } from '../api';
import { FavoriteBorder } from '@mui/icons-material';

const POST_DEBOUNCE_MSEC = 1000;

export function FunBackground() {
  const [threads, setThreads] = React.useState(
    /** @type {import('@atproto/api/dist/client/types/app/bsky/feed/defs').ThreadViewPost[]} */([])
  );
  React.useState(async () => {
    const seenPosts = new Set();
    let nextUpdate = Date.now() + POST_DEBOUNCE_MSEC;
    let threadBuf = [];
    for await (const thread of firehoseThreads()) {
      if (!thread?.post?.record.text) continue;
      if (seenPosts.has(thread?.post?.uri)) continue;
      seenPosts.add(thread?.post?.uri);

      threadBuf.push(thread);
      if (Date.now() >= nextUpdate && threadBuf.length > 5) {
        threadBuf.sort((t1, t2) => {
          const likes1 =
            (t1.post?.likeCount || 0) +
            (t2.parent?.post?.likeCount || 0);

          const likes2 =
            (t2.post?.likeCount || 0) +
            (t1.parent?.post?.likeCount || 0);
          return likes2 - likes1;
        });

        const addTop = threadBuf[0];
        setThreads(threads => {
          const newThreads = threads.slice(
            threads.length > 20 ? 1 : 0);
          newThreads.push(addTop);
          return newThreads;
        });

        threadBuf = [];

        nextUpdate =
          Date.now() +
          POST_DEBOUNCE_MSEC * 0.5 +
          // wait less after less liked posts
        Math.min(10, addTop.post?.likeCount || 0) * POST_DEBOUNCE_MSEC * 0.1;

      }
    }
  });

  return (
    <div className='fun-background'>
      <div className='fun-background-scroller'>

        {
          threads.map((thread, i) => (
            <ThreadBubble key={thread?.post?.uri || 'undefined'}
              thread={thread}
            />
          ))
        }

      </div>
    </div>
  );
}

/**
 * @param {{
 *  thread: import('@atproto/api/dist/client/types/app/bsky/feed/defs').ThreadViewPost
 * }} _ 
 */
function ThreadBubble({ thread }) {
  const hash = calcHash(thread?.post?.uri);
  let rnd = nextRandom(Math.abs(hash / 1000 + hash));
  const animationDuration = 20 + rnd * 30; 
  rnd = nextRandom(rnd);

  const left = rnd * 80 - 2;

  return (
    <div className='fun-background-thread'
      style={{
        animationDuration: `${animationDuration.toFixed(2)}s`,
        left: `${left.toFixed(2)}%`
      }}>
      <div className='fun-background-thread-content'>
        {
          thread?.post?.record.text
        }
      </div>
      <div className='fun-background-thread-likes'>
        <FavoriteBorder />
        {
          !thread?.post?.likeCount ? '' :
          thread?.post?.likeCount.toLocaleString()
        }
      </div>
    </div>
  );
}