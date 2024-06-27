// @ts-check

import React, { useEffect } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import { unwrapShortHandle } from '../../coldsky/lib';
import { forAwait } from '../../coldsky/src/api/forAwait';
import { resolveProfileViaRequest, resolveHandleOrDIDToProfile } from '../api/record-cache';
import { localise } from '../localise';
import { FullHandle } from '../widgets/account/full-handle';

import './history.css';

export function History() {
  useEffect(() => {
    document.documentElement.classList.add('account');
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

      <div className='history-account-banner-stripe-below'>
      </div>

      <div
        className={suffixClassWhenEmpty('history-account-avatar', resolved.avatar)}
        style={!resolved.avatar ? undefined : { backgroundImage: `url(${resolved.avatar})` }}>
      </div>

      <div className='history-account-handle'>
        <FullHandle shortHandle={resolved.handle} />
      </div>

      <div className={suffixClassWhenEmpty('history-account-displayName', resolved.displayName)}>
        {resolved.displayName}
      </div>

      <div className={suffixClassWhenEmpty('history-account-description', resolved.description)}>
        {resolved.description}
      </div>

    </div>
  );
}

function suffixClassWhenEmpty(className, value) {
  return value ? className : className + ' ' + className + '-empty';
}
