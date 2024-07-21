// @ts-check

import React, { useEffect, useState } from 'react';
import { boot } from './boot';

export function AtlasComponent() {
  const [{ unmountPromise, resolveUnmountPromise }] = useState(() => {
    let resolveUnmountPromise = () => { };
    /** @type {Promise<void>} */
    const unmountPromise = new Promise((resolve) => {
      resolveUnmountPromise = resolve;
    });
    return { unmountPromise, resolveUnmountPromise };
  });

  useEffect(() => {
    return () => {
      resolveUnmountPromise();
    };
  }, []);
  return (
    <div ref={elem => {
      if (elem) {
        initAtlas(elem, unmountPromise);
      }

    }}>
    </div>
  );

}

/**
 * @param {HTMLDivElement} elem
 * @param {Promise<void>} unmountPromise
 */
function initAtlas(elem, unmountPromise) {
  elem.style.cssText = `
  position: fixed;
  left: 0; top: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.9);
  `;

  boot(elem, unmountPromise);
}
