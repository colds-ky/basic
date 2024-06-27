// @ts-check
/// <reference path="../types.d.ts" />

import React, { useEffect, useState } from 'react';
import { isPromise } from '../api';

/**
 * @template {any} TFrom
 * @template {any} TTo
 * @typedef {TTo |
 *  Promise<TTo> | TTo[] | Iterable<TTo> | AsyncIterable<TTo> |
 *  ((from: TFrom) => TSourceOf<TFrom, TTo>)
 * } TSourceOf
 */

/**
 * @template {any} TFrom
 * @template {any} TTo
 * @param {TFrom} from
 * @param {TSourceOf<TFrom, TTo>} derive
 * @returns {Awaited<TTo>}
 */
export function forAwait(from, derive) {
  const [state, setState] = useState(initAwaitState);
  state.reactSetState = setState;
  useEffect(state.effectMount, []);
  return /** @type {*} */(state.hookUse(from, derive));
}

function initAwaitState() {
  return new AwaitState();
}

/**
 * @template {any} TFrom
 * @template {any} TTo
 * @typedef {{
 *  from: TFrom,
 *  derive: TSourceOf<TFrom, TTo>,
 *  iterators: Set<{ return?: () => void }>,
 *  current?: TTo,
 *  error?: any,
 *  finished?: boolean,
 *  nudgeCallbacks?: (() => void)[],
 * }} TRun
 */

/**
 * @template {any} TFrom
 * @template {any} TTo
 */
class AwaitState {

  /** @type {TRun<TFrom, TTo>} */
  run;

  /** @type {boolean} */
  withinHook;

  /** @type {AwaitState | undefined} */
  repalcedWith;

  reactSetState(setState) { }

  /**
   * @param {TFrom} from
   * @param {TSourceOf<TFrom, TTo>} derive
   * @returns {TTo | undefined}
   */
  hookUse = (from, derive) => {
    this.withinHook = true;
    try {
      if (this.repalcedWith) return this.repalcedWith.hookUse(from, derive);

      if (!this.run || this.run.from !== from) {
        if (this.run) this.finishExistingIteration();
        this.initializeNewValues(from, derive);
      } else {
        this.nudgeContinuationFromHook();
      }

      return this.run.current;
    } finally {
      this.withinHook = false;
    }
  };

  effectMount = () => {
    if (this.repalcedWith) return this.repalcedWith.effectMount();
    this.nudgeContinuationFromHook();
  };

  effectUnmount = () => {
    if (this.repalcedWith) return this.repalcedWith.effectUnmount();
    // TODO: freeze any pending continuation
  };

  /**
   * @param {TFrom} from
   * @param {TSourceOf<TFrom, TTo>} derive
   */
  initializeNewValues(from, derive) {
    this.run = {
      from,
      derive,
      iterators: new Set()
    };

    this.continueWithChecked(from, this.run, derive, this.iterationCompletedNaturally);
  }

  iterationCompletedNaturally = () => {
    this.finishExistingIteration();
  };

  finishExistingIteration() {
    const iterators = Array.from(this.run.iterators);
    this.run.iterators.clear();
    for (const iter of iterators) {
      try {
        iter.return?.();
      } catch (error) {
        console.warn('DEBUG: error while stopping iterator', error);
      }
    }
  }

  nudgeContinuationFromHook() {
    if (!this.run.nudgeCallbacks?.length) return;

    const nudge = this.run.nudgeCallbacks.pop();
    if (typeof nudge === 'function')
      nudge();

    if (!this.run.nudgeCallbacks.length)
      this.run.nudgeCallbacks = undefined;
  }

  /**
   * @param {TFrom} from
   * @param {TRun<TFrom, TTo>} run
   * @param {TSourceOf<TFrom, any>} derive
   * @param {() => void} completedNaturally
   */
  continueWithChecked(from, run, derive, completedNaturally) {
    if (!this.canContinue(run)) return;

    if (derive) {
      if (typeof derive === 'function')
        return this.continueWithFunction(from, run, derive, completedNaturally);
      if (isPromise(derive))
        return this.continueWithPromise(from, run, derive, completedNaturally);
      if (Array.isArray(derive))
        return this.continueWithArray(from, run, derive, completedNaturally);
      if (isIterable(derive))
        return this.continueWithIterable(from, run, derive, completedNaturally);
      if (isAsyncIterable(derive))
        return this.continueWithAsyncIterable(from, run, derive, completedNaturally);
    }

    this.continueWithScalar(from, run, derive);
    completedNaturally();
  }

  /**
   * @param {TFrom} from
   * @param {TRun<TFrom, TTo>} run
   * @param {TTo} value
   */
  continueWithScalar(from, run, value) {
    this.run.current = value;
    if (!this.withinHook) {
      this.repalcedWith = new AwaitState();
      this.repalcedWith.run = this.run;
      this.repalcedWith.reactSetState = this.reactSetState;

      this.reactSetState(this.repalcedWith);
    }
  }

