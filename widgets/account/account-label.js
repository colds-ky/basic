// @ts-check

import React from 'react';
import { Link } from 'react-router-dom';

import { likelyDID } from '../../package';
import { forAwait } from '../../app-shared/forAwait';
import { useDB } from '../../app';
import { FullHandle } from './full-handle';

import './account-label.css';

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
 *  linkToTimeline?: boolean,
 *  Component?: any
 * }} _
 */
export function AccountLabel({ account, withDisplayName, className, linkToTimeline, Component, ...rest }) {

  const db = useDB();
  const profile = typeof account === 'string' ? forAwait(
    account,
    () =>
      db.getProfileIncrementally(account)) || {
    shortDID: likelyDID(account) ? account : undefined,
    handle: likelyDID(account) ? undefined : account
  } :
    account;
  
  const inner = (
    <>
      <span
        className={profile?.avatar ? 'account-avatar' : 'account-avatar account-avatar-at-sign'}
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
    </>
  );

  if (Component) {

    return (
      <Component className={'account-label ' + (className || '')} {...rest}>
        {
          linkToTimeline ?
            <Link className='account-handle' to={'/' + profile?.handle}>
              {inner}
            </Link> :
            <span className='account-handle'>
              {inner}
            </span>
        }
      </Component>
    );
  } else {
    let aggregateClassName = 'account-handle account-label';
    if (className) aggregateClassName += ' ' + className;
    return (
      linkToTimeline ?
        <Link className={aggregateClassName} to={'/' + profile?.handle}>
          {inner}
        </Link> :
        <span className={aggregateClassName}>
          {inner}
        </span>
    );
  }
}
