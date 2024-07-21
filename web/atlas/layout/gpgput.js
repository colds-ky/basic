// @ts-check

/**
 * @param {number} size
 */
export function prepareLayout(size) {
  const canvas = document.createElement('canvas');

  // TODO: try more square sizes
  canvas.width = size;
  canvas.height = 1;

  // TODO: try limiting to webgl without 2
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 is required.');


  return run;

  function run() {
  }
}
