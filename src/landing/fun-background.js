// @ts-check

import React from 'react';

import './fun-background.css';
import { calcHash, firehoseThreads, nextRandom } from '../api';
import { FavoriteBorder } from '@mui/icons-material';
import { forAwait } from '../../coldsky/src/api/forAwait';
import { AccountLabel } from '../widgets/account';
import { useNavigate } from 'react-router-dom';
import { useDB } from '..';
import { makeFeedUri } from '../../coldsky/lib';
import { PreFormatted } from '../widgets/preformatted';
import { Post } from '../widgets/post/post';

const POST_DEBOUNCE_MSEC = 5000;
const POST_MAX_AGE = 1000 * 40;
const DESIRED_POST_COUNT = 4;

export function FunBackground() {
  const db = useDB();
  const { bestThreads } = forAwait('now', () => getFirehoseThreads(db)) || {};

  return (
    <div className='fun-background'>
      <div className='fun-background-scroller'>

        {
          bestThreads && bestThreads.map((thread, i) => (
            <ThreadBubble key={thread?.current?.uri || 'undefined'}
              thread={thread}
            />
          ))
        }

      </div>
    </div>
  );
}

/**
 * @param {import('..').DBAccess} db
 */
async function* getFirehoseThreads(db) {

  /** @type {Map<string, number>} */
  const seenPostWhen = new Map();

  /**
   * @type {import('../../coldsky/lib').CompactThreadPostSet[]}
   */
  let bestCurrentThreads = [];

  for await (const chunk of firehoseThreads(db)) {
    /** @type {import('../../coldsky/lib').CompactThreadPostSet[]} */
    const bestThreads = [];
    const now = Date.now();

    const threadTooOld = now - POST_MAX_AGE;
    for (const oldThread of bestCurrentThreads) {
      const seen = seenPostWhen.get(oldThread.current.uri);
      if (seen && seen > threadTooOld) {
        bestThreads.push(oldThread);
      }
    }

    const newThreads = [];

    for (const thread of chunk) {
      if (!thread?.current?.text) continue;
      if (seenPostWhen.has(thread.current.uri)) continue;
      seenPostWhen.set(thread.current.uri, now);

      newThreads.push(thread);
    }

    newThreads.sort((t1, t2) => {
      const likes1 =
        (t1.current?.likeCount || 0) +
        (t1.root?.likeCount || 0);

      const likes2 =
        (t2.current?.likeCount || 0) +
        (t2.root?.likeCount || 0);

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
 *  thread: import('../../coldsky/lib').CompactThreadPostSet
 * }} _ 
 */
function ThreadBubble({ thread }) {
  const db = useDB();
  const hash = calcHash(thread?.current?.uri);
  let rnd = nextRandom(Math.abs(hash / 1000 + hash));
  const slideDuration = 20 + rnd * 30; 
  rnd = nextRandom(rnd);
  const rockDuration = 3 + rnd * 12; 
  rnd = nextRandom(rnd);

  const left = rnd * 80 - 2;

  const navigate = useNavigate();

  return (
    <div className='fun-background-thread-bubble'
      style={{
        animationDuration: `${slideDuration.toFixed(2)}s`,
        left: `${left.toFixed(2)}%`
      }}
    >
      <div className='fun-background-thread'
        style={{
          animationDuration: `${rockDuration.toFixed(2)}s`
        }}>
        <Post
          post={thread.current}
          linkTimestamp
        />
      </div>
    </div>
  );
}