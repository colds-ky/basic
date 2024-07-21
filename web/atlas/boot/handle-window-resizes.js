// @ts-check

import { PerspectiveCamera, WebGLRenderer } from 'three';

/**
 * @param {PerspectiveCamera} camera
 * @param {WebGLRenderer} renderer
 */
export function handleWindowResizes(camera, renderer) {
  window.addEventListener('resize', onWindowResize);

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
