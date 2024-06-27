// @ts-check

import React from 'react';

import { useDB } from '..';
import { useForAwait } from '../../coldsky/src/api/forAwait';
import { ThreadView } from '../widgets/post/thread';
import { Visible } from '../widgets/visible';

import './timeline.css';
import { Visibility } from '@mui/icons-material';

/**
 * @param {{
 *  shortDID: string
 * }} _
 */
export function Timeline({ shortDID }) {
  const db = useDB();

  const [retrieved, next] = useForAwait(shortDID, getTimeline);
  let anyPlaceholder = false;
  for (const postThread of retrieved?.timeline || []) {
    if (postThread.current.placeholder || postThread.root.placeholder) {
      anyPlaceholder = true;
      break;
    }

    for (const post of postThread.all) {
      if (post.placeholder) {
        anyPlaceholder = true;
        break;
      }
    }

    if (anyPlaceholder) break;
  }

  if (anyPlaceholder || retrieved?.cachedOnly) {
    setTimeout(next, 300);
  }

  return (
    <div className='timeline-container'>
      {
        !retrieved?.timeline ? undefined :
        
          retrieved.timeline.map((thread, i) => (
            <ThreadView
              key={i}
              thread={thread}
              shortDID={shortDID}
              linkTimestamp={true}
              linkAuthor={true}
            />
          ))
      }
      <Visible
        onVisible={() =>
          next()
        }>
        <div className='timeline-bottom-visibility-spacer'>
          <div className='timeline-bottom-visibility-spacer-inner'>
            <Visible onVisible={next}>
              <div>&nbsp;</div>
            </Visible>
          </div>
        </div>
        <button onClick={() =>
          next()
        }>
          Search more...
        </button>
      </Visible>
    </div>
  );


  async function* getTimeline(didOrHandle) {
    try {
      let shortDID;
      for await (const profile of db.getProfileIncrementally(didOrHandle)) {
        if (profile.shortDID) {
          shortDID = profile.shortDID;
          break;
        }
      }

      /**
       * @type {import('../../coldsky/lib').CompactThreadPostSet[]}
       */
      let historicalPostThreads = [];
      /** @type {Set<string>} */
      const seenPosts = new Set();

      for await (const entries of db.searchPostsIncrementally(shortDID, undefined)) {
        if (!entries?.length) continue;

        entries.sort((p1, p2) => (p2.asOf || 0) - (p1.asOf || 0));

        for (const post of entries) {
          if (seenPosts.has(post.threadStart || post.uri)) continue;
          seenPosts.add(post.threadStart || post.uri);

          let postThreadRetrieved;
          for await (const postThread of db.getPostThreadIncrementally(post.uri)) {
            postThreadRetrieved = postThread;
          }

          if (!postThreadRetrieved) continue;

          historicalPostThreads.push(postThreadRetrieved);
          yield { timeline: historicalPostThreads, cachedOnly: entries.cachedOnly };
        }
      }
      console.log('timeline to end...');
    } finally {
      console.log('timeline finally');
    }
  }
}
