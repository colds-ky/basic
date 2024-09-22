// @ts-check

/**
 * @template T
 * @param {number} size
 * @param {{
 *  entry: (item: T, set: { x: number, y: number, mass: number, vx: number, vy: number }) => void,
 *  uniform: (item: T, set: { fx: number, fy: number }) => void,
 *  attraction: (item1: T, item2: T, set: { fx: number, fy: number }) => void,
 * }} params
 */
export function layoutCalculator(size, params) {
  // x, y
  // vx, vy, mass, charge

  const canvas = document.createElement('canvas');

  // TODO: try more square sizes
  canvas.width = size;
  canvas.height = 1;

  // TODO: try limiting to webgl without 2
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 is required.');


  return run;

  /**
   * @param {number} time
   * @param {T[]} items
   * @param {(item: T, set: { x: number, y: number, vx: number, vy: number }) => void} set
   */
  function run(time, items, set) {

  }
}
