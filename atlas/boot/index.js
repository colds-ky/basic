// @ts-check

import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { firehoseThreads } from '../../app-shared';
import { makeClock } from '../clock';
import { createAtlasRenderer } from '../render';
import { handleWindowResizes } from './handle-window-resizes';
import { setupScene } from './setup-scene';
import { startAnimation } from './start-animation';
import { DB_NAME, getGlobalCachedStore, useDB } from '../../app';
import { defineCachedStore } from '../../package';

/**
 * @param {HTMLDivElement} elem
 * @param {Promise<void>} unmountPromise
 */
export function boot(elem, unmountPromise) {
  const clock = makeClock();
  const db = defineCachedStore({ dbName: DB_NAME })

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
    nodesLive: streamAccountPositions(),
    getKey: (profile) => profile,
    getPoint: (profile, point) => {
      point.x = profile.x;
      point.y = profile.y;
      point.h = 0;
      point.weight = profile.socialWeight / 2000;
    },
    getLabel: (profile) => (profile.handle || profile.shortDID).slice(0, 10),
    getDescription: (profile) => profile.displayName || '',
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
    /** @type {ProfilePosition[]} */
    const profilePositions = [];
    /** @type {{[uri: string]: number}} */
    const profileIndexByShortDID = {};

    let lastInject = Date.now();

    for await (const chunk of firehoseThreads(db)) {
      /** @type {typeof chunk} */
      const distinctThreads = [];
      const distinctNewShortDIDs = [];
      for (const th of chunk) {
        let matchExisting = false;
        for (let i = 0; i < distinctThreads.length; i++) {
          if (distinctThreads[i].root.uri === th.root.uri) {
            distinctThreads[i] = th;
            matchExisting = true;
            break;
          }
        }
        if (!matchExisting) distinctThreads.push(th);

        matchExisting = false;
        for (let i = 0; i < distinctNewShortDIDs.length; i++) {
          if (distinctNewShortDIDs[i] === th.root.shortDID) {
            distinctNewShortDIDs[i] = th.root.shortDID;
            matchExisting = true;
            break;
          }
        }

        if (!matchExisting) distinctNewShortDIDs.push(th.root.shortDID);
      }

      const retrieveProfiles = [];
      for (const th of distinctThreads) {
        const thWithPos = /** @type {ThreadWithPosition} */(th);
        calcPos(thWithPos);

        if (!profileIndexByShortDID[th.root.shortDID])
          retrieveProfiles.push((async () => {
            try {
              for await (const profile of db.getProfileIncrementally(th.root.shortDID)) {
                if (!profileIndexByShortDID[profile.shortDID]) {
                  const index = profilePositions.length;
                  profilePositions.push({
                    ...profile,
                    index,
                    socialWeight: (profile.followersCount || 1) * 20,
                    x: thWithPos.x,
                    y: thWithPos.y
                  });
                  profileIndexByShortDID[profile.shortDID] = index;
                }
              }
            } catch (profileError) {
            }
          })());
      }

      await Promise.all(retrieveProfiles);

      lastInject = Date.now();

      console.log('threads: ', profilePositions);
      yield profilePositions;
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
 * @typedef {import('../../package').CompactProfile & {
 *  index: number;
 *  x: number;
 *  y: number;
 *  socialWeight: number;
 * }} ProfilePosition
 */
