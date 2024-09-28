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
 *  clock: { nowSeconds: number },
 *  nodes: TParticle[],
 *  massScale?: number
 * }} _
 */
export function staticShaderRenderer({ clock, nodes: nodeArray, massScale }) {
  let allocateCount = Math.max(
    Math.floor(nodeArray.length * 1.15),
    nodeArray.length + 100);

  const massScaleFactor = massScale || 1;

  let {
    geometry,
    offsetBuf,
    diameterBuf,
    colorBuf
  } = createGeometryAndBuffers(allocateCount);

  for (let i = 0; i < nodeArray.length; i++) {
    const node = nodeArray[i];
    offsetBuf[i * 3 + 0] = node.x;
    offsetBuf[i * 3 + 1] = (node.h || 0);
    offsetBuf[i * 3 + 2] = node.y;
    diameterBuf[i] = node.mass * massScaleFactor;

    colorBuf[i] = node.color * 256 | 0xFF;
  }
  geometry.instanceCount = nodeArray.length;

  const material = new ShaderMaterial({
    uniforms: {
      time: { value: clock.nowSeconds }
    },
    vertexShader: /* glsl */`
            precision highp float;

            attribute vec3 offset;
            attribute float diameter;
            attribute uint color;

            uniform float time;

            varying vec3 vPosition;
            varying float vDiameter;

            varying float vFogDist;
            varying vec4 vColor;

            void main(){
              vPosition = position;
              vDiameter = diameter;

              gl_Position = projectionMatrix * (modelViewMatrix * vec4(offset, 1) + vec4(position.xz * abs(diameter), 0, 0));

              // https://stackoverflow.com/a/22899161/140739
              uint rInt = (color / uint(256 * 256 * 256)) % uint(256);
              uint gInt = (color / uint(256 * 256)) % uint(256);
              uint bInt = (color / uint(256)) % uint(256);
              uint aInt = (color) % uint(256);
              vColor = vec4(float(rInt) / 255.0f, float(gInt) / 255.0f, float(bInt) / 255.0f, float(aInt) / 255.0f);

              vFogDist = distance(cameraPosition, offset);
            }
          `,
    fragmentShader: /* glsl */`
            precision highp float;

            uniform float time;

            varying vec4 vColor;
            varying float vFogDist;

            varying vec3 vPosition;
            varying float vDiameter;

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
            }
          `,
    side: BackSide,
    forceSinglePass: true,
    transparent: true,
    depthWrite: false
  });

  const mesh = new Mesh(
    geometry,
    /** @type {import('three').MeshBasicMaterial} */
      (/** @type {Partial<import('three').Material>} */
      (material))
    );
  mesh.frustumCulled = false;
  mesh.onBeforeRender = () => {
    material.uniforms['time'].value = clock.nowSeconds;
  };

  return {
    mesh,
    updateNodes
  };

  /**
   * @param {{ nodes: TParticle[] }} _
   */
  function updateNodes({ nodes }) {
    nodeArray = nodes;
    if (nodeArray.length > allocateCount) {
      const newAllocateCount = Math.max(
        Math.floor(nodeArray.length * 1.5),
        nodeArray.length + 300);
      console.log('Reallocating buffers from ', allocateCount, ' to ', newAllocateCount);
      allocateCount = newAllocateCount;

      let result = createGeometryAndBuffers(allocateCount);
      offsetBuf = result.offsetBuf;
      diameterBuf = result.diameterBuf;
      colorBuf = result.colorBuf;

      geometry.dispose();

      geometry = result.geometry;
      mesh.geometry = geometry;
    }

    for (let i = 0; i < nodeArray.length; i++) {
      const node = nodeArray[i];
      offsetBuf[i * 3 + 0] = node.x;
      offsetBuf[i * 3 + 1] = (node.h || 0);
      offsetBuf[i * 3 + 2] = node.y;

      diameterBuf[i] = node.mass * massScaleFactor;

      colorBuf[i] = node.color;
    }

    geometry.attributes['offset'].needsUpdate = true;
    geometry.attributes['diameter'].needsUpdate = true;
    geometry.attributes['color'].needsUpdate = true;

    geometry.instanceCount = nodeArray.length;
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

  let offsetBuf = new Float32Array(allocateCount * 4);
  let diameterBuf = new Float32Array(allocateCount);
  let colorBuf = new Uint32Array(allocateCount);

  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('offset', new InstancedBufferAttribute(offsetBuf, 3));
  geometry.setAttribute('diameter', new InstancedBufferAttribute(diameterBuf, 1));
  geometry.setAttribute('color', new InstancedBufferAttribute(colorBuf, 1));

  return { geometry, offsetBuf, diameterBuf, colorBuf };
}
