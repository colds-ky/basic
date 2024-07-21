// @ts-check

import React, { useState } from 'react';

import { useDB } from '../../app';
import { useForAwait } from '../../app-shared/forAwait';
import { ThreadView } from '../../widgets/post/thread';
import { Visible } from '../../widgets/visible';
import { SearchNewestProgress, SearchOldestProgress } from './search-animations';
import { VisibleTimelineFooter } from './visible-timeline-footer';

import './timeline.css';

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
    () => db.getTimelineIncrementally(shortDID, searchQuery));

  const [largerMarkerVisible, setLargerMarkerVisible] = useState(!!(retrieved?.length));
  const [buttonMarkerVisbile, setButtonMarkerVisible] = useState(!!(retrieved?.length));
  const [spacingMarkerVisible, setSpacingMarkerVisible] = useState(!!(retrieved?.length));

  if (retrieved?.cachedOnly || largerMarkerVisible || buttonMarkerVisbile || spacingMarkerVisible) {
    setTimeout(searchMore, 800 + Math.random() * 400);

    if ((largerMarkerVisible || buttonMarkerVisbile || spacingMarkerVisible) && (retrieved?.length || 0) > maxPosts) {
      setTimeout(() => {
        revealMore();
      }, 1);
    }
  }

  let minTimestamp = 0;
  let maxTimestamp = 0;
  if (retrieved?.length) {
    for (const thread of retrieved) {
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
      retrieved.processedBatch;
  
  let visiblePosts = retrieved || [];
  if (visiblePosts.length > maxPosts) {
    visiblePosts = visiblePosts.slice(0, maxPosts);
  }

  return (
    <div className='timeline-container'>
      {
        !searchQuery || retrieved?.complete ? undefined :
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
              linkTimestamp
              linkAuthor
            />
          ))
      }
      <Visible
        onVisible={() => {
          revealMore();
          setLargerMarkerVisible(true);
        }}
        onObscured={() => {
          setLargerMarkerVisible(false);
        }}>
        <div className='timeline-bottom-visibility-spacer'>
          <div className='timeline-bottom-visibility-spacer-inner'>
            <Visible
              onVisible={() => {
                revealMore();
                setSpacingMarkerVisible(true);
              }}
              onObscured={() => {
                setSpacingMarkerVisible(false);
              }}>
              <div>&nbsp;</div>
            </Visible>
          </div>
        </div>
        <Visible
          rootMargin='100px'
          onVisible={() => {
            revealMore();
            setButtonMarkerVisible(true);
          }}
          onObscured={() => {
            setButtonMarkerVisible(false);
          }}>
          <VisibleTimelineFooter
            cachedOnly={retrieved?.cachedOnly}
            complete={retrieved?.complete}
            searchQuery={searchQuery}
            filteredCount={retrieved?.length}
            processedAllCount={retrieved?.processedAllCount}
            next={() => {
              revealMore();
            }}
          />
          
          {
            !searchQuery || retrieved?.complete ? undefined :
              <SearchOldestProgress
                posts={processedBatchOldest}
              />
          }
        </Visible>
      </Visible>
    </div>
  );

  function revealMore() {
    searchMore();
    if (retrieved?.length > maxPosts) {
      setMaxPosts(maxPosts + EXPAND_VISIBLE_POSTS);
    }
  }

}
