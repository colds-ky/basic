// @ts-check

import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { forAwait } from '../../coldsky/src/api/forAwait';
import { localise } from '../localise';
import { FullHandle } from '../widgets/account/full-handle';

import { Timeline } from './timeline';
import { overlayAvatar, replaceIcon } from '../icon-inject';
import { useDB } from '..';

import './history.css';
import { PreFormatted } from '../widgets/preformatted';
import { HistoryPageDecorations } from './history-page-decorations';
import { breakFeedUri, likelyDID, makeFeedUri, shortenDID } from '../../coldsky/lib';
import { Thread, ThreadView } from '../widgets/post/thread';

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

  /** @type {import('../../coldsky/lib').CompactProfile & { placeholder?: boolean }} */
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

  console.log('profile ', resolved, resolved.banner);

  return (
    <div className='history-view'>

      <div
        className={suffixClassWhenEmpty('history-account-banner-bg', resolved.banner, resolved)}
        style={!resolved.banner ? undefined : { backgroundImage: `url(${resolved.banner})` }}>
      </div>

      <div
        className='history-account-avatar-bg' />
      <div
        className={suffixClassWhenEmpty('history-account-avatar', resolved.avatar, resolved)}
        style={!resolved.avatar ? undefined : { backgroundImage: `url(${resolved.avatar})` }}>
      </div>


      <div className={suffixClassWhenEmpty('history-account-displayName-and-handle', resolved.displayName, resolved)}>
        <span className={suffixClassWhenEmpty('history-account-displayName', resolved.displayName, resolved)}>
          {resolved.displayName}
        </span>

        <div className='history-account-handle'>
          <span className='at-sign'>@</span><FullHandle shortHandle={resolved.handle} />
        </div>
      </div>

      <div className='sticky-header-background'></div>
      <div className='sticky-header-background-cover'></div>

      <PreFormatted
      text={resolved.description}
      className={suffixClassWhenEmpty('history-account-description', resolved.description, resolved)} />

      <div className='timeline-container'>
        {
          resolved.placeholder ? undefined :
            !post ? <Timeline shortDID={resolved.shortDID} /> :
              <Thread
                uri={makeFeedUri(resolved.shortDID, post)}
                linkAuthor
                linkTimestamp
              />
        }
      </div>

    </div>
  );
}

/**
 * @param {string} className
 * @param {any} value
 * @param {{ placeholder?: boolean } | undefined} hasPlaceholder
 */
function suffixClassWhenEmpty(className, value, hasPlaceholder) {
  const withEmpty = value ? className : className + ' ' + className + '-empty';
  return hasPlaceholder?.placeholder ? withEmpty + ' ' + className + '-placeholder' : withEmpty;
}
