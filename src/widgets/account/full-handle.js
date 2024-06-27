// @ts-check

import React from 'react';
import { likelyDID, shortenDID, shortenHandle, unwrapShortDID, unwrapShortHandle } from '../../../coldsky/lib';
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
  const { mainText, tldSuffix, bskySocialSuffix, didPrefix, didBody } = breakHandleParts(shortHandle);
  if (didBody) return <FullDID shortDID={shortHandle} Component={Component} {...rest} />;

  return (
    <Component {...rest}>
      <span className='handle-main-text'>
        {mainText}
      </span>
      {
        tldSuffix &&
        <>
          <span className='handle-tld-suffix-dot'>
            {tldSuffix.charAt(0)}
          </span>
          <span className='handle-tld-suffix'>{tldSuffix.slice(1)}</span>
        </>
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

/**
 * @param {string} shortHandle
 * @returns {{
 *  mainText: string,
 *  tldSuffix?: string,
 *  bskySocialSuffix?: string,
 *  didPrefix?: string,
 *  didBody?: string
 * }}
 */
export function breakHandleParts(shortHandle) {
  if (!shortHandle) return { mainText: shortHandle };
  if (likelyDID(shortHandle)) {
    // TODO: break did parts then!
    const fullDID = unwrapShortDID(shortHandle);
    const shortDID = shortenDID(shortHandle);

    let didBody = shortDID;
    let didPrefix = fullDID.slice(0, -shortDID.length);

    return { mainText: shortHandle, didPrefix, didBody };
  };

  const fullHandle = unwrapShortHandle(shortHandle);
  shortHandle = shortenHandle(shortHandle);
  let bskySocialSuffix = shortHandle === fullHandle ? undefined : fullHandle.slice(shortHandle.length);

  let mainText = shortHandle;
  let tldSuffix = undefined;
  if (!bskySocialSuffix) {
    if (shortHandle.endsWith('.bskysoci.al')) {
      mainText = shortHandle.slice(0, -'.bskysoci.al'.length);
      bskySocialSuffix = '.bskysoci.al';
    } else {
      const lastDot = shortHandle.lastIndexOf('.');
      if (lastDot > 0) {
        mainText = shortHandle.slice(0, lastDot);
        tldSuffix = shortHandle.slice(lastDot);
      }
    }
  }

  return {
    mainText,
    tldSuffix,
    bskySocialSuffix
  };
}
