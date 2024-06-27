// @ts-check
/// <reference path="../types.d.ts" />

import React, { useEffect, useState } from 'react';
import { isPromise } from '.';

/**
 * @template {any} TFrom
 * @template {any} TTo
 * @param {TFrom} from
 * @param {Promise<TTo> | Iterable<TTo> | AsyncIterable<TTo> | ((from: TFrom) => TTo | Promise<TTo> | Iterable<TTo> | AsyncIterable<TTo>)} derive
 * @param {(error: any, from: TFrom) => TTo} [catchError]
 * @returns {TTo}
 */
export function forAwait(from, derive, catchError) {

  const [state, setState] = useState(/** @type {State} */({}));

  let fromToken;
  if (!state.from || state.from.value !== from) {
    fromToken = state.from = { value: from };
    state.sync = true;
    state.to = {};
    const run = (callback) => {
      if (!callback) return;
      if (state.sync) {
        try { callback(); }
        catch (error) { handleError(error); }
        return;
      }

      if (!state.to.continueDerivePromise) {
        state.to.continueDerivePromise = new Promise(resolve => state.to.continueDerive = resolve);
        try { callback(); }
        catch (error) { handleError(error); }
      } else {
        state.to.continueDerivePromise = state.to.continueDerivePromise
          .then(() => {
            try { callback(); }
            catch (error) { handleError(error); }
          });
      }
    };

    const runFinalizers = () => {
      const finalizers = state.to?.finalizers;
      if (finalizers) {
        state.to.finalizers = undefined;
        for (const finalizer of finalizers) {
          if (typeof finalizer === 'function') {
            try { finalizer(); }
            catch (finalizerError) { console.warn('finalizer threw an error', finalizerError); }
          }
        }
      }
    };
    state.runFinalizers = runFinalizers;

    const handleError = (error) => {
      state.to.failed = true;
      state.to.continueDerive = undefined;
      state.to.continueDerivePromise = undefined;
      state.runFinalizers = undefined;
      if (typeof catchError === 'function') {
        try {
          state.to.current = catchError(error, from);
        } catch (secondaryError) {
          console.warn('catchError threw an error', { originalError: error, secondaryError });
        }
      }
      runFinalizers();
    };

    continueWith({
      from,
      alive: function alive(callback) {
        if (state.from !== fromToken || state.to.failed) return;
        run(callback);
      },
      addFinalizer: (finalizer) => {
        if (state.from !== fromToken || state.to.failed) {
          if (typeof finalizer === 'function') {
            try { finalizer(); }
            catch (finalizerError) { console.warn('finalizer threw an error', finalizerError); }
          }
          return;
        }

        if (!state.to.finalizers) state.to.finalizers = [finalizer];
        else state.to.finalizers.push(finalizer);
      },
      next: function next(value, callback) {
        if (state.from !== fromToken || state.to.failed) return;
        state.to.current = value;
        if (!state.sync) setState({ from: state.from, to: state.to });
        run(callback);
      },
      error: function error(error) {
        if (state.from !== fromToken || state.to.failed) return;
        state.to.error = error;
        state.to.failed = true;
      }
    }, derive);
  } else if (state.to.continueDerive) {
    state.sync = true;
    state.to.continueDerive();
  }
  state.sync = typeof state.to?.continueDerive === 'function' ? false : undefined;
  useEffect(() => state.runFinalizers, [state.from]);

  return state.to.current;
}

/**
 * @typedef {{
 *  from?: { value: any },
 *  to: {
 *    current?: any,
 *    error?: any,
 *    failed?: boolean,
 *    continueDerive?: () => void,
 *    finalizers?: (() => void)[],
 *    continueDerivePromise?: Promise<void>,
 *  },
 *  runFinalizers?: () => void,
 *  sync?: boolean
 * }} State
 */

/**
 * @typedef {{
 *  from: any,
 *  addFinalizer(finalizer: () => void): void,
 *  alive: (callback: () => void) => void,
 *  next: (value: any, callback?: () => void) => void,
 *  error: (error: any) => void
 * }} Continuation
 */

/**
 * @param {Continuation} continuation 
 * @param {any} derive 
 */
function continueWith(continuation, derive) {
  if (typeof derive === 'function')
    return continueWithFunction(continuation, derive);
  if (isPromise(derive))
    return continueWithPromise(continuation, derive);
  else if (isIterable(derive))
    return continueWithIterable(continuation, derive);
  else if (isAsyncIterable(derive))
    return continueWithAsyncIterable(continuation, derive);

  continuation.next(derive);
}

/**
 * @param {Continuation} continuation 
 * @param {Function} func
 */
function continueWithFunction(continuation, func) {
  try {
    continueWith(continuation, func(continuation.from));
  } catch (error) {
    continuation.error(error);
  }
}

/**
 * @param {Continuation} continuation
 * @param {Promise} promise
 */
function continueWithPromise(continuation, promise) {
  promise.then(
    result => {
      continuation.alive(() =>
        continueWith(continuation, result));
    },
    error => {
      continuation.error(error);
    });
}

/**
 * @param {Continuation} continuation
 * @param {Iterable<any>} iterable
 */
function continueWithIterable(continuation, iterable) {
  try {
    const iterator = iterable[Symbol.iterator]();
    continuation.addFinalizer(() => iterator.return?.());
    continueWithIterator(continuation, iterator);
  } catch (error) {
    continuation.error(error);
  }
}

/**
 * @param {Continuation} continuation
 * @param {Iterator<any>} iterator
 */
function continueWithIterator(continuation, iterator) {
  try {
    const iteratorResult = iterator.next();
    if (iteratorResult.done) {
      if (iteratorResult.value !== undefined)
        continuation.next(iteratorResult.value);
    } else {
      continuation.next(
        iteratorResult.value,
        () => continueWithIterator(continuation, iterator));
    }
  } catch (error) {
    continuation.error(error);
  }
}

/**
 * @param {Continuation} continuation
 * @param {AsyncIterable<any>} iterable
 */
async function continueWithAsyncIterable(continuation, iterable) {
  try {
    const iterator = iterable[Symbol.asyncIterator]();
    continuation.addFinalizer(() => iterator.return?.());
    continueWithAsyncIterator(continuation, iterator);
  } catch (error) {
    continuation.error(error);
  }
}

/**
 * @param {Continuation} continuation
 * @param {AsyncIterator<any>} iterator
 */
async function continueWithAsyncIterator(continuation, iterator) {
  try {
    let iteratorPromise = iterator.next();
    const iteratorResult = isPromise(iteratorPromise) ?
      await iteratorPromise :
      iteratorPromise;

    if (iteratorResult.done) {
      if (iteratorResult.value !== undefined)
        continuation.next(iteratorResult.value);
    } else {
      continuation.next(
        iteratorResult.value,
        () => continueWithAsyncIterator(continuation, iterator));
    }
  } catch (error) {
    continuation.error(error);
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