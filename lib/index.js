import {
  likelyDID,
  shortenDID, shortenHandle,
  unwrapShortDID, unwrapShortHandle,
  breakFeedUri, breakPostURL
} from './shorten';

import {
  isPromise
} from './is-promise';

import {
  ColdskyAgent
} from './coldsky-agent';

const all = {
  likelyDID,
  shortenDID, shortenHandle,
  unwrapShortDID, unwrapShortHandle,
  breakFeedUri, breakPostURL,
  isPromise,
  ColdskyAgent
};

export default all;

checkApplyGlobal();

function checkApplyGlobal() {
  if (typeof process !== 'undefined' && typeof process?.exit === 'function')
    return; // no global on node

  if (typeof window !== 'undefined' && window) {
    for (const key in all) {
      window[key] = all[key];
    }
  } else if (typeof global !== 'undefined' && global) {
    for (const key in all) {
      global[key] = all[key];
    }
  }
}
