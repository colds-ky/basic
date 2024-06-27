// @ts-check

/**
 * @template [T=any]
 * @template [TBuffer = T[]]
 * @typedef {{
 *  yield: (item: T, combine?: (buffer: TBuffer | undefined, item?: T) => TBuffer) => Promise<void>,
 *  reject: (error: Error) => void,
 *  complete: () => void,
 *  isEnded: boolean,
 *  finally: Promise<void>
 * }} StreamParameters
 */

/**
 * @template [T=any]
 * @template [TBuffer = T[]]
 * @param {(args: StreamParameters<T, TBuffer>) => void } callback
 * @returns {AsyncGenerator<TBuffer, void, unknown>}
 */
export function streamBuffer(callback) {

  let finallyTrigger = () => { args.isEnded = true; };
  let stop = false;

  /** @type {TBuffer | undefined} */
  let buffer;

  let continueTrigger = () => { };
  /** @type {Promise<void>} */
  let continuePromise = new Promise(resolve => continueTrigger = function continueTriggerInitiallySet() { resolve() });

  let yieldPassedTrigger = () => { };
  /** @type {Promise<void>} */
  let yieldPassedPromise = new Promise(resolve => yieldPassedTrigger = resolve);

  /** @type {{ error: Error } | undefined} */
  let rejectError;

  /** @type {Parameters<typeof callback>[0]} */
  const args = {
    yield: yieldFn,
    reject,
    complete,
    isEnded: false,
    finally: new Promise(resolve => {
      finallyTrigger = () => {
        args.isEnded = true;
        resolve();
      };
    })
  };

  callback(args);

  return iterate();

  /**
   * @returns {AsyncGenerator<TBuffer, void, unknown>}
   */
  async function* iterate() {

    try {
      while (!stop) {

        await continuePromise;
        if (rejectError)
          throw rejectError.error;
        if (stop) return;

        continuePromise = new Promise(resolve => continueTrigger = function continueTriggerSubsequentlySet() { resolve() });
        const yieldBuffer = buffer;
        buffer = undefined;

        if (yieldBuffer) {
          yield yieldBuffer;

          const yieldCompleted = yieldPassedTrigger;
          yieldPassedPromise = new Promise(resolve => yieldPassedTrigger = resolve);

          yieldCompleted();
        }
      }

    } finally {
      finallyTrigger();
    }
  }

  /**
   * @param {T} item
   * @param {(buffer: TBuffer | undefined, item: T) => TBuffer} [combine]
   */
  function yieldFn(item, combine) {
    if (stop) {
      console.error('Cannot yield after complete.');
      return /** @type Promise<void> */(new Promise(resolve => resolve()));
    }
    if (rejectError) {
      console.error('Cannot yield after reject.');
      return /** @type Promise<void> */(new Promise(resolve => resolve()));
    }

    if (typeof combine === 'function') {
      buffer = combine(buffer, item);
    } else {
      if (!buffer) buffer = /** @type {TBuffer} */([]);
      /** @type {*} */(buffer).push(item);
    }

    continueTrigger();

    return yieldPassedPromise;
  }

  /** @param {Error} error */
  function reject(error) {
    if (stop) {
      console.error('Cannot reject after complete.');
      return;
    }
    if (rejectError) {
      console.error('Cannot reject after reject.');
      return;
    }

    rejectError = { error };
    args.isEnded = true;
  }

  function complete() {
    stop = true;
    args.isEnded = true;
    continueTrigger();
  }
}

/**
 * @template T
 * @template [TProject = T]
 * @param {AsyncIterable<T>} input
 * @param {(item: T) => TProject} [project]
 */
export async function* map(input, project) {
  for await (const item of input) {
    const mapped = project ? project(item) : item;
    yield mapped;
  }
}

/**
 * @template T
 * @template [TProject=T extends Array ? T[0] : T]
 * @param {AsyncIterable<T>} input
 * @param {(item: T) => Iterable<TProject> | AsyncIterable<TProject>} [project]
 * @returns {AsyncIterable<TProject>}
 * }}
 */
export async function* mergeMap(input, project) {
  for await (const item of input) {
    const mapped = project ? project(item) : item;
    for await (const subItem of /** @type {AsyncIterable<TProject>} */(mapped)) {
      yield subItem;
    }
  }
}

/**
 * @template T
 * @param {(arg: {
 *  yield: (item: T) => Promise<void>,
 *  reject: (error: Error) => void,
 *  complete: () => void,
 *  finally: Promise<void>
 * }) => void } callback
 */
export function streamEvery(callback) {
  return mergeMap(streamBuffer(callback));
}
