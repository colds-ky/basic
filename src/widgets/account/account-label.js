// @ts-check

import React from 'react';
import { FullHandle } from './full-handle';

import { useDB } from '../..';
import { forAwait } from '../../../coldsky/src/api/forAwait';

import './account-label.css';
import { likelyDID } from '../../../coldsky/lib';

/**
 * @param {{
 *  account: {
 *    handle?: string;
 *    displayName?: string;
 *    did?: string;
 *    shortDID?: string;
 *    avatar?: string;
 *  } | string,
 *  withDisplayName?: boolean,
 *  className?: string,
 *  Component?: any
 * }} _
 */
export function AccountLabel({ account, withDisplayName, className, Component, ...rest }) {
  if (!Component) Component = 'span';

  const db = useDB();
  const profile = typeof account === 'string' ? forAwait(
    account,
    () =>
      db.getProfileIncrementally(account)) || {
    shortDID: likelyDID(account) ? account : undefined,
    handle: likelyDID(account) ? undefined : account
  } :
    account;

  return (
    <Component className={'account-label ' + (className || '')} {...rest}>
      <span className='account-handle'>
        <span
          className={profile?.avatar ?'account-avatar' : 'account-avatar account-avatar-at-sign'}
          style={!profile?.avatar ? undefined :
            {
              backgroundImage: `url(${profile?.avatar})`
            }}>@</span>
        <FullHandle shortHandle={profile?.handle} />
        {
          !withDisplayName || !profile?.displayName ? undefined :
            <>
              {' '}<span className='account-label-display-name'>
                {profile?.displayName}
              </span>
            </>
        }
      </span>
    </Component>
  );
}
