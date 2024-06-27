// @ts-check

import SettingsIcon from '@mui/icons-material/Settings';
import React, { useEffect, useState } from 'react';

import { useDB } from '..';
import { useForAwait } from '../../coldsky/src/api/forAwait';
import { ThreadView } from '../widgets/post/thread';
import { Visible } from '../widgets/visible';

import { localise, localiseNumberSuffixEnglish, localiseNumberSuffixUkrainian } from '../localise';
import './timeline.css';
import { Post } from '../widgets/post/post';

const INITIAL_VISIBLE_POSTS = 20;
const EXPAND_VISIBLE_POSTS = 14;

/**
 * @param {{
 *  shortDID: string,
 *  searchQuery?: string,
 * }} _
 */
export function Timeline({ shortDID, searchQuery }) {
  const db = useDB();
  const [maxPosts, setMaxPosts] = useState(INITIAL_VISIBLE_POSTS);

  const [retrieved, searchMore] = useForAwait(
    shortDID + '\n' + searchQuery,
    () => getTimeline(shortDID, searchQuery));

  if (retrieved?.cachedOnly) {
    setTimeout(searchMore, 800 + Math.random() * 400);
  }

  let minTimestamp = 0;
  let maxTimestamp = 0;
  if (retrieved?.timeline?.length) {
    for (const thread of retrieved.timeline) {
      if (thread.root?.asOf && (!minTimestamp || thread.root.asOf < minTimestamp))
        minTimestamp = thread.root.asOf;
      for (const post of thread.all) {
        if (post?.asOf && post.asOf > maxTimestamp)
          maxTimestamp = post.asOf;
      }
    }
  }

  const processedBatchNewest =
    !searchQuery || retrieved?.complete || !retrieved?.processedBatch?.length ?
      undefined :
      retrieved.processedBatch.filter(post => post.asOf && post.asOf > minTimestamp);

  const processedBatchOldest =
    !searchQuery || retrieved?.complete || !retrieved?.processedBatch?.length ?
      undefined :
      retrieved.processedBatch.filter(post => post.asOf && post.asOf < maxTimestamp);
  
  let visiblePosts = retrieved?.timeline || [];
  if (visiblePosts.length > maxPosts) {
    visiblePosts = visiblePosts.slice(0, maxPosts);
  }

  return (
    <div className='timeline-container'>
      {
        !processedBatchNewest?.length ? undefined :
          <SearchNewestProgress
            posts={processedBatchNewest}
          />
      }
      {
        visiblePosts.map((thread, i) => (
            <ThreadView
              key={i}
              thread={thread}
              significantPost={post => searchQuery ? !!post.matches?.length : post.shortDID === shortDID}
              linkTimestamp={true}
              linkAuthor={true}
            />
          ))
      }
      <Visible
        onVisible={() => {
          revealMore();
        }}>
        <div className='timeline-bottom-visibility-spacer'>
          <div className='timeline-bottom-visibility-spacer-inner'>
            <Visible onVisible={() => {
              revealMore();
            }}>
              <div>&nbsp;</div>
            </Visible>
          </div>
        </div>
        {
          !processedBatchOldest?.length ? undefined :
            <SearchOldestProgress
              posts={processedBatchOldest}
            />
        }
        <Visible
          rootMargin='100px'
          onVisible={() => {
            revealMore();
          }}
        >
          <VisibleTimelineFooter
            cachedOnly={retrieved?.cachedOnly}
            complete={retrieved?.complete}
            searchQuery={searchQuery}
            filteredCount={retrieved?.timeline?.length}
            processedAllCount={retrieved?.processedAllCount}
            next={() => {
              revealMore();
            }}
            />
        </Visible>
      </Visible>
    </div>
  );

  function revealMore() {
    searchMore();
    if (retrieved?.timeline?.length > maxPosts) {
      setMaxPosts(maxPosts + EXPAND_VISIBLE_POSTS);
    }
  }

  /**
   * @param {{
   *  cachedOnly?: boolean,
   *  complete?: boolean,
   *  searchQuery?: any,
   *  filteredCount?: number,
   *  processedAllCount?: number,
   *  next?: () => void
   * }} _
   */
  function VisibleTimelineFooter({
    cachedOnly,
    complete,
    searchQuery,
    filteredCount,
    processedAllCount,
    next }) {
    let footerText = '';
    let footerClass = 'bottom-more';

    if (complete) {
      if (searchQuery) {
        footerText =
          !processedAllCount ? localise('No posts ever.', { uk: 'Нема жодного контенту.' }) :
            !filteredCount ? localise(
              'Nothing matches across ' + processedAllCount.toLocaleString() + '.',
              { uk: 'Нічого не підходить поміж ' + processedAllCount.toLocaleString() + '.' }) :
              localise(
                filteredCount.toLocaleString() + ' found out of ' + processedAllCount.toLocaleString() + '.',
                { uk: filteredCount.toLocaleString() + ' знайдено з ' + processedAllCount.toLocaleString() + '.'});
        footerClass = 'timeline-footer timeline-footer-search timeline-footer-search-complete';
      } else {
        footerText =
          !processedAllCount ? localise('No posts ever.', { uk: 'Нема жодного контенту.' }) :
            localise(
              processedAllCount.toLocaleString() + localiseNumberSuffixEnglish(processedAllCount, ' tweet') + '. Timeline end.',
              { uk: processedAllCount.toLocaleString() + localiseNumberSuffixUkrainian(processedAllCount, { 1: ' твіт', 2: ' твіта', 5: ' твітів' }) + '. Край стрічки.' });
        footerClass = 'timeline-footer timeline-footer-complete';
      }
    }
    else if (searchQuery) {
      if (cachedOnly) {
        footerText =
          !processedAllCount ? localise('Searchштп for tweets...', { uk: 'Пошук твітів...' }) :
          !filteredCount ? localise(
            'Searching for tweets (' + processedAllCount.toLocaleString() + ' processed)...',
            { uk: 'Пошук твітів (' + processedAllCount.toLocaleString() + ' переглянуто)...' }) :
            localise(
              'Searching for tweets: ' + filteredCount.toLocaleString() + ' found out of ' + processedAllCount.toLocaleString() + '...',
              { uk: 'Пошук твітів: ' + filteredCount.toLocaleString() + ' знайдено поміж ' + processedAllCount.toLocaleString() + '...'}
          );
        footerClass = 'timeline-footer timeline-footer-search timeline-footer-search-cached';
      } else {
        footerText =
          !processedAllCount ? localise('Searching...', { uk: 'Пошук...' }) :
            !filteredCount ? localise(
              'Searching (' + processedAllCount.toLocaleString() + ' processed)...',
              { uk: 'Пошук (' + processedAllCount.toLocaleString() + ' переглянуто)...' }) :
              localise(
                'Searching: ' + filteredCount.toLocaleString() + ' found out of ' + processedAllCount.toLocaleString() + '...',
                { uk: 'Пошук: ' + filteredCount.toLocaleString() + ' знайдено поміж ' + processedAllCount.toLocaleString() + '...' }
              );
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
      const fullyResolvedPosts = new Set();
      let livePosts = false;
      let processedAllCount = 0;
      /** @type {import('../../coldsky/lib/data/cached-store').IncrementalMatchCompactPosts | undefined} */
      let postponeCachedPostFullResolve;

      for await (const entries of db.searchPostsIncrementally(shortDID, searchQuery)) {
        if (!entries?.length) continue;
        if (entries.cachedOnly) postponeCachedPostFullResolve = entries;

        entries.sort((p1, p2) => (p2.asOf || 0) - (p1.asOf || 0));

        /** @type {Map<string, import('../../coldsky/lib').CompactPost>} */
        const searchMatchPosts = new Map();
        for (const post of entries) {
          searchMatchPosts.set(post.uri, post);
        }

        const resolveThreads = entries.cachedOnly || !postponeCachedPostFullResolve ?
          entries :
          entries.concat(postponeCachedPostFullResolve);

        for (const post of resolveThreads) {
          if (fullyResolvedPosts.has(post.uri)) continue;

          let postThreadRetrieved;
          for await (const postThread of db.getPostThreadIncrementally(post.uri)) {
            postThreadRetrieved = postThread;
            if (entries.cachedOnly && postThread) break;
          }

          if (!postThreadRetrieved) continue;
          if (!entries.cachedOnly) fullyResolvedPosts.add(post.uri);

          postThreadRetrieved = {
            ...postThreadRetrieved,
            all: postThreadRetrieved.all.map(post => searchMatchPosts.get(post.uri) || post),
            current: searchMatchPosts.get(postThreadRetrieved.current.uri) || postThreadRetrieved.current,
            root: searchMatchPosts.get(postThreadRetrieved.root.uri) || postThreadRetrieved.root
          };

          const partialThreadIndex = historicalPostThreads.findIndex(t => t.root.uri === postThreadRetrieved.root.uri);
          if (partialThreadIndex >= 0) {
            historicalPostThreads[partialThreadIndex] = postThreadRetrieved;
          } else {
            historicalPostThreads.push(postThreadRetrieved);
          }

          if (!livePosts) {
            historicalPostThreads.sort((t1, t2) => (t2.current.asOf || 0) - (t1.current.asOf || 0));
          }

          if (typeof entries.processedAllCount === 'number')
            processedAllCount = entries.processedAllCount;

          const nextTimelineSnapshot = {
            timeline: historicalPostThreads,
            cachedOnly: entries.cachedOnly,
            processedBatch: entries.processedBatch,
            processedAllCount: entries.processedAllCount,
            complete: false
          };

          yield nextTimelineSnapshot;
        }

        if (!entries.cachedOnly) postponeCachedPostFullResolve = undefined;

        livePosts = !entries.cachedOnly;
      }

      if (postponeCachedPostFullResolve) {

      }

      console.log('timeline to end...');

      yield {
        timeline: historicalPostThreads,
        cachedOnly: false,
        complete: true,
        processedBatch: [],
        processedAllCount: Math.max(processedAllCount, historicalPostThreads.length)
      };
    } finally {
      console.log('timeline finally');
    }
  }
}

/**
 * @param {{
 *  posts: import('../../coldsky/lib').CompactPost[],
 *  filteredCount?: number,
 *  processedAllCount?: number,
 * }} props
 */
function SearchNewestProgress(props) {
  return (
    <ProcessingAnimation {...props} />
  );
}

/**
 * @param {{
 *  posts: import('../../coldsky/lib').CompactPost[],
 *  filteredCount?: number,
 *  processedAllCount?: number,
 * }} props
 */
function SearchOldestProgress(props) {
  return (
    <ProcessingAnimation toLeft {...props} />
  );
}

const FLYING_POST_ANIMATION_DURATION = 1000;

/**
 * @param {{
 *  toLeft?: boolean,
 *  posts: import('../../coldsky/lib').CompactPost[],
 *  filteredCount?: number,
 *  processedAllCount?: number,
 * }} _
 */
function ProcessingAnimation({ toLeft, posts, filteredCount, processedAllCount }) {
  /**
   * @typedef {{
   *  post: import('../../coldsky/lib').CompactPost,
   *  animationStart: number,
   *  animationEnd: number,
   *  animationEndTimeout: number
   * }} FlyingPost
   */
  const [flyingPosts, setFlyingPosts] = useState(/** @type {FlyingPost[]} */([]));
  useEffect(() => {
    let tm = setTimeout(dropNextPost, 1);

    return () => {
      clearTimeout(tm);
      for (const fp of flyingPosts) {
        clearTimeout(fp.animationEndTimeout);
      }
    };

    function dropNextPost() {
      let nextPost = posts.find(p => !flyingPosts.find(fp => fp.post.uri === p.uri));
      if (nextPost) {
        const now = Date.now();
        setFlyingPosts([...flyingPosts, {
          post: nextPost,
          animationStart: now,
          animationEnd: now + FLYING_POST_ANIMATION_DURATION,
          animationEndTimeout: /** @type {*} */(setTimeout(() => {
            setFlyingPosts(flyingPosts.filter(fp => fp.post.uri !== nextPost.uri));
          }, FLYING_POST_ANIMATION_DURATION))
        }]);
      }
    } 
  }, []);

  return (
    <div
      className={
        toLeft ? 'processing-animation processing-animation-to-left' :
          'processing-animation processing-animation-to-right'}>
      {
        flyingPosts.map((fp, i) => (
          <FlyingPost
            key={i}
            post={fp.post}
            animationStart={fp.animationStart}
            animationEnd={fp.animationEnd}
          />
        ))
      }
    </div>
  );
}

/**
 * @param {{
 *  post: import('../../coldsky/lib').CompactPost,
 *  animationStart: number,
 *  animationEnd: number
 * }} _
 */
function FlyingPost({ post, animationStart, animationEnd }) {
  return (
    <Post className='flying-post' allowEmbedDepth={0} post={post}>
    </Post>
  );
}
