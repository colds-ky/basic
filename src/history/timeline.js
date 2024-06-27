// @ts-check

import React from 'react';
import { forAwait, useForAwait } from '../../coldsky/src/api/forAwait';
import { getProfileHistory } from '../api/record-cache';
import { Visible } from '../widgets/visible';

/**
 * @param {{
 *  shortDID: string
 * }} _
 */
export function Timeline({ shortDID }) {

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
}

async function* getTimeline(shortDID) {
  try {
    for await (const timeline of getProfileHistory(shortDID)) {
      yield { timeline };
    }
    console.log('timeline to end...');
  } finally {
    console.log('timeline finally');
  }
}
