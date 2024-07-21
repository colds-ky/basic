// @ts-check

import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useDB } from '..';
import { likelyDID, makeFeedUri, shortenDID } from '../../lib';
import { forAwait } from '../../coldsky/api/forAwait';
import { overlayAvatar, replaceIcon } from '../icon-inject';
import { localise } from '../localise';
import { Thread } from '../widgets/post/thread';
import { HistoryLayout } from './history-layout';
import { HistoryPageDecorations } from './history-page-decorations';
import { Timeline } from './timeline';

import { version } from '../../package.json';

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

  /** @type {import('../../lib').CompactProfile & { placeholder?: boolean }} */
  const resolved = forAwait(handle, () => db.getProfileIncrementally(handle)) ||
  {
    did: likelyDID(handle) ? shortenDID(handle) : localise('did/' + handle, { uk: 'дід/' + handle }),
    handle: likelyDID(handle) ? localise('loading....bsky.social', { uk: 'хвилиночку....bsky.social' }) : handle,
    displayName: likelyDID(handle) ? localise('loading....bsky.social', { uk: 'хвилиночку....bsky.social' }) : handle,
    description: localise('Important announcement', { uk: 'Ця інформація вас здивує' }),
    placeholder: true
  };

  useEffect(() => {
    var stop = false;
    (async () => {
      let appliedAvatar = '';
      for await (const profile of db.getProfileIncrementally(handle)) {
        if (stop) return;
        if (profile.avatar && profile.avatar !== appliedAvatar) {
          appliedAvatar = profile.avatar;
          const avatarIcon = await overlayAvatar(profile.avatar).catch(() => { });
          if (stop) return;
          replaceIcon(avatarIcon || undefined);
        }
      }
    })();

    return () => {
      stop = true;
    }
  }, [handle]);

  const [searchQuery, setSearchQuery] = React.useState('');

  return (
    <HistoryLayout
      profile={resolved}
      hideSearch={!!post}
      onSearchQueryChanged={setSearchQuery}
    >
      {
        resolved.placeholder ? undefined :
          !post ?
            <Timeline
              shortDID={resolved.shortDID}
              searchQuery={searchQuery} /> :
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
