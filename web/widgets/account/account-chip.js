// @ts-check

import React from 'react';

import { useDB } from '../..';
import { forAwait } from '../../../coldsky/api/forAwait';

import './account-chip.css';

/**
 * @param {{
 *  account: {
 *    did?: string;
 *    shortDID?: string;
 *    avatar?: string;
 *  } | string,
 *  className?: string,
 *  Component?: any
 * }} _
 */
export function AccountChip({ account, className, Component, ...rest }) {
  if (!Component) Component = 'span';

  const db = useDB();
  const profile = typeof account === 'string' ? forAwait(
    account,
    () =>
      db.getProfileIncrementally(account)) ||
  {
    shortDID: account,
    handle: account
  } :
    account;

  return (
    <Component
      className={'account-avatar account-avatar-chip ' + (className || '')}
      {...rest} style={!profile.avatar ? undefined :
        {
          backgroundImage: `url(${profile.avatar})`
        }}>@</Component>
  );

}
