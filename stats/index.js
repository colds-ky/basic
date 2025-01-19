// @ts-check

import React, { Fragment, useEffect, useState } from 'react';
import { streamStats } from './stream-stats';
import { useDB } from '../app';
import { Button } from '@mui/material';
import { version } from '../package';

/** @typedef {ReturnType<typeof streamStats>} StreamStatsIterable */

export function StatsComponent() {
  const db = useDB();
  const [running, setRunning] = useState(false);
  let [run, setRun] = useState(/** @type {[StreamStatsIterable] | undefined} */(undefined));
  const [stats, setStats] = useState(/** @type {*} */(undefined));
  useEffect(() => {
    if (!running) return;
    let stop = false;
    iterate();
    return () => {
      stop = true;
    };

    async function iterate() {
      if (!run) {
        run = [streamStats(db)];
        setRun(run);
      }

      for await (const statsData of run[0]()) {
        if (stop) return;
        setStats(statsData);
      }
    }
  }, [running]);

  const jsonLines = stats ? JSON.stringify({
    ...stats,
    version
  }, null, 2).split('\n') : [''];

  return (
    <div className='stats'>
      <h1>Stats</h1>
      <Button
        variant='contained'
        onClick={() => setRunning(!running)}>
        {running ? 'Pause' : 'Run stats on firehose'}
      </Button>
      <pre>
        {
          jsonLines.map((line, i) => (
            <Fragment key={i}>
              {
                line.split(':').map((part, i) => (
                  <Fragment key={i}>
                    {i ? ':' : ''}{part}
                  </Fragment>
                ))
              }<br /></Fragment>
          ))
        }
      </pre>
    </div>
  );
}
