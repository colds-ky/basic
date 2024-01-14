/**
 * @param {any} x
 * @returns {x is Promise<any>}
 */
export function isPromise(x) {
  if (!x || typeof x !== 'object') return false;
  else return typeof x.then === 'function';
}
