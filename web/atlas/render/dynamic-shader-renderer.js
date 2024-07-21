// @ts-check

import {
  BackSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial
} from 'three';

/**
 * @template T
 * @param {{
 *  clock: ReturnType<typeof import('../clock').makeClock>,
 *  allocateCount: number,
 *  fragmentShader?: string,
 *  vertexShader?: string,
 *  getPoint: (item: T, point: { x: number, y: number, h: number, weight: number }) => void,
 *  getColor: (item: T) => number,
 * }} _ 
 */
export function dynamicShaderRenderer({
  clock,
  allocateCount,
  fragmentShader,
  vertexShader,
  getPoint,
  getColor
}) {
  let {
    geometry,
    offsetBuf,
    diameterBuf,
    extraBuf,
    colorBuf
  } = createGeometryAndBuffers(allocateCount);

  const material = new ShaderMaterial({
    uniforms: {
      time: { value: clock.nowSeconds }
    },
    vertexShader: /* glsl */`
            precision highp float;

            attribute vec3 offset;
            attribute float diameter;
            attribute vec2 extra;
            attribute uint color;

            uniform float time;

            varying vec3 vPosition;
            varying vec3 vOffset;
            varying float vDiameter;
            varying vec2 vExtra;

            varying float vFogDist;
            varying vec4 vColor;

            void main(){
              vPosition = position;
              vOffset = offset;
              vDiameter = diameter;
              vExtra = extra;

              gl_Position = projectionMatrix * (modelViewMatrix * vec4(offset, 1) + vec4(position.xz * abs(diameter), 0, 0));

              // https://stackoverflow.com/a/22899161/140739
              uint rInt = (color / uint(256 * 256 * 256)) % uint(256);
              uint gInt = (color / uint(256 * 256)) % uint(256);
              uint bInt = (color / uint(256)) % uint(256);
              uint aInt = (color) % uint(256);
              vColor = vec4(float(rInt) / 255.0f, float(gInt) / 255.0f, float(bInt) / 255.0f, float(aInt) / 255.0f);

              vFogDist = distance(cameraPosition, offset);

              ${vertexShader || ''}
            }
          `,
    fragmentShader: /* glsl */`
            precision highp float;

            uniform float time;

            varying vec4 vColor;
            varying float vFogDist;

            varying vec3 vPosition;
            varying vec3 vOffset;
            varying float vDiameter;
            varying vec2 vExtra;

            void main() {
              gl_FragColor = vColor;
              float dist = distance(vPosition, vec3(0.0));
              dist = vDiameter < 0.0 ? dist * 2.0 : dist;
              float rad = 0.25;
              float areola = rad * 2.0;
              float bodyRatio =
                dist < rad ? 1.0 :
                dist > areola ? 0.0 :
                (areola - dist) / (areola - rad);
              float radiusRatio =
                dist < 0.5 ? 1.0 - dist * 2.0 : 0.0;

              float fogStart = 0.6;
              float fogGray = 1.0;
              float fogRatio = vFogDist < fogStart ? 0.0 : vFogDist > fogGray ? 1.0 : (vFogDist - fogStart) / (fogGray - fogStart);

              vec4 tintColor = vColor;
              tintColor.a = radiusRatio;
              gl_FragColor = mix(gl_FragColor, vec4(1.0,1.0,1.0,0.7), fogRatio * 0.7);
              gl_FragColor = vDiameter < 0.0 ? vec4(0.6,0.0,0.0,1.0) : gl_FragColor;
              gl_FragColor.a = bodyRatio;

              vec3 position = vPosition;
              vec3 offset = vOffset;
              float diameter = vDiameter;
              vec2 extra = vExtra;

              ${fragmentShader || ''}
            }
          `,
    side: BackSide,
    forceSinglePass: true,
    transparent: true,
    depthWrite: false
  });

  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.onBeforeRender = () => {
    material.uniforms['time'].value = clock.nowSeconds;
  };
  return {
    mesh,
    updateNodes
  };

  /**
   * @param {{
   *  nodes: T[],
   *  getTimes: (item: T, times: { start: number, stop: number }) => void
   * }} _
   */
  function updateNodes({ nodes, getTimes }) {
    const point = {
      x: 0,
      y: 0,
      h: 0,
      weight: 0
    };

    const times = {
      start: 0,
      stop: 0
    };

    let flashNodeCount = 0;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];

      getTimes(n, times);
      if (times.start === times.start ||
        clock.nowMSec < times.start ||
        clock.nowMSec >= times.stop)
        continue;

      ensureGeometryIncrease(
        flashNodeCount + 1 /* min */,
        nodes.length - i + flashNodeCount /* max */,
        flashNodeCount /* occupied */
      );

      getPoint(n, point);
      offsetBuf[flashNodeCount * 3 + 0] = point.x;
      offsetBuf[flashNodeCount * 3 + 1] = point.h;
      offsetBuf[flashNodeCount * 3 + 2] = point.y;

      diameterBuf[flashNodeCount] = point.weight;

      colorBuf[flashNodeCount] = getColor(n);

      extraBuf[flashNodeCount * 2 + 0] = times.start;
      extraBuf[flashNodeCount * 2 + 1] = times.stop;

      flashNodeCount++;
    }

    geometry.attributes['offset'].needsUpdate = true;
    geometry.attributes['diameter'].needsUpdate = true;
    geometry.attributes['color'].needsUpdate = true;
    geometry.attributes['extra'].needsUpdate = true;

    geometry.instanceCount = flashNodeCount;
  }

  /**
   * @param {number} minRequiredCount
   * @param {number} maxRequiredCount
   * @param {number} occupiedCount
   */
  function ensureGeometryIncrease(minRequiredCount, maxRequiredCount, occupiedCount) {
    if (allocateCount >= minRequiredCount) return;

    allocateCount = Math.max(
      Math.floor(maxRequiredCount * 1.5),
      maxRequiredCount + 100);

    const recreated = createGeometryAndBuffers(allocateCount);

    copyFloat32Array(
      offsetBuf, 0,
      recreated.offsetBuf, 0,
      occupiedCount * 3);
    offsetBuf = recreated.offsetBuf;

    copyFloat32Array(
      diameterBuf, 0,
      recreated.diameterBuf, 0,
      occupiedCount);
    diameterBuf = recreated.diameterBuf;

    copyFloat32Array(
      extraBuf, 0,
      recreated.extraBuf, 0,
      occupiedCount * 2);
    extraBuf = recreated.extraBuf;

    copyUint32Array(
      colorBuf, 0,
      recreated.colorBuf, 0,
      occupiedCount);
    colorBuf = recreated.colorBuf;

    geometry.dispose();
    geometry = recreated.geometry;
    mesh.geometry = geometry;
  }
}

