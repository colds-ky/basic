// @ts-check

import { PerspectiveCamera, Scene, Vector3 } from 'three/src/Three.js';
import { distance2D } from '../coords';
import { dynamicShaderRenderer } from './dynamic-shader-renderer';
import { processNodesToTiles } from './process-nodes-to-tiles';
import { staticShaderRenderer } from './static-shader-renderer';
import { renderGeoLabels } from './render-geo-labels';
import { highlighter } from './highlighter';
import { BoxGeometry, Mesh, MeshBasicMaterial, MeshPhongMaterial } from 'three';

// import { Map, Set } from 'immutable';
// import { dynamicShaderRenderer } from './dynamic-shader-renderer';
// import { etfRecordMapper } from './etf-record-mapped';
// import { staticShaderRenderer } from './static-shader-renderer';
// import { renderGeoLabels } from './render-geo-labels';
// import { processETFsToTiles } from './process-etfs-to-tiles';
// import { PerspectiveCamera, Scene, Vector3 } from 'three';
// import { distance2D } from '../../core/coords';
// import { fadeIn } from '../../app';
// import { focusAndHighlightUser } from './focus-and-highlight';

const MAX_WEIGHT = 0.6;
const FADE_TIME_MSEC = 10 * 60 * 1000;

/**
 * @typedef {{
 *  x: number,
 *  y: number,
 *  h?: number,
 *  mass: number,
 *  color: number,
 *  key?: any,
 *  label?: string,
 *  description?: string,
 *  flash?: { start: number, stop: number }
 * }} Particle
 */

/**
 * @template {Particle} TParticle
 * @param {{
 *  clock: ReturnType<import('../clock').makeClock>,
 *  nodesLive: AsyncIterable<TParticle[]>
 * }} _
 */
export function createAtlasRenderer({
  clock,
  nodesLive,
}) {
  /** @type {Map<any, TParticle>} */
  let knownNodes;

  /** @type {ReturnType<typeof staticShaderRenderer<TParticle>> | undefined} */
  let staticRenderer;

  /** @type {PerspectiveCamera | undefined} */
  let latestCamera;

  /** @type {TParticle[]} */
  let latestNodes = [];

  const focusAndHighlightNode = highlighter({ MAX_HIGHLIGHT_COUNT: 5 });

  const flashRenderer = dynamicShaderRenderer({
    clock,
    allocateCount: 6000, // high margin
    vertexShader: /* glsl */`
            float startTime = min(extra.x, extra.y);
            float endTime = max(extra.x, extra.y);
            float timeRatio = (time - startTime) / (endTime - startTime);
            float step = 0.1;
            float timeFunction = timeRatio < step ? timeRatio / step : 1.0 - (timeRatio - step) * (1.0 - step);

            //gl_Position.y += timeFunction * timeFunction * timeFunction * 0.001;
            `,
    fragmentShader: /* glsl */`
            gl_FragColor = tintColor;

            float PI = 3.1415926535897932384626433832795;

            float startTime = min(extra.x, extra.y);
            float endTime = max(extra.x, extra.y);
            float timeRatio = (time - startTime) / (endTime - startTime);
            float step = 0.01;
            float timeFunction =
              timeRatio < step ? timeRatio / step :
              timeRatio < step * 2.0 ?
                (cos((step * 2.0 - timeRatio) * step * PI) + 1.0) / 4.5 + 0.7 :
                (1.0 - (timeRatio - step * 2.0)) / 2.5 + 0.2;

            float pulsatingTimeFunction =
              timeFunction * (sin((time - endTime)*6.0) + 4.0) / 5.0;

            gl_FragColor = tintColor;

            gl_FragColor.a *= pulsatingTimeFunction;

            // gl_FragColor =
            //   timeRatio > 1000.0 ? vec4(1.0, 0.7, 1.0, tintColor.a) :
            //   timeRatio > 1.0 ? vec4(1.0, 0.0, 1.0, tintColor.a) :
            //   timeRatio > 0.0 ? vec4(0.0, 0.5, 0.5, tintColor.a) :
            //   timeRatio == 0.0 ? vec4(0.0, 0.0, 1.0, tintColor.a) :
            //   timeRatio < 0.0 ? vec4(1.0, 0.0, 0.0, tintColor.a) :
            //   vec4(1.0, 1.0, 0.0, tintColor.a);

            float diagBias = 1.0 - max(abs(vPosition.x), abs(vPosition.z));
            float diagBiasUltra = diagBias * diagBias * diagBias * diagBias;
            gl_FragColor.a *= diagBiasUltra * diagBiasUltra * diagBiasUltra;

            `
  });

  iterate();

  return {
    mesh: flashRenderer.mesh,
    redraw,
    getNodeAtScreenPosition,
    animateAndPin
  };

  async function iterate() {
    for await (const nodes of nodesLive) {
      latestNodes = nodes;

      if (!staticRenderer) {
        staticRenderer = staticShaderRenderer({
          clock,
          nodes,
        });
        flashRenderer.mesh.parent?.add(staticRenderer.mesh);
      }

      staticRenderer.updateNodes({ nodes });
      const now = Date.now();
      flashRenderer.updateNodes({ nodes });

      if (latestCamera) {
        redraw(latestCamera);
      }
    }
  }

  /**
   * @param {{ x: number, y: number }} screenPosition
   */
  function getNodeAtScreenPosition(screenPosition) {
    if (!latestCamera) return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    /** @type {TParticle | undefined} */
    let closestNode;
    let closestDistance = 0;
    let closestScreenX = 0;
    let closestScreenY = 0;

    latestCamera.updateMatrixWorld();
    latestCamera.updateProjectionMatrix();
    const buf = new Vector3();
    for (const node of knownNodes.values()) {
      buf.set(node.x, (node.h || 0), node.y);
      buf.project(latestCamera);

      const x = (buf.x + 1) * screenWidth / 2;
      const y = screenHeight - (buf.y + 1) * screenHeight / 2;

      let distance = distance2D(screenPosition.x, screenPosition.y, x, y);
      if (!closestNode || distance < closestDistance) {
        closestNode = node;
        closestDistance = distance;
        closestScreenX = x;
        closestScreenY = y;
      }
    }

    if (closestNode && closestDistance < 32)
      return { ...closestNode, screenX: closestScreenX, screenY: closestScreenY };
  }

  /**
 * @param {{
 *  node: TParticle,
 *  scene: Scene,
 *  moveAndPauseRotation: (coord: {x: number, y: number, h?: number}, towards: {x: number, y: number, h?: number}) => void
 * }} _
 */
  function animateAndPin({ node, scene, moveAndPauseRotation }) {
    const nodeEntry = knownNodes.get(node.key ?? node);
    if (!nodeEntry || !latestCamera) return;

    focusAndHighlightNode({
      node,
      camera: latestCamera,
      scene,
      moveAndPauseRotation
    })
  }

  /**
   * @param {PerspectiveCamera} camera
   */
  function redraw(camera) {
    latestCamera = camera;
    if (Math.random() > 10) {
      flashRenderer.updateNodes({
        nodes: latestNodes,
      });
    }

    staticRenderer?.updateNodes({
      nodes: latestNodes
    });

    // geoLayer?.updateWithCamera(camera);
  }

}