// @ts-check

import React from 'react';
import { likelyDID, shortenHandle, unwrapShortHandle } from '../../../coldsky/lib';
import { FullDID } from './full-did';

/**
 * @param {{
 *  shortHandle: string | null | undefined,
 *  Component?: any,
 *  className?: string
 * }} _
 */
export function FullHandle({ shortHandle, Component, ...rest }) {
  if (!shortHandle) return undefined;
  if (!Component) Component = 'span';
  if (likelyDID(shortHandle)) return <FullDID shortDID={shortHandle} Component={Component} {...rest} />;
  const fullHandle = unwrapShortHandle(shortHandle);
  shortHandle = shortenHandle(shortHandle);
  if (shortHandle === fullHandle) return <span {...rest}>{shortHandle}</span>;
  else return (
    <Component {...rest}>
      {shortHandle}
      <span className='handle-bsky-social-suffix'>{fullHandle.slice(shortHandle.length)}</span>
    </Component>);
}