/**
 * @param {number} allocateCount
 */
function createGeometryAndBuffers(allocateCount) {
  const baseHalf = 1.5 * Math.tan(Math.PI / 6);
  let positions = new Float32Array([
    -baseHalf, 0, -0.5,
    0, 0, 1,
    baseHalf, 0, -0.5
  ]);

  const offsetBuf = new Float32Array(allocateCount * 4);
  const diameterBuf = new Float32Array(allocateCount);
  const extraBuf = new Float32Array(allocateCount * 2);
  const colorBuf = new Uint32Array(allocateCount);

  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('offset', new InstancedBufferAttribute(offsetBuf, 3));
  geometry.setAttribute('diameter', new InstancedBufferAttribute(diameterBuf, 1));
  geometry.setAttribute('extra', new InstancedBufferAttribute(extraBuf, 2));
  geometry.setAttribute('color', new InstancedBufferAttribute(colorBuf, 1));
  geometry.instanceCount = allocateCount;

  return {
    geometry,
    offsetBuf,
    diameterBuf,
    extraBuf,
    colorBuf
  };
}

/**
 * Separate for Float32Array only, to avoid polymorphic deoptimisation
 * @param {Float32Array} src
 * @param {number} srcOffset
 * @param {Float32Array} dst
 * @param {number} dstOffset
 * @param {number} length
 */
function copyFloat32Array(src, srcOffset, dst, dstOffset, length) {
  for (let i = 0; i < length; i++) {
    dst[dstOffset + i] = src[srcOffset + i];
  }
}

/**
 * Separate for Float32Array only, to avoid polymorphic deoptimisation
 * @param {Uint32Array} src
 * @param {number} srcOffset
 * @param {Uint32Array} dst
 * @param {number} dstOffset
 * @param {number} length
 */
function copyUint32Array(src, srcOffset, dst, dstOffset, length) {
  for (let i = 0; i < length; i++) {
    dst[dstOffset + i] = src[srcOffset + i];
  }
}