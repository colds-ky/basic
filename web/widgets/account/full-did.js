// @ts-check

import React from 'react';
import { shortenDID, unwrapShortDID } from '../../../lib';

/**
 * @param {{
 *  shortDID: string | null | undefined,
 *  Component?: any,
 *  className?: string
 * }} _
 */
export function FullDID({ shortDID, Component, ...rest }) {
  if (!shortDID) return undefined;
  if (!Component) Component = 'span';
  const fullDID = unwrapShortDID(shortDID);
  const shortDIDNormalized = shortenDID(fullDID);
  if (shortDIDNormalized === fullDID) return <Component {...rest}>{fullDID}</Component>;
  else return (
    <Component {...rest}>
      <span className='did-plc-prefix'>{fullDID.slice(0, -shortDIDNormalized.length)}</span>
      {shortDID}
    </Component>
  );
}
