// @ts-check

import React, { useEffect, useState } from 'react';
import { updateDIDs } from '../updateDIDs';
import { createShellAPIs } from './shell-api';
import { forAwait } from '../../api/forAwait';

/** @type {ReturnType<typeof updateDIDs> | undefined} */
let maintainStarted;

export function MaintainPanel() {
  if (!maintainStarted) {
    const apis = createShellAPIs();
    maintainStarted = updateDIDs(apis);
  }

  const [_, updateBuckets] = useState(0);

  const maintain = forAwait(undefined, maintainStarted);

  useEffect(() => {
    const interval = setInterval(() => {
      updateBuckets(maintain?.populatedDIDs.shortDIDs.length);
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [maintain]);

  return (
    <div className='maintain-panel'>
      <div className='maintain-panel-title'>Update DIDs</div>
      {
        !maintain ? 'Loading...' :
          <>
            <div className='current-loading-values'>
              <span className='did-count'>{maintain.populatedDIDs.shortDIDs.length.toLocaleString()} DIDs</span>
              <span className='cursor'> {maintain.populatedDIDs.currentCursor} cursor</span>
            </div>
            <div className='buckets'>
            {
              Object.keys(maintain.populatedDIDs.buckets).map(twoLetter => (
                <div key={twoLetter} className='bucket'>
                  {twoLetter}: {maintain.populatedDIDs.buckets[twoLetter].length.toLocaleString()}
                </div>
              ))
              }
            </div>
            <div className='stats'>
              <span>{maintain.populatedDIDs.requestCount.toLocaleString()} requests</span>
              <span> {maintain.populatedDIDs.requestTime/1000}s</span>
            </div>
          </>
      }
    </div>
  );
}