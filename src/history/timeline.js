// @ts-check

import SettingsIcon from '@mui/icons-material/Settings';
import React from 'react';

import { useDB } from '..';
import { useForAwait } from '../../coldsky/src/api/forAwait';
import { ThreadView } from '../widgets/post/thread';
import { Visible } from '../widgets/visible';

import { localise } from '../localise';
import './timeline.css';

/**
 * @param {{
 *  shortDID: string,
 *  searchQuery?: string,
 * }} _
 */
export function Timeline({ shortDID, searchQuery }) {
  const db = useDB();

  const [retrieved, next] = useForAwait(
    shortDID + '\n' + searchQuery,
    () => getTimeline(shortDID, searchQuery));

  if (retrieved?.cachedOnly) {
    setTimeout(next, 800 + Math.random() * 400);
  }

  return (
    <div className='timeline-container'>
      {
        !retrieved?.timeline ? undefined :

          retrieved.timeline.map((thread, i) => (
            <ThreadView
              key={i}
              thread={thread}
              significantPost={post => !!post.matches?.length}
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
            <Visible onVisible={() => {
              next();
            }}>
              <div>&nbsp;</div>
            </Visible>
          </div>
        </div>
        <VisibleTimelineFooter
          cachedOnly={retrieved?.cachedOnly}
          complete={retrieved?.complete}
          searchQuery={searchQuery}
          next={next}
        />
      </Visible>
    </div>
  );

  /**
   * @param {{
   *  cachedOnly?: boolean,
   *  complete?: boolean,
   *  searchQuery?: any,
   *  next?: () => void
   * }} _
   */
  function VisibleTimelineFooter({ cachedOnly, complete, searchQuery, next }) {
    let footerText = '';
    let footerClass = 'bottom-more';
    if (complete) {
      if (searchQuery) {
        footerText = localise('Search complete.', { uk: 'Більше нема.' });
        footerClass = 'timeline-footer timeline-footer-search timeline-footer-search-complete';
      } else {
        footerText = localise('Timeline end.', { uk: 'Все. Край стрічки.' });
        footerClass = 'timeline-footer timeline-footer-complete';
      }
    }
    else if (searchQuery) {
      if (cachedOnly) {
        footerText = localise('Loading search results...', { uk: 'Пошук...' });
        footerClass = 'timeline-footer timeline-footer-search timeline-footer-search-cached';
      } else {
        footerText = localise('Loading more search results...', { uk: 'Пошук ще...' });
        footerClass = 'timeline-footer timeline-footer-search';
      }
    } else {
      if (cachedOnly) {
        footerText = localise('Loading...', { uk: 'Завантаження...' });
        footerClass = 'timeline-footer timeline-footer-cached';
      } else {
        footerText = localise('Loading more...', { uk: 'Ще...' });
        footerClass = 'timeline-footer';
      }
    }

    return (
      <div className={footerClass}>
      <button className='footer-button' onClick={() => {
        next?.();
        }}>
        {
          <SettingsIcon className='footer-cog-icon' />
        }
        {
          footerText
        }
      </button>
      </div>
    );
  }


  /**
   * @param {string} didOrHandle
   * @param {string | undefined} searchQuery
   */
  async function* getTimeline(didOrHandle, searchQuery) {
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
      let livePosts = false;

      for await (const entries of db.searchPostsIncrementally(shortDID, searchQuery)) {
        if (!entries?.length) continue;

        entries.sort((p1, p2) => (p2.asOf || 0) - (p1.asOf || 0));

        /** @type {Map<string, import('../../coldsky/lib').CompactPost>} */
        const searchMatchPosts = new Map();
        for (const post of entries) {
          searchMatchPosts.set(post.uri, post);
        }

        for (const post of entries) {
          if (seenPosts.has(post.threadStart || post.uri)) continue;
          seenPosts.add(post.threadStart || post.uri);

          let postThreadRetrieved;
          for await (const postThread of db.getPostThreadIncrementally(post.uri)) {
            postThreadRetrieved = postThread;
          }

          if (!postThreadRetrieved) continue;
          postThreadRetrieved = {
            ...postThreadRetrieved,
            all: postThreadRetrieved.all.map(post => searchMatchPosts.get(post.uri) || post),
            current: searchMatchPosts.get(postThreadRetrieved.current.uri) || postThreadRetrieved.current,
            root: searchMatchPosts.get(postThreadRetrieved.root.uri) || postThreadRetrieved.root
          };

          historicalPostThreads.push(postThreadRetrieved);
          if (!livePosts) {
            historicalPostThreads.sort((t1, t2) => (t2.current.asOf || 0) - (t1.current.asOf || 0));
          }

          yield { timeline: historicalPostThreads, cachedOnly: entries.cachedOnly, complete: false };
        }

        livePosts = !entries.cachedOnly;
      }
      console.log('timeline to end...');

      yield { timeline: historicalPostThreads, cachedOnly: false, complete: true };
    } finally {
      console.log('timeline finally');
    }
  }
}
