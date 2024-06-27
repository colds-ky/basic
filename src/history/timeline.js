// @ts-check

import React from 'react';
import { forAwait, useForAwait } from '../../coldsky/src/api/forAwait';
import { Visible } from '../widgets/visible';
import { useDB } from '..';
import { Post } from '../widgets/post';
import { makeFeedUri } from '../../coldsky/lib';

/**
 * @param {{
 *  shortDID?: string
 * }} _
 */
export function Timeline({ shortDID }) {
  const db = useDB();

  const [retrieved, next] = useForAwait(shortDID, getTimeline);

  return (
    <>
      {
        !retrieved.timeline ? undefined :
        
          retrieved.timeline.map((thread, i) => (
            <ThreadView key={i} thread={thread} shortDID={shortDID} />
          ))
      }
      <Visible
        onVisible={() =>
          next()
        }>
        <button onClick={() =>
          next()
        }>
          Search more...
        </button>
      </Visible>
    </>
  );


  async function* getTimeline(didOrHandle) {
    try {
      let shortDID;
      for await (const profile of db.getProfileIncrementally(didOrHandle)) {
        if (profile.shortDID) shortDID = profile.shortDID;
      }

      /**
       * @type {import('../../coldsky/lib').CompactThreadPostSet[]}
       */
      let historicalPostThreads = [];

      for await (const entries of db.searchPostsIncrementally(shortDID, undefined)) {
        if (!entries?.length) continue;
        const threadStarts = [...new Set(entries.map(post => post.threadStart))];
        const threads = [];

        let resolveCount = 0;
        let allResolved = () => { };
        /** @type {Promise<void>} */
        let allResolvedPromise = new Promise(resolve => allResolved = resolve);

        for (let i = 0; i < threadStarts.length; i++) {
          const threadIndex = i;
          (async () => {
            for await (const postThread of db.getPostThreadIncrementally(threadStarts[threadIndex])) {
              if (postThread) threads[threadIndex] = postThread;
            }
            resolveCount++;

            if (resolveCount === threadStarts.length)
              allResolved();
          })();
        }

        await allResolvedPromise;

        historicalPostThreads = historicalPostThreads.concat(threads);

        yield { timeline: historicalPostThreads };
      }
      console.log('timeline to end...');
    } finally {
      console.log('timeline finally');
    }
  }
}

/**
 * @param {{
 *  shortDID?: string,
 *  thread: import('../../coldsky/lib').CompactThreadPostSet,
 * }} _
 */
export function ThreadView({ shortDID, thread }) {

}

/**
 * @param {string} shortDID
 * @param {import('../../coldsky/lib').CompactThreadPostSet} thread
 */
function layoutThread(shortDID, thread) {
  /** @type {Map<string, import('../../coldsky/lib').CompactPost>} */
  const allPosts = new Map();

  /** @type {Map<string, import('../../coldsky/lib').CompactPost>} */
  const ownPosts = new Map();
  for (const post of thread.all) {
    allPosts.set(post.uri, post);
    if (post.shortDID === shortDID) {
      ownPosts.set(post.uri, post);
    }
  }

  if (thread.root.shortDID === shortDID) {
    ownPosts.set(thread.root.uri, thread.root);
    allPosts.set(thread.root.uri, thread.root);
  }

  if (thread.current.shortDID === shortDID) {
    ownPosts.set(thread.current.uri, thread.current);
    allPosts.set(thread.current.uri, thread.current);
  }

  const ownPlaced = new Set(ownPosts.values());
  const ownEearlyFirst = [...ownPlaced].sort((p1, p2) => (p2.asOf || 0) - (p1.asOf || 0));

  /** @typedef {{ post: import('../../coldsky/lib').CompactPost, children: import('../../coldsky/lib').CompactPost[] }} PostNode */

  /** @type {PostNode} */
  let root = {
    post: thread.root,
    children: []
  };
  /** @type {Map<string, PostNode>} */
  const nodeByUri = new Map();

  while (true) {
    // find first not placed
    let notPlaced = ownEearlyFirst.find(post => !ownPlaced.has(post));
    if (!notPlaced) break;


  }
}