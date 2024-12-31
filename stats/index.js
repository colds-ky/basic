// @ts-check

import React from 'react';
import { forAwait } from '../app-shared/forAwait';
import { streamStats } from './stream-stats';
import { useDB } from '../app';

export function StatsComponent() {
  const db = useDB();
  const stats = forAwait('', streamStats(db));

  return (
    <div className='stats'>
      <h1>Stats</h1>
      <pre>
        {
          JSON.stringify(stats, null, 2)
        }
      </pre>
    </div>
  );
}