// @ts-check

import { BufferGeometry, Group, Line, MeshBasicMaterial, PerspectiveCamera, TextureLoader, Vector3 } from 'three';
import { Text } from 'troika-three-text';
import { distance2D } from '../coords';

/**
 * @template T
 * @template {any} K
 * @param {{
 *  nodes: T[],
 *  tiles: T[][],
 *  getKey: (item: T) => K,
 *  getPoint: (item: T, point: { x: number, y: number, h: number, weight: number }) => void,
 *  getLabel: (item: T) => string,
 *  getDescription: (item: T) => string,
 *  getColor: (item: T) => number,
 *  tileDimensionCount: number,
 *  clock: ReturnType<typeof import('../clock').makeClock>,
 *  includeFixed?: K[],
 *  MIN_DISTANCE?: number
 * }} _
 */
export function renderGeoLabels({
  nodes,
  tiles,
  getKey,
  getPoint,
  getLabel,
  getDescription,
  getColor,
  tileDimensionCount,
  clock,
  includeFixed
}) {
  const ANIMATE_LENGTH_SEC = 0.7;
  const FIXED_ANIMATE_LENGTH_SEC = 0.5;
  const FIXED_INTRO_LENGTH_SEC = 0.4;
  const MIN_SCREEN_DISTANCE = 0.35;
  /**
   * @typedef {ReturnType<typeof createLabel>} LabelInfo
   */

  const layerGroup = new Group();

  /** @type {Set<LabelInfo>[]} */
  const labelsByTiles = [];

  /** @type {Map<K, ReturnType<typeof createLabel>>} */
  const labelsByKey = new Map();

  const pBuf = new Vector3();

  /** @type {PerspectiveCamera | undefined} */
  let latestCamera;

  const outcome = {
    layerGroup,
    updateWithCamera,
    setTooltip,
    labelCount: 0,
    hitTestCount: 0
  };

  /** @type {LabelInfo | undefined} */
  var currentTooltipLabel;

  addFixedNodeLabels();

  return outcome;

  /**
 * @param {T} node
 */
  function setTooltip(node) {

    const key = getKey(node);

    if (currentTooltipLabel?.key === key) return;
    if (currentTooltipLabel) {
      currentTooltipLabel.fixed = false;
      currentTooltipLabel.visible = false;
      currentTooltipLabel.animationEndsAtSec = clock.nowSeconds + 0.5;
      currentTooltipLabel = undefined;
    }

    if (labelsByKey.get(key)) return;

    const nodeMapped = nodes.find(node => getKey(node) === key);
    if (!nodeMapped) return;
    const point = { x: 0, y: 0, h: 0, weight: 0 };
    getPoint(nodeMapped, point);

    currentTooltipLabel = createLabel(nodeMapped, { tooltip: true });

    const xTileIndex = Math.floor((point.x + 1) / 2 * tileDimensionCount);
    const yTileIndex = Math.floor((point.y + 1) / 2 * tileDimensionCount);
    const tileIndex = xTileIndex + yTileIndex * tileDimensionCount;
    const tileBucket = labelsByTiles[tileIndex] || (labelsByTiles[tileIndex] = new Set());
    tileBucket.add(currentTooltipLabel);
    labelsByKey.set(key, currentTooltipLabel);
    layerGroup.add(currentTooltipLabel.group);

    if (latestCamera)
      currentTooltipLabel.updateWithCamera(latestCamera.position);
  }

  function addFixedNodeLabels() {
    const fixedNodes = getFixedNodes();
    const point = { x: 0, y: 0, h: 0, weight: 0 };
    for (const fNode of fixedNodes) {
      const key = getKey(fNode);
      getPoint(fNode, point);
      const label = createLabel(fNode);
      label.fixed = true;
      const xTileIndex = Math.floor((point.x + 1) / 2 * tileDimensionCount);
      const yTileIndex = Math.floor((point.y + 1) / 2 * tileDimensionCount);
      const tileIndex = xTileIndex + yTileIndex * tileDimensionCount;
      const tileBucket = labelsByTiles[tileIndex] || (labelsByTiles[tileIndex] = new Set());
      tileBucket.add(label);
      labelsByKey.set(key, label);
      layerGroup.add(label.group);
    }
  }

  /** @typedef {{ shortDID: string, x: number, y: number, h: number, weight: number }} TileETFEntry */

  function getFixedNodes() {
    if (!includeFixed?.length) return [];
    const includeFixedSet = new Set(includeFixed);

    /** @type {T[]} */
    const fixedNodes = [];

    /** @type {T[]} */
    const largestNodes = [];

    for (const n of nodes) {
      const key = getKey(n);
      if (includeFixedSet.has(key)) {
        fixedNodes.push(n);
      }
    }

    return fixedNodes;
  }

  /**
   * @type {{
   *  x: number,
   *  y: number,
   *  h: number,
   *  weight: number
   * }}
   */
  var createLabelPoint;

  /**
   * @param {T} node
   * @param {{ tooltip?: boolean }} [opts]
   */
  function createLabel(node, opts) {
    /** @type {MeshBasicMaterial | undefined} */
    let lineMaterial;

    let xmin, ymin, xmax, ymax;

    outcome.labelCount++;

    let disposed = false;

    const tickerText = createText({ text: getLabel(node) });

    const longLabel = getDescription(node);

    const labelText = !longLabel ? undefined : createText({
      text: longLabel,
      fontSize: 0.005,
      position: { y: -0.013 },
      drawLine: false
    });

    const group = new Group();

    if (!createLabelPoint) createLabelPoint = { x: 0, y: 0, h: 0, weight: 0 };
    getPoint(node, createLabelPoint);

    group.position.set(createLabelPoint.x, createLabelPoint.h, createLabelPoint.y);

    group.add(/** @type {*} */(tickerText));
    if (labelText) group.add(/** @type {*} */(labelText));
    group.rotation.z = 0.3;

    const label = {
      key: getKey(node),
      node,
      addedAtSec: clock.nowSeconds,
      group,
      fixed: opts?.tooltip ? true : false,
      searchResult: false,
      animationEndsAtSec: clock.nowSeconds +
        (opts?.tooltip ? FIXED_INTRO_LENGTH_SEC + FIXED_ANIMATE_LENGTH_SEC :
          ANIMATE_LENGTH_SEC),
      visible: true,
      screenX: NaN,
      screenY: NaN,
      textWidth: NaN,
      textHeight: NaN,
      updateWithCamera,
      dispose
    };

    return label;

    /**
     * @param {Partial<Text & {
     *  underlineOffset: number,
     *  startOffset: number,
     *  position: { x?: number, y?: number, z?: number },
     *  tooltip: boolean,
     *  drawLine: boolean }>} options,
     */
    function createText(options) {
      /** @type {typeof options} */
      const defaultOptions = {
        fontSize: 0.01,
        color: getColor(node),
        outlineWidth: 0.00043,
        outlineBlur: 0.0016,
        position: { x: 0.014, y: 0.004 },
        underlineOffset: -0.016,
        startOffset: 0.0001,
        drawLine: true
      };

      const outlineWidthUsed =
        typeof options?.outlineWidth === 'number' ?
          options.outlineWidth : defaultOptions.outlineWidth || 0;

      const outlineBlurUsed =
        typeof options?.outlineBlur === 'number' ?
          options.outlineBlur : defaultOptions.outlineBlur || 0;

      const tickerText = new Text();
      for (const optName in defaultOptions) {
        if (optName in options) continue;
        if (optName === 'underlineOffset' || optName === 'startOffset' || optName === 'position' || optName === 'drawLine') continue;
        tickerText[optName] = defaultOptions[optName];
      }

      for (const optName in options) {
        if (optName === 'underlineOffset' || optName === 'startOffset' || optName === 'position' || optName === 'drawLine') continue;
        tickerText[optName] = options[optName];
      }

      const positionX =
        typeof options.position?.x === 'number' && Number.isFinite(options.position.x) ? options.position.x :
          defaultOptions.position?.x || 0;

      const positionY =
        typeof options.position?.y === 'number' && Number.isFinite(options.position.y) ? options.position.y :
          defaultOptions.position?.y || 0;

      const positionZ =
        typeof options.position?.z === 'number' && Number.isFinite(options.position.z) ? options.position.z :
          defaultOptions.position?.z || 0;

      tickerText.position.set(positionX, positionY, positionZ);
      const drawLine = typeof options.drawLine === 'boolean' ? options.drawLine :
        typeof defaultOptions.drawLine === 'boolean' ? defaultOptions.drawLine : false;

      if (opts?.tooltip) {
        tickerText.fillOpacity = 0;
        tickerText.strokeOpacity = 0;
        tickerText.outlineWidth = 0;
        tickerText.outlineBlur = 0;
      }


      if (drawLine) {
        tickerText.sync(() => {
          const visibleBounds = tickerText.textRenderInfo?.visibleBounds;
          if (!visibleBounds) return;
          [xmin, ymin, xmax, ymax] = visibleBounds;

          if (!lineMaterial)
            lineMaterial = new MeshBasicMaterial({
              color: getColor(node),
              transparent: true
            });
          if (opts?.tooltip) {
            lineMaterial.opacity = 0;
          }

          const underlineOffset = typeof options.underlineOffset === 'number' && Number.isFinite(options.underlineOffset) ? options.underlineOffset :
            defaultOptions.underlineOffset || 0;

          const startOffset = typeof options.startOffset === 'number' && Number.isFinite(options.startOffset) ? options.startOffset :
            defaultOptions.startOffset || 0;

          const geometry = new BufferGeometry().setFromPoints([
            new Vector3(0, 0, 0),
            new Vector3(xmin + tickerText.position.x + startOffset, tickerText.position.y + underlineOffset, 0),
            new Vector3(xmax + tickerText.position.x, tickerText.position.y + underlineOffset, 0),
          ]);

          const line = new Line(geometry, lineMaterial);
          group.add(line);
        });
      }

      const withOutlineUsed = /**
      @type {typeof tickerText & {
        outlineWidthUsed: number,
        outlineBlurUsed: number
      }} */(tickerText);
      withOutlineUsed.outlineWidthUsed = outlineWidthUsed;
      withOutlineUsed.outlineBlurUsed = outlineBlurUsed;

      return withOutlineUsed;
    }

    function dispose() {
      disposed = true;
      group.clear();
      tickerText.dispose();
      labelText?.dispose();
      lineMaterial?.dispose();
      outcome.labelCount--;
    }

    /** @param {Vector3} cameraPos */
    function updateWithCamera(cameraPos) {
      const SCALE_LABELS_CLOSER_THAN = 0.23;
      const trueVisible = label.visible ||
        label.animationEndsAtSec >= clock.nowSeconds;

      if (trueVisible) {
        group.visible = true;
        group.rotation.y = Math.atan2(
          (cameraPos.x - group.position.x),
          (cameraPos.z - group.position.z));

        const scale = cameraPos.distanceTo(group.position) < SCALE_LABELS_CLOSER_THAN ?
          cameraPos.distanceTo(group.position) / SCALE_LABELS_CLOSER_THAN :
          1 + (cameraPos.distanceTo(group.position) / SCALE_LABELS_CLOSER_THAN - 1) * 0.2;
        group.scale.set(scale, scale, scale);

        if (xmin && xmax) {
          label.textWidth = (xmax - xmin) * scale;
          label.textHeight = (ymax - ymin) * scale;
        }

        // 0 to 1 when animation ends
        const animationPhase =
          label.fixed ?
            (
              label.visible && label.animationEndsAtSec - clock.nowSeconds > FIXED_ANIMATE_LENGTH_SEC ? 0 :
                (clock.nowSeconds - (label.animationEndsAtSec - FIXED_ANIMATE_LENGTH_SEC)) / FIXED_ANIMATE_LENGTH_SEC
            ) :
            (clock.nowSeconds - (label.animationEndsAtSec - ANIMATE_LENGTH_SEC)) / ANIMATE_LENGTH_SEC;

        const opacity =
          // after animation finished, steady state
          animationPhase > 1 ? (label.visible ? 1 : 0) :
            // fade in
            label.visible ? animationPhase :
              // fade out
              1 - animationPhase;

        tickerText.strokeOpacity = tickerText.outlineOpacity = opacity * opacity;
        tickerText.fillOpacity = opacity;
        tickerText.outlineWidth = tickerText.outlineWidthUsed * opacity;
        tickerText.outlineBlur = tickerText.outlineBlurUsed * opacity;

        if (lineMaterial && lineMaterial?.opacity !== opacity) {
          lineMaterial.opacity = opacity;
          lineMaterial.needsUpdate = true;
        }

        if (labelText) {
          labelText.strokeOpacity = tickerText.strokeOpacity;
          labelText.fillOpacity = tickerText.fillOpacity;

          labelText.outlineWidth = labelText.outlineWidthUsed * opacity;
          labelText.outlineBlur = labelText.outlineBlurUsed * opacity;
        }

        tickerText.sync();
        if (labelText) labelText.sync();
      } else {
        group.visible = false;
      }
    }
  }

  var lastUpdateTextLabelsMsec;

  /** @param {PerspectiveCamera} camera */
  function updateWithCamera(camera) {
    const UPDATE_TEXT_LABELS_INTERVAL_MSEC = 2000;

    latestCamera = camera;

    const cameraPos = camera.position;
    camera.updateMatrixWorld();

    for (const tileBucket of labelsByTiles) {
      if (!tileBucket) continue;
      let removeLabels;
      for (const label of tileBucket) {
        label.updateWithCamera(cameraPos);
        if (!label.visible && !label.fixed && label.animationEndsAtSec < clock.nowSeconds) {
          if (!removeLabels) removeLabels = [label];
          else removeLabels.push(label);
        }
      }

      if (removeLabels) {
        for (const label of removeLabels) {
          tileBucket.delete(label);
          layerGroup.remove(label.group);
          label.dispose();
          labelsByKey.delete(label.key);
        }
      }
    }

    if (!lastUpdateTextLabelsMsec || clock.nowMSec - lastUpdateTextLabelsMsec > UPDATE_TEXT_LABELS_INTERVAL_MSEC) {
      lastUpdateTextLabelsMsec = clock.nowMSec;

      refreshDynamicLabels(camera);
    }

  }

  /** @param {PerspectiveCamera} camera */
  function refreshDynamicLabels(camera) {
    let numberOfTests = 0;
    const testArgs = /** @type {Parameters<typeof nearestLabel<LabelInfo, { screenX: number, screenY: Number, visible?: boolean }>>[0]} */({
      tileDimensionCount,
      tileX: 0, tileY: 0, testLabel: { screenX: NaN, screenY: NaN },
      tiles: labelsByTiles,
      isCloseTo: (toLabel, testLabel) => {
        numberOfTests++;
        return Math.max(0, MIN_SCREEN_DISTANCE - labelsDistanceTo(toLabel, testLabel))
      },
      isVisible: (label) => label.visible
    });

    for (let xIndex = 0; xIndex < tileDimensionCount; xIndex++) {
      for (let yIndex = 0; yIndex < tileDimensionCount; yIndex++) {
        const tileIndex = xIndex + yIndex * tileDimensionCount;

        const allTileNodeds = tiles[tileIndex];
        if (!allTileNodeds) continue; // some tiles are empty (rectangular world, round galaxy)

        const tileLabels = labelsByTiles[tileIndex] || (labelsByTiles[tileIndex] = new Set());
        testArgs.tileX = xIndex;
        testArgs.tileY = yIndex;

        for (const existingLabel of tileLabels) {
          pBuf.set(existingLabel.etf.x, existingLabel.etf.h, existingLabel.etf.y);
          pBuf.project(camera);
          existingLabel.screenX = pBuf.x;
          existingLabel.screenY = pBuf.y;

          if (existingLabel.fixed) continue;

          testArgs.testLabel = existingLabel;

          let shouldBeRemoved = nearestLabel(testArgs);
          if (shouldBeRemoved) {
            if (existingLabel.visible) {
              existingLabel.visible = false;
              const remainingFadeTime = existingLabel.animationEndsAtSec > clock.nowSeconds ?
                ANIMATE_LENGTH_SEC - (existingLabel.animationEndsAtSec - clock.nowSeconds) :
                ANIMATE_LENGTH_SEC;
              existingLabel.animationEndsAtSec = clock.nowSeconds + remainingFadeTime;
            }
          } else {
            if (!existingLabel.visible) {
              existingLabel.visible = true;
              const remainingFadeTime = existingLabel.animationEndsAtSec > clock.nowSeconds ?
                ANIMATE_LENGTH_SEC - (existingLabel.animationEndsAtSec - clock.nowSeconds) :
                ANIMATE_LENGTH_SEC;
              existingLabel.animationEndsAtSec = clock.nowSeconds + remainingFadeTime;
            }
          }
        }

        testArgs.testLabel = { screenX: NaN, screenY: NaN };
        const point = { x: 0, y: 0, h: 0, weight: 0 };
        for (const node of allTileNodeds) {
          const key = getKey(node);
          if (labelsByKey.has(key)) continue;
          getPoint(node, point);
          pBuf.set(point.x, point.h, point.y);
          pBuf.project(camera);

          testArgs.testLabel.screenX = pBuf.x;
          testArgs.testLabel.screenY = pBuf.y;

          if (nearestLabel(testArgs)) {
            break;
          } else {
            const label = createLabel(node);
            label.screenX = pBuf.x;
            label.screenY = pBuf.y;
            labelsByKey.set(key, label);
            tileLabels.add(label);
            layerGroup.add(label.group);
          }
        }
      }
    }

    outcome.hitTestCount = numberOfTests;
  }

  /**
   * @param {LabelInfo} toLabel
   * @param {{ screenX: number, screenY: number }} testLabel
   */
  function labelsDistanceTo(toLabel, testLabel) {
    return distance2D(
      toLabel.screenX + (toLabel.textWidth || 0) * 0.8,
      toLabel.screenY + (toLabel.textHeight || 0) * 3,
      testLabel.screenX,
      testLabel.screenY);
  }
}

