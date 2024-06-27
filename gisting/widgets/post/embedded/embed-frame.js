// @ts-check

import React from 'react';

/**
 * @param {{
 *  className?: string,
 *  children?: import('react').ReactNode
 * }} _
 */
export function EmbedFrame({ className, children, ...rest }) {
  return (
    <div className={'embed-frame-outer ' + (className || '')} {...rest}>
      {children}
      <div className='embed-frame-border'>
      </div>
    </div>
  );
}