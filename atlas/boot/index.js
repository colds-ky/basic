// @ts-check

import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { firehoseThreads } from '../../app-shared';
import { makeClock } from '../clock';
import { createAtlasRenderer } from '../render';
import { handleWindowResizes } from './handle-window-resizes';
import { setupScene } from './setup-scene';
import { startAnimation } from './start-animation';
import { getGlobalCachedStore } from '../../app';

/**
 * @param {HTMLDivElement} elem
 * @param {Promise<void>} unmountPromise
 */
export function boot(elem, unmountPromise) {
  const clock = makeClock();

  let lastRender = clock.nowMSec;

  const {
    scene,
    camera,
    lights,
    renderer,
    stats,
    orbit
  } = setupScene(clock);

  elem.appendChild(renderer.domElement);

  handleWindowResizes(camera, renderer);

  startAnimation({
    camera,
    clock,
    scene,
    orbit: /** @type {OrbitControls} */(orbit.controls),
    renderer,
    stats,
    onRedrawLive,
    onRedrawRare
  });

  const atlasRenderer = createAtlasRenderer({
    clock,
    nodesLive: streamFirehoseThreads(),
    getKey: (thread) => thread.root.uri,
    getPoint: (thread, point) => {
      point.x = thread.x;
      point.y = thread.y;
      point.h = 0;
      point.weight = thread.all.length / 2000;
    },
    getLabel: (thread) => (thread.root.text || '').slice(0, 10),
    getDescription: (thread) => thread.root.text || '',
    getColor: () => 0xFFFFFFFF,
    getFlashTime: () => { }
  });

  scene.add(atlasRenderer.mesh);

  function onRedrawLive() {
    const delta = lastRender ? clock.nowMSec - lastRender : 0;
    lastRender = clock.nowMSec;
    orbit.controls?.update?.(Math.min(delta / 1000, 0.2));

    atlasRenderer.redraw(camera);
  }

  function onRedrawRare() {
  }

  async function* streamAccountPositions() {
    /** @type {AccountPosition[]} */
    let accountPositions = [];
    /** @type {{[uri: string]: number}} */
    const accountIndexByShortDID = {};

    let lastInject = Date.now();

    for await (const block of getGlobalCachedStore().firehose()) {
      for (const msg of block.messages) {
        switch (msg.$type) {
          case 'app.bsky.actor.profile':
            
        }
      }

      if (Date.now() - lastInject > 400) {
        for (const th of newThreads) {
          accounts = accounts.slice();
          const thWithPos = /** @type {ThreadWithPosition} */(th);
          calcPos(thWithPos);

          const uri = th.root.uri;
          if (uri in threadIndexByUri) {
            accounts[threadIndexByUri[uri]] = thWithPos;
          } else {
            threadIndexByUri[uri] = accounts.length;
            accounts.push(thWithPos);
          }
        }

        lastInject = Date.now();

        console.log('threads: ', accounts);
        yield accounts;
      }
    }
  }

  // TODO: handle unmountPromise

/**
 * @typedef {import('../../package').CompactThreadPostSet & {
 *  x: number,
 *  y: number
 * }} ThreadWithPosition
 */

  /**
   * @param {ThreadWithPosition} thread
   */
  function calcPos(thread) {
    thread.x = 0;
    thread.y = 0;

    if (thread.root.text?.length) {
      for (let i = 0; i < thread.root.text.length; i++) {
        const charCode = thread.root.text.charCodeAt(i);
        thread.x += 1 / charCode;
        thread.x = Math.pow(10, thread.x);
        thread.x = thread.x - Math.floor(thread.x);
      }
      thread.x = thread.x - 0.5;
    }

    for (let i = 0; i < thread.root.uri.length; i++) {
      const charCode = thread.root.uri.charCodeAt(i);
      thread.y += 1 / charCode;
      thread.y = Math.pow(10, thread.y);
      thread.y = thread.y - Math.floor(thread.y);
    }
    thread.y = thread.y - 0.5;

  }
}

/**
 * @typedef {{
 *  account: AccountInfo;
 *  index: number;
 *  x: number;
 *  y: number;
 *  socialWeight: number;
 * }} AccountPosition
 */
