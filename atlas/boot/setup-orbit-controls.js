// @ts-check

import { PerspectiveCamera, Vector3 } from 'three';
import { MapControls, OrbitControls } from 'three/examples/jsm/Addons.js';
import { dampenPhase, distance2D } from '../coords';

/**
 * @param {{
 *  camera: PerspectiveCamera,
 *  host: HTMLElement,
 *  clock: ReturnType<typeof import('../clock').makeClock>
 * }} _
 */
export function setupOrbitControls({ camera, host, clock }) {
  const STEADY_ROTATION_SPEED = 0.2;

  let usedControlType = OrbitControls;
  const possibleControlTypes = [OrbitControls, MapControls];

  let controls = initControls(usedControlType);

  const outcome = {
    controls,
    rotating: !!controls.autoRotate,
    pauseRotation,
    waitAndResumeRotation,
    moveAndPauseRotation,
    flipControlType
  };

  return outcome;

  var changingRotationInterval;

  /**
   * @param {{
   *  new (camera: PerspectiveCamera, host: HTMLElement): {
   *    target: Vector3;
   *    addEventListener(event: 'start' | 'end', callback: Function);
   *    maxDistance: number;
   *    enableDamping: boolean;
   *    autoRotate: boolean;
   *    autoRotateSpeed: number;
   *    zoomToCursor?: boolean;
   *    listenToKeyEvents(element: { addEventListener: Function });
   *    saveState(): void;
   *    reset(): void;
   *    dispose(): void;
   *    update(deltaTime?: number): void;
   *  } }} OrbitControls 
   * @returns 
   */
  function initControls(OrbitControls) {
    let controls = new OrbitControls(camera, host);
    controls.zoomToCursor = true;
    controls.addEventListener('start', function () {
      pauseRotation();
    });

    // restart autorotate after the last interaction & an idle time has passed
    controls.addEventListener('end', function () {
      waitAndResumeRotation();
    });

    controls.maxDistance = 40 * 1000;
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = STEADY_ROTATION_SPEED;
    controls.listenToKeyEvents(createKeyEventProxy(window));
    waitAndResumeRotation();
    return controls;


    /** @param {HTMLElement | Window} originalElement */
    function createKeyEventProxy(originalElement) {
      const keydownCallbacks = [];
      return {
        addEventListener: overrideAddEventListener,
        removeEventListener: overrideRemoveEventListener,
      };

      /** @param {Event} event */
      function handleKeydown(event) {
        const target = /** @type {HTMLElement} */(event.target);
        if (/input/i.test(target?.tagName)) return;
        let result;
        for (const callback of keydownCallbacks) {
          result = callback(event);
        }
        return result;
      }

      function overrideAddEventListener(event, callback) {
        if (event === 'keydown') {
          if (keydownCallbacks.length === 0)
            originalElement.addEventListener('keydown', handleKeydown);
          keydownCallbacks.push(callback);
        } else {
          host.addEventListener(event, callback);
        }
      }

      function overrideRemoveEventListener(event, callback) {
        if (event === 'keydown') {
          keydownCallbacks.splice(keydownCallbacks.indexOf(callback), 1);
          if (keydownCallbacks.length === 0)
            originalElement.removeEventListener('keydown', handleKeydown);
        } else {
          host.removeEventListener(event, callback);
        }
      }

    }
  }

  function flipControlType() {
    controls.saveState();
    const state = {};
    for (const key in controls) {
      if (key.charAt(key.length - 1) === '0') {
        state[key] = controls[key];
      }
    }
    controls.dispose();
    const nextControlType = possibleControlTypes[(possibleControlTypes.indexOf(usedControlType) + 1) % possibleControlTypes.length];
    controls = initControls(nextControlType);
    outcome.rotating = controls.autoRotate;
    for (const key in state) {
      controls[key] = state[key];
    }
    controls.reset();
  }

  function pauseRotation() {
    if (controls.autoRotate) controls.autoRotate = false;

    outcome.rotating = false;
    clearInterval(changingRotationInterval);
  }

  function waitAndResumeRotation(resumeAfterWait) {
    const WAIT_BEFORE_RESUMING_MSEC = 10000;
    const SPEED_UP_WITHIN_MSEC = 10000;

    if (!resumeAfterWait) resumeAfterWait = WAIT_BEFORE_RESUMING_MSEC;

    clearInterval(changingRotationInterval);
    const startResumingRotation = clock.nowMSec;
    changingRotationInterval = setInterval(continueResumingRotation, 100);

    function continueResumingRotation() {
      const passedTime = clock.nowMSec - startResumingRotation;
      if (passedTime < resumeAfterWait) return;
      if (passedTime > resumeAfterWait + SPEED_UP_WITHIN_MSEC) {
        controls.autoRotateSpeed = STEADY_ROTATION_SPEED;
        controls.autoRotate = true;
        outcome.rotating = true;
        clearInterval(changingRotationInterval);
        return;
      }

      const phase = (passedTime - resumeAfterWait) / SPEED_UP_WITHIN_MSEC;
      controls.autoRotate = true;
      outcome.rotating = true;
      controls.autoRotateSpeed = 0.2 * dampenPhase(phase);
    }
  }

  /**
   * @param {{x: number, y: number, h: number }} xyh
   * @param {{x: number, y: number, h: number }} towardsXYH
   */
  function moveAndPauseRotation(xyh, towardsXYH) {
    const MOVE_WITHIN_MSEC = 6000;
    const WAIT_AFTER_MOVEMENT_BEFORE_RESUMING_ROTATION_MSEC = 30000;
    const MIDDLE_AT_PHASE = 0.6;
    const RAISE_MIDDLE_WITH = 0.25;

    pauseRotation();
    const startMoving = clock.nowMSec;
    const startCameraPosition = camera.position.clone();
    const startCameraTarget = controls.target.clone();

    const r = distance2D(xyh.x, xyh.y, 0, 0);
    const angle = Math.atan2(xyh.y, xyh.x);
    const xMiddle = (r + 0.6) * Math.cos(angle);
    const yMiddle = (r + 0.6) * Math.sin(angle);
    const hMiddle = xyh.h + RAISE_MIDDLE_WITH;

    changingRotationInterval = setInterval(continueMoving, 10);

    function continueMoving() {

      const passedTime = clock.nowMSec - startMoving;
      if (passedTime > MOVE_WITHIN_MSEC) {
        clearInterval(changingRotationInterval);
        camera.position.set(xyh.x, xyh.h, xyh.y);
        controls.target.set(towardsXYH.x, towardsXYH.h, towardsXYH.y);
        waitAndResumeRotation(WAIT_AFTER_MOVEMENT_BEFORE_RESUMING_ROTATION_MSEC);
        return;
      }

      const phase = passedTime / MOVE_WITHIN_MSEC;
      controls.target.set(
        startCameraTarget.x + (towardsXYH.x - startCameraTarget.x) * phase,
        startCameraTarget.y + (towardsXYH.h - startCameraTarget.y) * phase,
        startCameraTarget.z + (towardsXYH.y - startCameraTarget.z) * phase);

      if (passedTime < MOVE_WITHIN_MSEC * MIDDLE_AT_PHASE) {
        const dampenedPhase = dampenPhase(phase / MIDDLE_AT_PHASE);
        camera.position.set(
          startCameraPosition.x + (xMiddle - startCameraPosition.x) * dampenedPhase,
          startCameraPosition.y + (hMiddle - startCameraPosition.y) * dampenedPhase,
          startCameraPosition.z + (yMiddle - startCameraPosition.z) * dampenedPhase);
      } else {
        const dampenedPhase = dampenPhase((phase - MIDDLE_AT_PHASE) / (1 - MIDDLE_AT_PHASE));
        camera.position.set(
          xMiddle + (xyh.x - xMiddle) * dampenedPhase,
          hMiddle + (xyh.h - hMiddle) * dampenedPhase,
          yMiddle + (xyh.y - yMiddle) * dampenedPhase);
      }
    }
  }
}
