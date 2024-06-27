// @ts-check
/// <reference path="../types.d.ts" />

import React, { useState } from 'react';
import { isPromise } from '../api';

/**
 * @typedef {{
 *  from?: any,
 *  sync?: boolean,
 *  set: {
 *    to?: any,
 *    error?: any,
 *    failed?: boolean,
 *    continueDerive?: () => void
 *  }
 * }} State
 */

/**
 * @template {any} TFrom
 * @template {any} TTo
 * @param {TFrom} from
 * @param {(from: TFrom) => TTo | Promise<TTo> | Iterable<TTo> | AsyncIterable<TTo>} derive
 * @param {(error: any, from: TFrom) => TTo} [catchError]
 * @returns {TTo}
 */
export function useDerived(from, derive, catchError) {

  const [state, setState] = useState(/** @type {State} */({}));

  if (!state.set || state.from !== from) {
    state.from = from;
    state.sync = true;
    state.set = {};
    startDerive(from, derive, catchError, state, setState);
    state.sync = typeof state.set?.continueDerive === 'function' ? false : undefined;
  } else if (state.set.continueDerive) {
    state.set.continueDerive();
  }

  return state.set?.to;
}

/**
 * @param {any} from
 * @param {(from: any) => any} derive
 * @param {((error: any, from: any) => any) | undefined} catchError
 * @param {State} state
 * @param {React.Dispatch<React.SetStateAction<State>>} setState
 */
function startDerive(from, derive, catchError, state, setState) {
  var result;
  try {
    result = derive(from);
  } catch (error) {
    if (typeof catchError === 'function') {
      try { result = catchError(error, from); }
      catch (secondaryError) { }
    }
    state.set = {
      error,
      to: result,
      failed: true
    };
    return;
  }

  if (isPromise(result)) {
    return startDerivePromise(from, result, state, setState);
  } else if (isIterable(result) || isAsyncIterable(result)) {
    return startDeriveIterable(from, result, state, setState);
  } else {
    state.set = {
      to: result
    };
  }
}

/**
 * @param {any} from
 * @param {Iterable<any> | AsyncIterable<any>} iterable
 * @param {State} state
 * @param {React.Dispatch<React.SetStateAction<State>>} setState
 */
async function startDeriveIterable(from, iterable, state, setState) {
  try {
    /** @type {Promise | undefined} */
    let continueDerivePromise;
    for await (const item of iterable) {
      const to = await item;
      if (state.from !== from) return;

      if (!state.sync) {
        await continueDerivePromise;
        continueDerivePromise = undefined;
      }

      let continueDerive;
      continueDerivePromise = new Promise(resolve => continueDerive = resolve);

      setStateRelevant({ from, set: { to, continueDerive }, sync: false }, state, setState);
    }

    if (!state.sync)
      setStateRelevant({ from, set: { to: state.set.to }, sync: true }, state, setState);
  } catch (error) {
    setStateRelevant({ from, set: { error, failed: true }, sync: true }, state, setState);
  }
}

/**
 * @param {any} from
 * @param {Promise<any>} promise
 * @param {State} state
 * @param {React.Dispatch<React.SetStateAction<State>>} setState
 */
async function startDerivePromise(from, promise, state, setState) {
  try {
    const to = await promise;
    setStateRelevant({ from, set: { to }, sync: true }, state, setState);
  } catch (error) {
    setStateRelevant({ from, set: { error, failed: true }, sync: true }, state, setState);
  }
}

/**
 * @param {State} newState
 * @param {State} state
 * @param {React.Dispatch<React.SetStateAction<State>>} setState
 */
function setStateRelevant(newState, state, setState) {
  if (newState.from !== state.from) return;
  const { sync } = state;
  state.set = newState.set;
  state.sync = newState.sync;
  if (!sync) {
    state.set = newState.set;
    state.sync = newState.sync;
    setState(currentState =>
      currentState.from === newState.from ? newState :
        currentState);
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