  /**
   * @param {TFrom} from
   * @param {TRun<TFrom, TTo>} run
   * @param {Function} func
   * @param {() => void} completedNaturally
   */
  continueWithFunction(from, run, func, completedNaturally) {
    try {
      const value = func(from);
      this.continueWithChecked(from, run, value, completedNaturally);
    } catch (error) {
      this.continueWithError(error);
    }
  }

  /**
   * @param {Error} error
   */
  continueWithError(error) {
    this.run.error = error;
    this.run.finished = true;

    this.finishExistingIteration();
  }

  /**
   * @param {TFrom} from
   * @param {TRun<TFrom, TTo>} run
   * @param {Promise<any>} promise
   * @param {() => void} completedNaturally
   */
  continueWithPromise(from, run, promise, completedNaturally) {
    promise.then(
      result => {
        if (!this.canContinue(run)) return;
        this.continueWithChecked(from, run, result, completedNaturally);
      },
      error => {
        if (!this.canContinue(run)) return;
        this.continueWithError(error);
      });
  }

  /**
 * @param {TFrom} from
 * @param {TRun<TFrom, TTo>} run
 * @param {any[]} array
 * @param {() => void} completedNaturally
 */
  continueWithArray(from, run, array, completedNaturally) {
    // treat array like iterable, no optimizations for now
    this.continueWithIterable(from, run, array, completedNaturally);
  }

  /**
   * @param {TFrom} from
   * @param {TRun<TFrom, TTo>} run
   * @param {Iterable<any>} iterable
   * @param {() => void} completedNaturally
   */
  continueWithIterable(from, run, iterable, completedNaturally) {
    let iterator;
    try {
      iterator = iterable[Symbol.iterator]();
    } catch (error) {
      return this.continueWithError(error);
    }

    if (!iterator) return completedNaturally();
    this.run.iterators.add(iterator);

    this.continueWithIterator(from, run, iterator, () => {
      this.run.iterators.delete(iterator);
      completedNaturally();
    });
  }

  /**
 * @param {TFrom} from
 * @param {TRun<TFrom, TTo>} run
 * @param {Iterator<any>} iterator
 * @param {() => void} completedNaturally
 */
  continueWithIterator(from, run, iterator, completedNaturally) {
    try {
      const iteratorResult = iterator.next();
      if (iteratorResult.done) {
        if (iteratorResult.value !== undefined)
          this.continueWithChecked(from, run, iteratorResult.value, completedNaturally);
      } else {
        this.continueWithChecked(
          from, run, iteratorResult.value,
          () => {
            this.continueWhenever(() => {
              this.continueWithIterator(from, run, iterator, completedNaturally);
            });
          });
      }
    } catch (error) {
      this.continueWithError(error);
    }
  }

  /**
   * @param {TFrom} from
   * @param {TRun<TFrom, TTo>} run
   * @param {AsyncIterable<any>} asyncIterable
   * @param {() => void} completedNaturally
   */
  continueWithAsyncIterable(from, run, asyncIterable, completedNaturally) {
    let asyncIterator;
    try {
      asyncIterator = asyncIterable[Symbol.asyncIterator]();
    } catch (error) {
      return this.continueWithError(error);
    }

    if (!asyncIterator) return completedNaturally();
    this.run.iterators.add(asyncIterator);

    this.continueWithAsyncIterator(from, run, asyncIterator, () => {
      this.run.iterators.delete(asyncIterator);
      completedNaturally();
    });

  }

  /**
* @param {TFrom} from
* @param {TRun<TFrom, TTo>} run
* @param {AsyncIterator<any>} asyncIterator
* @param {() => void} completedNaturally
*/
  async continueWithAsyncIterator(from, run, asyncIterator, completedNaturally) {
    try {
      const iteratorResult = await asyncIterator.next();
      if (iteratorResult.done) {
        if (iteratorResult.value !== undefined)
          this.continueWithChecked(from, run, iteratorResult.value, completedNaturally);
      } else {
        this.continueWithChecked(
          from, run, iteratorResult.value,
          () => {
            this.continueWhenever(() => {
              this.continueWithAsyncIterator(from, run, asyncIterator, completedNaturally);
            });
          });
      }
    } catch (error) {
      this.continueWithError(error);
    }
  }

  canContinue(run) {
    if (run !== this.run) {
      ['DEBUG: activity after stop'].toString();
      return false;
    }

    return true;
  }

  continueWhenever(callback) {
    if (this.withinHook) {
      try {
        callback();
      } catch (error) {
        this.continueWithError(error);
      }
      return;
    }

    if (this.run.nudgeCallbacks) {
      this.run.nudgeCallbacks.push(callback);
      return;
    }

    this.run.nudgeCallbacks = [];

    try {
      callback();
    } catch (error) {
      this.continueWithError(error);
    }
  }

}

/** @type {(value: any) => value is Iterable} */
function isIterable(value) {
  return value && typeof value[Symbol.iterator] === 'function';
}

/** @type {(value: any) => value is AsyncIterable} */
function isAsyncIterable(value) {
  return value && typeof value[Symbol.asyncIterator] === 'function';
}