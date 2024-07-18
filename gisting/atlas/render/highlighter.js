// @ts-check

import { Camera, Color, CylinderGeometry, Group, Mesh, MeshLambertMaterial, Scene, SphereGeometry } from 'three';
import { Text } from 'troika-three-text';
import { distance2D } from '../coords';


/**
 * @template T
 * @template {any} K
 * @param {{
 *  getKey: (item: T) => K,
 *  getPoint: (item: T, point: { x: number, y: number, h: number, weight: number }) => void,
 *  getLabel: (item: T) => string,
 *  getDescription: (item: T) => string,
 *  getColor: (item: T) => number,
 *  MAX_HIGHLIGHT_COUNT: number
 * }} _
 */
export function highlighter({
  getKey,
  getPoint,
  getLabel,
  getDescription,
  getColor,
  MAX_HIGHLIGHT_COUNT,
}) {

  /**
   * @type {{
   *  highlight(),
   *  fade(),
   *  dispose(),
   *  node: T
   * }[]}
   */
  var higlightNodeStack = [];

  return focusAndHighlightNode;

  /**
   * @param {{
   *  node: T,
   *  scene: Scene,
   *  camera: Camera,
   *  moveAndPauseRotation: (coord: {x: number, y: number, h: number}, towards: {x: number, y: number, h: number}) => void
   * }} _param
   */
  function focusAndHighlightNode({ node, scene, camera, moveAndPauseRotation }) {
    while (higlightNodeStack?.length > MAX_HIGHLIGHT_COUNT) {
      const early = higlightNodeStack.shift();
      early?.dispose?.();
    }

    const key = getKey(node);
    const point = { x: 0, y: 0, h: 0, weight: 0 };
    getPoint(node, point);
    const color = getColor(node);
    const label = getLabel(node);
    const description = getDescription(node);

    let existingEntry = false;
    for (const stackEntry of higlightNodeStack) {
      const entryKey = getKey(stackEntry.node);
      if (entryKey === key) {
        existingEntry = true;
        stackEntry.highlight();
      } else {
        stackEntry.fade();
      }
    }

    if (existingEntry) {
      return;
    }

    const r = distance2D(point.x, point.y, 0, 0);
    const angle = Math.atan2(point.y, point.x);
    const xPlus = (r + 0.09) * Math.cos(angle);
    const yPlus = (r + 0.09) * Math.sin(angle);
    const hPlus = point.h + 0.04;

    const material = new MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      // emissive: userColor,
    });
    const stem = new CylinderGeometry(0.0005, 0.00001, 0.002);
    const ball = new SphereGeometry(0.004);
    const stemMesh = new Mesh(stem, material);
    const ballMesh = new Mesh(ball, material);
    stemMesh.position.set(point.x, point.h + 0.012, point.y);
    stemMesh.scale.set(1, 11.5, 1);

    ballMesh.position.set(point.x, point.h + 0.0275, point.y);
    scene.add(stemMesh);
    scene.add(ballMesh);

    const handleText = new Text();
    handleText.text = label;
    handleText.fontSize = 0.025;
    handleText.fontWeight = /** @type {*} */(900);
    handleText.color = color;
    handleText.outlineWidth = 0.0005;
    handleText.outlineBlur = 0.005;
    handleText.position.set(-0.009, 0.065, 0);
    handleText.onAfterRender = () => {
      applyTextBillboarding();
    };

    const group = new Group();
    group.position.set(point.x, point.h, point.y);
    group.add(/** @type {*} */(handleText));

    const displayNameText = description ? new Text() : undefined;
    if (displayNameText) {
      displayNameText.text = description;
      displayNameText.fontSize = 0.009;
      const co = new Color(color);
      co.offsetHSL(0, 0, 0.15);
      displayNameText.color = co.getHex();
      displayNameText.outlineWidth = 0.0003;
      displayNameText.outlineBlur = 0.005;
      displayNameText.position.set(0.0073, 0.0339, 0.0002);
      displayNameText.fontWeight = /** @type {*} */(200);
      group.add(/** @type {*} */(displayNameText));
    }

    scene.add(group);
    handleText.sync();
    if (displayNameText) displayNameText.sync();

    highlightNode();

    const nodeEntry = {
      node,
      dispose: unhighlightNode,
      highlight: highlightNode,
      fade: fadeNode
    };

    if (!higlightNodeStack) higlightNodeStack = [nodeEntry];
    else higlightNodeStack.push(nodeEntry);

    function applyTextBillboarding() {
      group.rotation.y = Math.atan2(
        (camera.position.x - group.position.x),
        (camera.position.z - group.position.z));
      handleText.sync();
    }

    function highlightNode() {
      handleText.fillOpacity = 1;
      handleText.strokeOpacity = 1;
      handleText.sync();
      if (displayNameText) {
        displayNameText.fillOpacity = 1;
        displayNameText.strokeOpacity = 1;
        displayNameText.sync();
      }
      material.opacity = 0.9;
      material.needsUpdate = true;

      moveAndPauseRotation({ x: xPlus, y: yPlus, h: hPlus }, point);
    }

    function fadeNode() {
      handleText.fillOpacity = 0.4;
      handleText.strokeOpacity = 0.4;
      handleText.sync();
      if (displayNameText) {
        displayNameText.fillOpacity = 0.4;
        displayNameText.strokeOpacity = 0.4;
        displayNameText.sync();
      }
      material.opacity = 0.4;
      material.needsUpdate = true;
    }

    function unhighlightNode() {
      scene.remove(group);
      handleText.dispose();

      scene.remove(stemMesh);
      scene.remove(ballMesh);
      material.dispose();
      stem.dispose();
      ball.dispose();

      /** @type {*} */(focusAndHighlightNode).unhighlightUser = undefined;
    }
  }

}
