// @ts-check

import React from 'react';

import './fun-background.css';
import { calcHash, firehoseThreads, nextRandom } from '../api';
import { FavoriteBorder } from '@mui/icons-material';
import { forAwait } from '../../coldsky/src/api/forAwait';

const POST_DEBOUNCE_MSEC = 1000;
const POST_MAX_AGE = 1000 * 30;
const DESIRED_POST_COUNT = 7;

export function FunBackground() {
  const { bestThreads } = forAwait('now', getFirehoseThreads) || {};

  return (
    <div className='fun-background'>
      <div className='fun-background-scroller'>

        {
          bestThreads && bestThreads.map((thread, i) => (
            <ThreadBubble key={thread?.post?.uri || 'undefined'}
              thread={thread}
            />
          ))
        }

      </div>
    </div>
  );
}

async function* getFirehoseThreads() {

  /** @type {Map<string, number>} */
  const seenPostWhen = new Map();

  /**
   * @type {import('../api/firehose-threads').ThreadViewPost[]}
   */
  let bestCurrentThreads = [];

  for await (const chunk of firehoseThreads()) {
    const bestThreads = [];
    const now = Date.now();

    const threadTooOld = now - POST_MAX_AGE;
    for (const oldThread of bestCurrentThreads) {
      if (seenPostWhen.get(oldThread.post.uri) > threadTooOld) {
        bestThreads.push(oldThread);
      }
    }

    const newThreads = [];

    for (const thread of chunk) {
      if (!thread?.post?.record.text) continue;
      if (seenPostWhen.has(thread?.post?.uri)) continue;
      seenPostWhen.set(thread?.post?.uri, now);

      newThreads.push(thread);
    }

    newThreads.sort((t1, t2) => {
      const likes1 =
        (t1.post?.likeCount || 0) +
        (t2.parent?.post?.likeCount || 0);

      const likes2 =
        (t2.post?.likeCount || 0) +
        (t1.parent?.post?.likeCount || 0);

      return likes2 - likes1;
    });

    for (let i = 0; i < newThreads.length; i++) {
      if (!i || bestThreads.length < DESIRED_POST_COUNT) {
        bestThreads.push(newThreads[i]);
      }
    }

    bestCurrentThreads = bestThreads;

    yield { bestThreads };
    await new Promise(resolve => setTimeout(resolve, POST_DEBOUNCE_MSEC));
  }
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