// @ts-check

/**
 * @typedef {{
 *  x: number,
 *  y: number,
 * }} LayoutNode
 */

const defaultVariables = {
  gravity: 10,
  speed: 0.1
};

/**
 * @param {{
 *  nodes: LayoutNode[],
 *  edges: [source: LayoutNode, target: LayoutNode][]
 *  speed?: number,
 *  gravity?: number
 * }} _
 */
export function layoutCalculator({ nodes, edges, speed, gravity }) {
  if (typeof speed !== 'number') speed = defaultVariables.speed;
  if (typeof gravity !== 'number') gravity = defaultVariables.gravity;

  const area = nodes.length * nodes.length;
  const k_2 = area / (1 + nodes.length);
  const maxDisplace = Math.sqrt(area) / 10;

  const k = Math.sqrt(k_2);

  let textureSize = nodes.length + Math.floor((edges.length * 2 + 3) / 4);
  textureSize = (Math.floor(textureSize / 16) + 1) * 16;

  const canvas = document.createElement('canvas');

  canvas.width = nodes.length;
  canvas.height = 1;

  canvas.width = textureSize;
  canvas.height = 1;

  const gl = (() => {
    const gl = canvas.getContext("webgl", { alpha: false, depth: false, antialias: false });
    if (!gl) throw new Error('WebGL 2 is required.');
    return gl
  })();

  // Attempt to activate the extension, returns null if unavailable
  let textureFloat = gl.getExtension('OES_texture_float');
  if (!textureFloat) throw new Error('OES_texture_float is required.');
  textureFloat = gl.getExtension('OES_texture_float_linear');
  if (!textureFloat) throw new Error('OES_texture_float_linear is required.');

  const { data, maxEdgePerVetex } = buildTextureData({ nodes, edges });
  let texture_input = makeSizedTexture({ gl, width: textureSize, height: 1, data });
  let texture_output = makeSizedTexture({ gl, width: textureSize, height: 1, data });










































  const sourceCode = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D m;
varying vec2 vTextureCoord;
void main()
{
  float dx = 0.0, dy = 0.0;
  int i = int(floor(vTextureCoord.s * float(${textureSize}) + 0.5));

  vec4 node_i = texture2D(m, vec2(vTextureCoord.s, 1));

  gl_FragColor = node_i;
  //gl_FragColor.r = float(i);
  //return;

  if (i > ` + nodes.length + `) return;

  for (int j = 0; j < ` + nodes.length + `; j++) {
    if (i != j + 1) {
      vec4 node_j = texture2D(m, vec2((float(j) + 0.5) / float(${textureSize}) , 1));

      float xDist = node_i.r - node_j.r;
      float yDist = node_i.g - node_j.g;
      float dist = sqrt(xDist * xDist + yDist * yDist) + 0.01;

      if (dist > 0.0) {
        float repulsiveF = float(${k_2}) / dist;
        dx += xDist / dist * repulsiveF;
        dy += yDist / dist * repulsiveF;
      }
    }
  }

  int arr_offset = int(floor(node_i.b + 0.5));
  int length = int(floor(node_i.a + 0.5));
  vec4 node_buffer;
  for (int p = 0; p < ${maxEdgePerVetex}; p++) {
    if (p >= length) break;
    int arr_idx = arr_offset + p;
    // when arr_idx % 4 == 0 update node_idx_buffer
    int buf_offset = arr_idx - arr_idx / 4 * 4;
    if (p == 0 || buf_offset == 0) {
      node_buffer = texture2D(
        m,
        vec2(
          (float(arr_idx / 4) + 0.5) /
           float(${textureSize}),
          1));
    }
    float float_j =
      buf_offset == 0 ? node_buffer.r :
      buf_offset == 1 ? node_buffer.g :
      buf_offset == 2 ? node_buffer.b :
      node_buffer.a;

    vec4 node_j = texture2D(
      m,
      vec2(
        (float_j + 0.5) /
        float(${textureSize}),
        1));

    float xDist = node_i.r - node_j.r;
    float yDist = node_i.g - node_j.g;
    float dist = sqrt(xDist * xDist + yDist * yDist) + 0.01;
    float attractiveF = dist * dist / float(${k});
    if (dist > 0.0) {
      dx -= xDist / dist * attractiveF;
      dy -= yDist / dist * attractiveF;
    }
  }

  // Gravity
  float d = sqrt(node_i.r * node_i.r + node_i.g * node_i.g);
  float gf = float(${0.01 * k * gravity}) * d;
  dx -= gf * node_i.r / d;
  dy -= gf * node_i.g / d;

  // Speed
  dx *= float(${speed});
  dy *= float(${speed});

  // Apply computed displacement
  float dist = sqrt(dx * dx + dy * dy);
  if (dist > 0.0) {
    float limitedDist = min(float(${maxDisplace * speed}), dist);
    gl_FragColor.r += dx / dist * limitedDist;
    gl_FragColor.g += dy / dist * limitedDist;
  }
}
`;

  const program = createProgramFromSource({ gl, fragmentShaderSource: sourceCode });
  const positionHandle = getAttribLocation({ gl, program, name: "position" });
  gl.enableVertexAttribArray(positionHandle);
  const textureCoordHandle = getAttribLocation({ gl, program, name: "textureCoord" });
  gl.enableVertexAttribArray(textureCoordHandle);
  const textureHandle = gl.getUniformLocation(program, "texture");

  // Check if frame buffer works
  const framebuffer = attachFrameBuffer({ gl, texture: texture_output });
  verifyFrameBuffer(gl);

  return {
    run
  };

  /**
   * @param {number} msec
   */
  function run(msec) {
    const start = Date.now();
    const end = start + msec;
    let stepStart = start;
    let cycles = 0;
    while (true) {

      const tmp = texture_input;
      texture_input = texture_output;
      texture_output = tmp;

      var outputBuffer = attachFrameBuffer({ gl, texture: texture_output });

      gl.useProgram(program);

      getStandardVertices(gl);

      // TODO: what?
      gl.vertexAttribPointer(positionHandle, 3, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(textureCoordHandle, 2, gl.FLOAT, false, 20, 12);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture_input);
      gl.uniform1i(textureHandle, 0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const now = Date.now();
      if (now >= end) break;
      // it seems the next step is likely to overrun, bail out already then
      if (now - stepStart > (end - now) / 2) break;
    }

    saveDataToNode({ gl, nodes });
    return cycles;
  }
}

/**
 * Check the framebuffer status. Return false if the framebuffer is not complete,
 * That is if it is not fully and correctly configured as required by the current
 * hardware. True indicates that the framebuffer is ready to be rendered to.
 * @param {WebGLRenderingContext} gl
s */
function verifyFrameBuffer(gl) {
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status === gl.FRAMEBUFFER_COMPLETE) return true;
  for (const key in gl) {
    if (/FRAMEBUFFER/.test(key)) {
      if (gl[key] === status)
        throw new Error('Framebuffer status: ' + key);
    }
  }
}

/**
 * Create and bind a framebuffer, then attach a texture.
 * @param {{
 *  gl: WebGLRenderingContext,
 *  texture: WebGLTexture
 * }} _
 */
function attachFrameBuffer({ gl, texture }) {

  // Create a framebuffer
  const frameBuffer = gl.createFramebuffer();
  if (!frameBuffer) throw new Error('Failed to create frame buffer.');

  // Make it the target for framebuffer operations - including rendering.
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,       // The target is always a FRAMEBUFFER.
    gl.COLOR_ATTACHMENT0, // We are providing the color buffer.
    gl.TEXTURE_2D,        // This is a 2D image texture.
    texture,              // The texture.
    0);                   // 0, we aren't using MIPMAPs

  return frameBuffer;
};


/**
 * Create a width x height texture of the given type for computation.
 * Width and height are usually equal, and must be powers of two.
 * @param {{
 *  gl: WebGLRenderingContext,
 *  width: number,
 *  height: number,
 *  data: Float32Array
 * }} _
 */
function makeSizedTexture({ gl, width, height, data }) {
  // Create the texture
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create texture.');
  // Bind the texture so the following methods effect this texture.
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Pixel format and data for the texture
  gl.texImage2D(
    gl.TEXTURE_2D, // target - matches bind above.
    0, // level - of detail.
    gl.RGBA, // internalFormat - RGBA32F
    width, // width - normalized to s.
    height, // height - normalized to t.
    0, // border - always 0 in OpenGL ES.
    gl.RGBA, // format - for each pixel: RGBA32F
    gl.FLOAT, // type - for each chanel.: FLOAT
    data // Image data in the described format, or null.
  );

  // Unbind the texture.
  // gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

/**
 * @param {{
 *  nodes: LayoutNode[],
 *  edges: [source: LayoutNode, target: LayoutNode][],
 * }} _
 * @returns 
 */
function buildTextureData({ nodes, edges }) {
  var dataArray = [];

  /**
   * @type {number[][]}
   */
  var nodeDict = [];
  /** @type {Map<LayoutNode, number>} */
  var mapNodePos = new Map();
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    mapNodePos.set(n, i);
    dataArray.push(n.x);
    dataArray.push(n.y);
    dataArray.push(0);
    dataArray.push(0);
    nodeDict.push([]);
  }
  for (var i = 0; i < edges.length; i++) {
    var [source, target] = edges[i];
    const sourcePos = mapNodePos.get(source);
    const targetPos = mapNodePos.get(target);
    if (typeof sourcePos !== 'number' || typeof targetPos !== 'number') continue;

    nodeDict[sourcePos].push(targetPos);
    nodeDict[targetPos].push(sourcePos);
  }

  let maxEdgePerVetex = 0;
  for (i = 0; i < nodes.length; i++) {
    var offset = dataArray.length;
    var dests = nodeDict[i];
    var len = dests.length;
    dataArray[i * 4 + 2] = offset;
    dataArray[i * 4 + 3] = dests.length;
    maxEdgePerVetex = Math.max(maxEdgePerVetex, dests.length);
    for (var j = 0; j < len; ++j) {
      var dest = dests[j];
      dataArray.push(+dest);
    }
  }

  for (let i = 0; i < 16; i++) {
    dataArray.push(0);
  }

  // Dummy
  while (dataArray.length % 16 != 0)
    dataArray.push(0);
  // console.log(dataArray);
  return {
    data: new Float32Array(dataArray),
    maxEdgePerVetex
  };
}

/**
 * Lookup a shader attribute location by name on the given program.
 * @param {{
 *  gl: WebGLRenderingContext,
 *  program: WebGLProgram,
 *  name: string
 * }} _
 * @returns WebGLHandlesContextLoss The handle for the named attribute.
 */
function getAttribLocation({ gl, program, name }) {
  var attributeLocation;

  attributeLocation = gl.getAttribLocation(program, name);
  if (attributeLocation === -1) throw new Error('Can not find attribute ' + name + '.');

  return attributeLocation;
};


/**
     * Create a program from the shader sources.
     * @param {{
     *  gl: WebGLRenderingContext,
     *  vertexShaderSource?: string,
     *  fragmentShaderSource: string
     * }} _
     */
function createProgramFromSource({ gl, vertexShaderSource, fragmentShaderSource }) {

  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program.');

  // This will compile the shader into code for your specific graphics card.
  const vertexShader = typeof vertexShaderSource === "string" ?
    compileShader({ gl, shaderSource: vertexShaderSource, shaderType: gl.VERTEX_SHADER }) :
    // What is passed in is not a string, use the standard vertex shader
    getStandardVertexShader({ gl });

  const fragmentShader = compileShader({ gl, shaderSource: fragmentShaderSource, shaderType: gl.FRAGMENT_SHADER });

  // The program consists of our shaders
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  // Create a runnable program for our graphics hardware.
  // Allocates and assigns memory for attributes and uniforms (explained later)
  // Shaders are checked for consistency.
  gl.linkProgram(program);

  // Shaders are no longer needed as separate objects
  if (vertexShader !== standardVertexShader) {
    // Only delete the vertex shader if source was explicitly supplied
    gl.deleteShader(vertexShader);
  }
  gl.deleteShader(fragmentShader);

  return program;
}

/**
 * Return a shared, compiled, version of a widespread vertex shader for GPGPU
 * calculations. This shader is expected to be used in multiple programs within
 * a single GPGPU solution. Deleting it before it is linked into all programs
 * is problematic.
 * @param {{ gl: WebGLRenderingContext }} _
 * @returns {WebGLShader} A compiled vertex shader.
 */
function getStandardVertexShader({ gl }) {

  if (!standardVertexShader) {

    const vertexShaderSource = "attribute vec3 position;"
      + "attribute vec2 textureCoord;"
      + ""
      + "varying highp vec2 vTextureCoord;"
      + ""
      + "void main()"
      + "{"
      + "  gl_Position = vec4(position, 1.0);"
      + "  vTextureCoord = textureCoord;"
      + "}";

    standardVertexShader = compileShader({ gl, shaderSource: vertexShaderSource, shaderType: gl.VERTEX_SHADER });
  }

  return standardVertexShader;
}

var standardVertexShader;

/**
 * Create and compile a vertex or fragment shader as given by the shader type.
 *
 * @param {{
 *  gl: WebGLRenderingContext,
 *  shaderSource: string,
 *  shaderType: typeof WebGLRenderingContext['FRAGMENT_SHADER'] | WebGLRenderingContext['VERTEX_SHADER']
 * }} _
 * 
 * @returns {WebGLShader} A compiled shader of the given type.
 */
function compileShader({ gl, shaderSource, shaderType }) {
  const shader = gl.createShader(shaderType);
  if (!shader) throw new Error('Failed to create shader.');
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    throw "Shader compile failed with:" + gl.getShaderInfoLog(shader);
  }

  return shader;
}

/**
 * Return verticies for the standard geometry. If they don't yet exist,
 * they are created and loaded with the standard geometry. If they already
 * exist, they are bound and returned.
 * @param {WebGLRenderingContext} gl
 * @returns {WebGLBuffer} A bound buffer containing the standard geometry.
 */
function getStandardVertices(gl) {
  if (!standardVertices) {
    const buf = gl.createBuffer();
    if (!buf) throw new Error('Failed to create buffer.');
    standardVertices = buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, standardVertices);
    gl.bufferData(gl.ARRAY_BUFFER, getStandardGeometry(), gl.STATIC_DRAW);
  }
  else {
    gl.bindBuffer(gl.ARRAY_BUFFER, standardVertices);
  }
  return standardVertices;
}

/** @type {WebGLBuffer} */
var standardVertices;

function getStandardGeometry() {
  if (standardGeometry) return standardGeometry;
  // Sets of x,y,z(=0),s,t coordinates.
  return standardGeometry = new Float32Array([-1.0, 1.0, 0.0, 0.0, 1.0,  // upper left
  -1.0, -1.0, 0.0, 0.0, 0.0,  // lower left
    1.0, 1.0, 0.0, 1.0, 1.0,  // upper right
    1.0, -1.0, 0.0, 1.0, 0.0]);// lower right
}

/** @type {Float32Array} */
var standardGeometry;


/**
 * @param {{
 *  gl: WebGLRenderingContext,
 *  nodes: LayoutNode[],
 * }} _
 */
function saveDataToNode({ gl, nodes }) {
  var nodesCount = nodes.length;
  var output_arr = new Float32Array(nodesCount * 4);
  gl.readPixels(0, 0, nodesCount, 1, gl.RGBA, gl.FLOAT, output_arr);

  // console.log(output_arr);

  // var test = new Float32Array(this.textureSize * 4);
  // gl.readPixels(0, 0, this.textureSize, 1, gl.RGBA, gl.FLOAT, test);
  // console.log(test);

  for (var i = 0; i < nodesCount; ++i) {
    var n = nodes[i];
    n.x = output_arr[4 * i];
    n.y = output_arr[4 * i + 1];
  }
}
