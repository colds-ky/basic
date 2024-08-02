// @ts-check

import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useDB } from '../app';
import { forAwait } from '../app-shared/forAwait';
import { setGlobalAppView } from '../app-shared/icon-inject';
import { localise } from '../app-shared/localise';
import { likelyDID, makeFeedUri, plcDirectoryHistoryCompact, plcDirectoryHistoryRaw, shortenDID, unwrapShortPDS } from '../package';
import { downloadCAR } from '../package/data/cached-store/sync-repo';
import { Thread } from '../widgets/post/thread';
import { HistoryLayout } from './history-layout';
import { HistoryPageDecorations } from './history-page-decorations';
import { Timeline } from './timeline';

import { version } from '../package.json';

import './history.css';

export function History() {
  return (
    <HistoryPageDecorations>
      <HistoryCore />
    </HistoryPageDecorations>
  );
}

function HistoryCore() {

  const db = useDB();
  let { handle, post } = useParams();

  /** @type {import('../package').CompactProfile & { placeholder?: boolean }} */
  const resolved = forAwait(handle, () => db.getProfileIncrementally(handle)) ||
  {
    did: likelyDID(handle) ? shortenDID(handle) : localise('did/' + handle, { uk: 'дід/' + handle }),
    handle: likelyDID(handle) ? localise('loading....bsky.social', { uk: 'хвилиночку....bsky.social' }) : handle,
    displayName: likelyDID(handle) ? localise('loading....bsky.social', { uk: 'хвилиночку....bsky.social' }) : handle,
    description: localise('Important announcement', { uk: 'Ця інформація вас здивує' }),
    placeholder: true
  };

  setGlobalAppView(handle ? { account: handle } : undefined);

  const [searchQuery, setSearchQuery] = React.useState('');

  const searchQueryStartsWithSlash = (searchQuery || '').trim().startsWith('/');

  return (
    <HistoryLayout
      profile={resolved}
      hideSearch={!!post}
      onSearchQueryChanged={setSearchQuery}
      onSlashCommand={command => {
        if (/^\/download?$/i.test(command)) {
          downloadCARAndShow(handle || '', db);
        }
      }}
    >
      {
        resolved.placeholder ? undefined :
          !post ?
            <Timeline
              shortDID={resolved.shortDID}
              searchQuery={searchQueryStartsWithSlash ? '' : searchQuery} /> :
            <Thread
              uri={makeFeedUri(resolved.shortDID, post)}
              significantPost={post => post.shortDID === resolved.shortDID}
              linkAuthor
              linkTimestamp
            />
      }
      <div className='history-footer'>
        v{version}
      </div>
    </HistoryLayout>
  );
}

/**
 * @param {string} handleOrDID
 * @param {import('../app').DBAccess} db
 */
async function downloadCARAndShow(handleOrDID, db) {
  /** @type {string} */
  let handle = handleOrDID;
  /** @type {string} */
  let shortDID = '';

  for await (const profile of db.getProfileIncrementally(handleOrDID)) {
    if (profile.handle) handle = profile.handle;
    shortDID = profile.shortDID;
    if (shortDID) break;
  }

  const pds = unwrapShortPDS ((await plcDirectoryHistoryCompact(shortDID)).reverse().map(entry => entry.shortPDC)[0]);

  const repoData = await downloadCAR({ shortDID, pds });

  const link = document.createElement('a');
  link.download = handle.replace(/[^a-z0-9\.]+/ig, ' ').trim().replace(/\s/g, '-') + '.car';
  link.href = URL.createObjectURL(new Blob([repoData], { type: 'application/octet-stream' }));
  document.body.appendChild(link);
  link.click();
}
