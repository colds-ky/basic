// @ts-check

//import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { makeClock } from '../clock';
import { setupScene } from './setup-scene';
import { startAnimation } from './start-animation';
import { handleWindowResizes } from './handle-window-resizes';
import { createAtlasRenderer } from '../render';
import { firehoseThreads } from '../../api';
import { getGlobalCachedStore } from '../..';

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
    // stats,
    // orbit
  } = setupScene(clock);

  elem.appendChild(renderer.domElement);

  handleWindowResizes(camera, renderer);

  startAnimation({
    camera,
    clock,
    scene,
    //orbit: /** @type {OrbitControls} */(orbit.controls),
    renderer,
    // stats,
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
      point.weight = 1;
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
    // orbit.controls?.update?.(Math.min(delta / 1000, 0.2));

    atlasRenderer.redraw(camera);
  }

  function onRedrawRare() {
  }

  async function* streamFirehoseThreads() {
    /** @type {ThreadWithPosition[]} */
    const threads = [];
    /** @type {{[uri: string]: number}} */
    const threadIndexByUri = {};

    for await (const threadChunk of firehoseThreads(getGlobalCachedStore())) {
      for (const th of threadChunk) {
        const thWithPos = /** @type {ThreadWithPosition} */(th);
        calcPos(thWithPos);

        const uri = th.root.uri;
        if (uri in threadIndexByUri) {
          threads[threadIndexByUri[uri]] = thWithPos;
        } else {
          threadIndexByUri[uri] = threads.length;
          threads.push(thWithPos);
        }
      }

      yield threads;
    }
  }

  // TODO: handle unmountPromise
}

/**
 * @typedef {import('../../../lib').CompactThreadPostSet & {
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
      thread.x += charCode;
    }
    thread.x = thread.x / thread.root.text.length;
  }

  thread.y = thread.all.length / 10;
}