/**
* @param {{
*  testLabel: TestLabel,
*  tiles: Iterable<TLabel>[],
*  tileX: number, tileY: number,
*  tileDimensionCount: number,
*  isCloseTo: (toLabel: TLabel, testLabel: TestLabel) => number,
*  isVisible: (label: TLabel) => boolean
* }} _ 
* @template TLabel
* @template TestLabel = TLabel
*/
export function nearestLabel({
  testLabel,
  tiles,
  tileX, tileY,
  tileDimensionCount,
  isCloseTo,
  isVisible }) {

  const tileLabels = tiles[tileX + tileY * tileDimensionCount];

  if (tileLabels) {
    for (const otherLabel of tileLabels) {
      if (otherLabel === /** @type {*} */(testLabel)) break;
      if (!isVisible(otherLabel)) continue;

      if (isCloseTo(otherLabel, testLabel)) return otherLabel;
    }
  }

  for (let xIndex = tileX - 1; xIndex >= 0; xIndex--) {
    const testTile = tiles[xIndex + tileY * tileDimensionCount];
    if (testTile) {
      let anyLabelsInTile = false;
      for (const otherLabel of testTile) {
        if (!isVisible(otherLabel)) continue;
        anyLabelsInTile = true;
        if (isCloseTo(otherLabel, testLabel)) return otherLabel;
      }

      // if there are no labels in the tile, we must keep looking left
      if (anyLabelsInTile) break;
    }
  }

  let stopLeftAt = 0;
  for (let yIndex = tileY - 1; yIndex >= 0; yIndex--) {
    for (let xIndex = tileX; xIndex > stopLeftAt; xIndex--) {
      const testTile = tiles[xIndex + yIndex * tileDimensionCount];
      if (testTile) {
        let anyLabelsInTile = false;
        for (const otherLabel of testTile) {
          if (!isVisible(otherLabel)) continue;
          anyLabelsInTile = true;
          if (isCloseTo(otherLabel, testLabel)) return otherLabel;
        }

        // if there are no labels in the tile, we must keep looking left
        if (anyLabelsInTile) {
          stopLeftAt = xIndex;
          break;
        }
      }
    }

    if (stopLeftAt === tileX) break;
  }
}
