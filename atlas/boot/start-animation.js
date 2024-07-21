// @ts-check

import { PerspectiveCamera, Vector3, WebGLRenderer } from 'three';
// import { OrbitControls } from 'three/examples/jsm/Addons.js';

/**
 * @typedef {ReturnType<typeof import('../clock').makeClock>} Clock
 */

/**
 * @param {{
 *  clock: Clock,
 *  camera: PerspectiveCamera,
 *  scene: import('three').Scene,
 *  stats?: any,
 *  renderer: WebGLRenderer,
 *  orbit?: import('three/examples/jsm/Addons.js').OrbitControls,
 *  onRedrawLive?: () => void,
 *  onRedrawRare?: () => void
 * }} _
 */
export function startAnimation({ clock, camera, scene, stats, renderer, orbit, onRedrawLive, onRedrawRare }) {

  requestAnimationFrame(continueAnimating);

  function continueAnimating() {
    requestAnimationFrame(continueAnimating);
    renderFrame();
  }

  let lastCameraUpdate;
  /** @type {Vector3} */
  let lastCameraPos;
  let lastRender;
  let lastBottomStatsUpdate;
  let lastVibeCameraPos;
  let lastVibeTime;
  function renderFrame() {
    clock.update();

    // geoLayer.updateWithCamera(camera);

    let rareMoved = false;
    if (!lastCameraPos || !(clock.nowMSec < lastCameraUpdate + 200)) {
      lastCameraUpdate = clock.nowMSec;
      if (!lastCameraPos) lastCameraPos = new Vector3(NaN, NaN, NaN);

      const dist = camera.position.distanceTo(lastCameraPos);

      if (!(dist < 0.0001)) {
        rareMoved = true;
      }
    }

    if (!lastVibeCameraPos) {
      lastVibeCameraPos = camera.position.clone();
      lastVibeTime = clock.nowMSec;
    } else {
      const vibeDist = camera.position.distanceTo(lastVibeCameraPos);
      if (Number.isFinite(vibeDist) && vibeDist > 0.1 && (clock.nowMSec - lastVibeTime) > 200) {
        lastVibeCameraPos.copy(camera.position);
        lastVibeTime = clock.nowMSec;
        try {
          if (typeof navigator.vibrate === 'function') {
            navigator.vibrate(30);
          }
        } catch (bibErr) { }
      }

    }

    stats?.begin();
    const delta = lastRender ? clock.nowMSec - lastRender : 0;
    lastRender = clock.nowMSec;
    // TODO: figure out if this is important?
    /** @type {*} */(orbit)?.controls?.update?.(Math.min(delta / 1000, 0.2));

    // TODO: update whatever missing

    renderer.render(scene, camera);
    stats?.end();

    if (rareMoved) {
      lastCameraPos.copy(camera.position);

      onRedrawRare?.();

      // TODO: update slowly-changing status
      // domElements.status.update(
      //   camera,
      //   orbit.rotating,
      //   firehoseTrackingRenderer.fallback
      // );

      if (window['update-hash']) {
        const updatedHash =
          '#' +
          camera.position.x.toFixed(2) + ',' + camera.position.y.toFixed(2) + ',' + camera.position.z.toFixed(2) +
          '';

        try {
          history.replaceState(null, '', updatedHash);
        } catch (_error) {
        }
      }
    }

    onRedrawLive?.();

    // TODO: update live status in bottom area
    // if (!(clock.nowMSec - lastBottomStatsUpdate < 1000) && domElements.bottomStatusLine) {
    //   lastBottomStatsUpdate = clock.nowMSec;
    //   domElements.bottomStatusLine.update(firehoseTrackingRenderer, geoLayer);
    // }
  }
}