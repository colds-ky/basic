// @ts-check

import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { setupOrbitControls } from './setup-orbit-controls';

/**
 * @param {ReturnType<typeof import('../clock').makeClock>} clock
 */
export function setupScene(clock) {
  const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.00001, 10000);
  camera.position.x = 0.18;
  camera.position.y = 0.49;
  camera.position.z = 0.88;

  const scene = new Scene();

  const dirLight1 = new DirectionalLight(0xffffff, 7);
  dirLight1.position.set(0.5, 1, -0.5);
  scene.add(dirLight1);

  const dirLight2 = new DirectionalLight(0xffffff, 2);
  dirLight2.position.set(-0.5, -0.5, 0.5);
  scene.add(dirLight2);

  const ambientLight = new AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const stats = new Stats();

  const orbit =
    setupOrbitControls({ camera, host: renderer.domElement, clock });

  return {
    scene,
    camera,
    lights: { dirLight1, dirLight2, ambientLight },
    renderer,
    stats,
    orbit
  };
}
