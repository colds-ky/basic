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
 *  clock: ReturnType<import('../clock').makeClock>,
 *  nodes: T[],
 *  getPoint: (item: T, point: { x: number, y: number, h: number, weight: number }) => void,
 *  getColor: (item: T) => number
 * }} _
 */
export function staticShaderRenderer({ clock, nodes, getPoint, getColor }) {
  let allocateCount = Math.max(
    Math.floor(nodes.length * 1.15),
    nodes.length + 100);

  let {
    geometry,
    offsetBuf,
    diameterBuf,
    colorBuf
  } = createGeometryAndBuffers(allocateCount);

  const point = { x: 0, y: 0, h: 0, weight: 0 };
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    getPoint(node, point);
    offsetBuf[i * 3 + 0] = point.x;
    offsetBuf[i * 3 + 1] = point.h; // TODO: 
    offsetBuf[i * 3 + 2] = point.y;
    diameterBuf[i] = point.weight;

    colorBuf[i] = getColor(node) * 256 | 0xFF;
  }
  geometry.instanceCount = nodes.length;

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
   * @param {{ nodes: T[] }} _
   */
  function updateNodes({ nodes }) {
    if (nodes.length > allocateCount) {
      const newAllocateCount = Math.max(
        Math.floor(nodes.length * 1.5),
        nodes.length + 300);
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

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      getPoint(node, point);
      offsetBuf[i * 3 + 0] = point.x;
      offsetBuf[i * 3 + 1] = point.h;
      offsetBuf[i * 3 + 2] = point.y;

      diameterBuf[i] = point.weight;

      colorBuf[i] = getColor(node);
    }

    geometry.attributes['offset'].needsUpdate = true;
    geometry.attributes['diameter'].needsUpdate = true;
    geometry.attributes['color'].needsUpdate = true;

    geometry.instanceCount = nodes.length;
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

