// @ts-check

import React, { useEffect } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import { unwrapShortHandle } from '../../coldsky/lib';
import { forAwait } from '../../coldsky/src/api/forAwait';
import { resolveHandleOrDIDToProfile, resolveProfileViaRequest } from '../api/record-cache';
import { uppercase_GIST } from '../landing/landing';
import { localise } from '../localise';
import { FullHandle, breakHandleParts } from '../widgets/account/full-handle';

import './history.css';
import { applyModifier } from '../api/unicode-styles/apply-modifier';
import { Timeline } from './timeline';

const middledot = '\u00B7';

export function History() {
  let { handle } = useParams();

  useEffect(() => {
    document.documentElement.classList.add('account');

    if (!handle) {
      document.title = uppercase_GIST;
    } else {
      const { mainText, tldSuffix, bskySocialSuffix, didPrefix, didBody } = breakHandleParts(handle);

      let title;
      if (didBody) {
        title = applyModifier(didPrefix || '', 'typewriter') + applyModifier(didBody, 'bold');
      } else {
        title =
          applyModifier(mainText.replace(/\./g, middledot), 'boldcursive') +
          (
          tldSuffix ? applyModifier(
            tldSuffix.replace(/^\./, ' ' + middledot + ' ').replace(/\./g, middledot),
            'cursive') : ''
          ) +
          (
          bskySocialSuffix ? applyModifier(
            bskySocialSuffix.replace(/^\./, ' ' + middledot + ' ').replace(/\./g, middledot),
            'super') : ''
          );
      }

      document.title = title;
    }
  });

  return (
    <HistoryCore />
  );
}

function HistoryCore() {

  let { handle } = useParams();

  const resolved = forAwait(
    handle,
    () => resolveHandleOrDIDToProfile(handle)) || {
    did: 'did:plc:1234567890',
    handle: localise('loading....bsky.social', { uk: 'хвилиночку....bsky.social' }),
    displayName: localise('Just a moment', { uk: 'Зачекайте, зара буде' }),
    description: localise('Important announcement', { uk: 'Ця інформація вас здивує' }),
    placeholder: true
  };

  console.log('profile ', resolved);


  return (
    <div className='history-view'>

      <div
        className={suffixClassWhenEmpty('history-account-banner-bg', resolved.banner)}
        style={!resolved.banner ? undefined : { backgroundImage: `url(${resolved.banner})` }}>
      </div>

      <div
        className={suffixClassWhenEmpty('history-account-avatar', resolved.avatar)}
        style={!resolved.avatar ? undefined : { backgroundImage: `url(${resolved.avatar})` }}>
      </div>


      <div className={suffixClassWhenEmpty('history-account-displayName-and-handle', resolved.displayName)}>
        <span className='history-account-displayName'>
          {resolved.displayName}
        </span>

        <div className='history-account-handle'>
          <span className='at-sign'>@</span><FullHandle shortHandle={resolved.handle} />
        </div>
      </div>

      <div className='unmoved-sticky-background'></div>

      <div className={suffixClassWhenEmpty('history-account-description', resolved.description)}>
        {resolved.description}
      </div>

      <div className='timeline-container'>
        {
          <Timeline shortDID={handle} />
        }
      </div>

    </div>
  );
}

function suffixClassWhenEmpty(className, value) {
  return value ? className : className + ' ' + className + '-empty';
}
