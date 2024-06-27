// @ts-check

import React from 'react';
import { likelyDID, shortenHandle, unwrapShortHandle } from '../../../coldsky/lib';
import { FullDID } from './full-did';

import './full-handle.css';

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
  const bskySocialSuffix = shortHandle === fullHandle ? undefined : fullHandle.slice(shortHandle.length);

  let mainText = shortHandle;
  let tldSuffix = undefined;
  if (!bskySocialSuffix) {
    const lastDot = shortHandle.lastIndexOf('.');
    if (lastDot > 0) {
      mainText = shortHandle.slice(0, lastDot);
      tldSuffix = shortHandle.slice(lastDot);
    }
  }

  return (
    <Component {...rest}>
      <span className='handle-main-text'>
        {mainText}
      </span>
      {
        tldSuffix &&
        <span className='handle-tld-suffix'>{tldSuffix}</span>
      }
      {
        bskySocialSuffix &&
        <>
        <span className='handle-bsky-social-suffix-dot'>
            {bskySocialSuffix.charAt(0)}
          </span>
          <span className='handle-bsky-social-suffix'>{bskySocialSuffix.slice(1)}</span>
        </>
      }
    </Component>
  );
}
