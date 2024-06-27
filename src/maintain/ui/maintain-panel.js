// @ts-check

import React, { useEffect, useState } from 'react';
import { updateDIDs } from '../updateDIDs';
import { createShellAPIs } from './shell-api';
import { forAwait } from '../../api/forAwait';

import './maintain-panel.css';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';

/** @type {ReturnType<typeof updateDIDs> | undefined} */
let maintainStarted;

export function MaintainPanel() {
  if (!maintainStarted) {
    const apis = createShellAPIs();
    maintainStarted = updateDIDs(apis).catch(error => alert(error.stack || error.message));
  }

  const [_, updateBuckets] = useState(0);

  const maintain = forAwait(undefined, maintainStarted);

  useEffect(() => {
    window.addEventListener('error', showError);
    const interval = setInterval(() => {
      updateBuckets(maintain?.populatedDIDs.shortDIDs.length);
    }, 500);

    return () => {
      clearInterval(interval);
      window.removeEventListener('error', showError);
    };

    function showError(error) {
      if (error.error) error = error.error;
      alert(error.stack || error.message);
    }
  }, [maintain]);

  const buckets = maintain?.populatedDIDs.buckets ?
    Object.entries(maintain.populatedDIDs.buckets)
      .map(([twoLetter, bucket]) => /** @type {const} */([twoLetter, bucket.length]))
      .sort((a, b) => b[1] - a[1]):
    [];

  const leadBuckets = buckets.slice(0, 20);
  const trailBuckets = leadBuckets.length === buckets.length ? [] :
    buckets.slice(-5);

  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authToken, setAuthToken] = useState('');

  const [applyData, setApplyData] = useState(
    /** @type {undefined | Awaited<ReturnType<typeof maintain.verifyGitHubAuth>>} */
    (undefined)
  );

  //const [error, setError] = useState();

  return (
    <div className='maintain-panel'>
      <div className='maintain-panel-title'>
        Update DIDs
        <Button className='apply-button' variant='contained'
          onClick={() => {
            if (!authToken) {
              setAuthDialogOpen(true);
              return;
            }

            startApplying().catch(error => alert(error.stack || error.message));
          }}>
          <span>
            {
              !authToken ? 'Enter AUTH TOKEN' :
                applyData ? 'Start applying ' +
                  applyData.bucketData.length + ' buckets':
                  'Prepare changes for AUTH TOKEN'
            }
          </span>
        </Button>
        <Dialog open={authDialogOpen} onClose={() => {
          setAuthToken('');
          setAuthDialogOpen(false);
        }}>
          <DialogTitle>AUTH TOKEN</DialogTitle>
          <DialogContent>
            <DialogContentText>
              AUTH TOKEN is required to apply the changes to GitHub repo.
              The token will be stored in your browser's local storage.
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              id="name"
              label="AUTH TOKEN"
              type="text"
              fullWidth
              variant="standard"
              value={authToken}
              onChange={e => setAuthToken(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setAuthDialogOpen(false);
            }}>Apply</Button>
            <Button onClick={() => {
              setAuthToken('');
              setAuthDialogOpen(false);
            }}>Cancel</Button>
          </DialogActions>
        </Dialog>
      </div>
      {
        !maintain ? 'Loading...' :
          <>
            <div className='current-loading-values'>
              <span className='did-count'>{maintain.populatedDIDs.shortDIDs.length.toLocaleString()} DIDs</span>
              <span className='cursor'> {maintain.populatedDIDs.currentCursor} cursor</span>
            </div>
            <div className='buckets'>
              {
                leadBuckets.map(
                  ([twoLetter, count], index) =>
                    <div key={index} className='bucket'>
                      <span className='two-letter'>{twoLetter}</span>{' '}
                      <span className='count'>{count.toLocaleString()}</span>
                    </div>
                )
              }
              {
                !trailBuckets.length ? undefined :
                  <>
                    ...
                    {
                      trailBuckets.map(
                        ([twoLetter, count], index) =>
                          <div key={index} className='bucket'>
                            <span className='two-letter'>{twoLetter}</span>{' '}
                            <span className='count'>{count.toLocaleString()}</span>
                          </div>
                      )
                    }
                    <div>
                      Total {buckets.length.toLocaleString()} keys.
                    </div>
                  </>
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

  async function startApplying() {
    const applyData = await maintain.verifyGitHubAuth(authToken);
    setApplyData(applyData);
  }
}