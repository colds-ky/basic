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
 * @template T
 * @template {any} K
 * @param {{
 *  clock: ReturnType<import('../clock').makeClock>,
 *  nodesLive: AsyncIterable<T[]>,
 *  getKey: (item: T) => K,
 *  getPoint: (item: T, point: { x: number, y: number, h: number, weight: number }) => void,
 *  getLabel: (item: T) => string,
 *  getDescription: (item: T) => string,
 *  getColor: (item: T) => number,
 *  getFlashTime: (item: T, flash: { start: number, stop: number }) => void
 * }} _
 */
export function createAtlasRenderer({
  clock,
  nodesLive,
  getKey,
  getPoint,
  getLabel,
  getDescription,
  getColor,
  getFlashTime
}) {
  /** @type {Map<K, T>} */
  let knownNodes;

  /** @type {ReturnType<typeof staticShaderRenderer<T>> | undefined} */
  let staticRenderer;

  /** @type {ReturnType<typeof renderGeoLabels<T, K>> | undefined} */
  let geoLayer;

  /** @type {PerspectiveCamera | undefined} */
  let latestCamera;

  /** @type {T[]} */
  let latestNodes = [];

  const focusAndHighlightNode = highlighter({
    getKey,
    getPoint,
    getLabel,
    getDescription,
    getColor,
    MAX_HIGHLIGHT_COUNT: 5
  });

  const flashRenderer = dynamicShaderRenderer({
    clock,
    getPoint,
    getColor,
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
    setTooltip,
    animateAndPin
  };

  async function iterate() {
    for await (const nodes of nodesLive) {
      latestNodes = nodes;

      if (!staticRenderer) {
        staticRenderer = staticShaderRenderer({
          clock,
          nodes,
          getPoint,
          getColor
        });
        flashRenderer.mesh.parent?.add(staticRenderer.mesh);

        const TILE_DIMENSION_COUNT = 64;

        const nodeLabelTiles = processNodesToTiles({
          nodes,
          getPoint,
          dimensionCount: TILE_DIMENSION_COUNT
        });

        geoLayer = renderGeoLabels({
          nodes,
          tiles: nodeLabelTiles,
          getKey,
          getPoint,
          getLabel,
          getDescription,
          getColor,
          tileDimensionCount: TILE_DIMENSION_COUNT,
          clock
        });

        flashRenderer.mesh.parent?.add(geoLayer.layerGroup);
      }

      staticRenderer.updateNodes({ nodes });
      const now = Date.now();
      flashRenderer.updateNodes({
        nodes,
        getTimes: (n, tm) => {
          if (Math.random() > 0.9) {
            tm.start = now - 100;
            tm.stop = now + 100;
          }
        }
      });

      geoLayer?.updateWithCamera(latestCamera);

      if (latestCamera)
        redraw(latestCamera);
    }
  }

  /**
   * @param {{ x: number, y: number }} screenPosition
   */
  function getNodeAtScreenPosition(screenPosition) {
    if (!latestCamera) return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    /** @type {T | undefined} */
    let closestETF;
    let closestDistance = 0;
    let closestScreenX = 0;
    let closestScreenY = 0;

    latestCamera.updateMatrixWorld();
    latestCamera.updateProjectionMatrix();
    const buf = new Vector3();
    const point = { x: 0, y: 0, h: 0, weight: 0 };
    for (const node of knownNodes.values()) {
      getPoint(node, point);
      buf.set(point.x, point.h, point.y);
      buf.project(latestCamera);

      const x = (buf.x + 1) * screenWidth / 2;
      const y = screenHeight - (buf.y + 1) * screenHeight / 2;

      let distance = distance2D(screenPosition.x, screenPosition.y, x, y);
      if (!closestETF || distance < closestDistance) {
        closestETF = node;
        closestDistance = distance;
        closestScreenX = x;
        closestScreenY = y;
      }
    }

    if (closestETF && closestDistance < 32)
      return { ...closestETF, screenX: closestScreenX, screenY: closestScreenY };
  }

  /**
   * @param {T} node
   */
  function setTooltip(node) {
    if (geoLayer) geoLayer.setTooltip(node);
  }

  /**
 * @param {{
 *  node: T,
 *  scene: Scene,
 *  moveAndPauseRotation: (coord: {x: number, y: number, h: number}, towards: {x: number, y: number, h: number}) => void
 * }} _
 */
  function animateAndPin({ node, scene, moveAndPauseRotation }) {
    const key = getKey(node);
    const etfEntry = knownNodes.get(key);
    if (!etfEntry || !latestCamera) return;

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
        getTimes: getFlashTime
      });
    }

    staticRenderer?.updateNodes({
      nodes: latestNodes
    });

    geoLayer?.updateWithCamera(camera);
  }

}