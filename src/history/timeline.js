// @ts-check

import React from 'react';
import { forAwait, useForAwait } from '../../coldsky/src/api/forAwait';
import { Visible } from '../widgets/visible';
import { useDB } from '..';
import { Post } from '../widgets/post';

/**
 * @param {{
 *  shortDID?: string
 * }} _
 */
export function Timeline({ shortDID }) {
  const db = useDB();

  const [{ timeline } = [], next] = useForAwait(shortDID, getTimeline);

  return (
    <>
      {
        !timeline ? undefined :
        
          timeline.map((post, i) => (
            <Post key={i} post={post} />
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

      for await (const entries of db.searchPostsIncrementally(shortDID, undefined)) {
        yield { timeline: entries };
      }
      console.log('timeline to end...');
    } finally {
      console.log('timeline finally');
    }
  }
}