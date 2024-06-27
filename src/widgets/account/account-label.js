// @ts-check

import React from 'react';
import { FullHandle } from './full-handle';

import './account-label.css';

/**
 * @param {{
 *  account: {
 *    handle?: string;
 *    shortHandle?: string;
 *    displayName?: string;
 *    did?: string;
 *    shortDID?: string;
 *    avatar?: string;
 *  },
 *  withDisplayName?: boolean,
 *  className?: string,
 *  Component?: any
 * }} _
 */
export function AccountLabel({ account, withDisplayName, className, Component, ...rest }) {
  if (!Component) Component = 'span';
  return (
    <Component className={'account-label ' + (className || '')} {...rest}>
      <span className='account-handle'>
        <span
          className='account-avatar'
          style={!account.avatar ? undefined :
            {
              backgroundImage: `url(${account.avatar})`
            }}>@</span>
        <FullHandle shortHandle={account.shortHandle || account.handle} />
        {
          !withDisplayName || !account.displayName ? undefined :
            <>
              {' '}<span className='account-short-entry-display-name'>
                {account.displayName}
              </span>
            </>
        }
      </span>
    </Component>
  );
}