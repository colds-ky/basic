// @ts-check

import React from 'react';
import { forAwait, useForAwait } from '../../coldsky/src/api/forAwait';
import { Visible } from '../widgets/visible';
import { useDB } from '..';

/**
 * @param {{
 *  shortDID?: string
 * }} _
 */
export function Timeline({ shortDID }) {
  const db = useDB();

  const [{ timeline } = {}, next] = useForAwait(shortDID, getTimeline);

  return (
    <>
      {
        !timeline ? undefined :
        
          timeline.map((event, i) => (
            <div key={i}>
              {
                JSON.stringify(event, null, 2)
              }
            </div>
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


  async function* getTimeline(shortDID) {
    try {
      const entries = await db.searchPosts(shortDID);
      yield { timeline: entries };
      // for await (const timeline of db.searchPosts(shortDID)) {
      //   yield { timeline };
      // }
      console.log('timeline to end...');
    } finally {
      console.log('timeline finally');
    }
  }
}