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

import { firehose } from './firehose';

import { version } from '../package.json';

const all = {
  version,
  likelyDID,
  shortenDID, shortenHandle,
  unwrapShortDID, unwrapShortHandle,
  breakFeedUri, breakPostURL,
  isPromise,
  ColdskyAgent,
  firehose
};

//export default all;

checkApplyGlobal();

function checkApplyGlobal() {
  if (typeof process !== 'undefined' && typeof process?.exit === 'function') {
    if (typeof module !== 'undefined' && module?.exports) {
      for (const key in all) {
        module.exports[key] = all[key];
      }
    }
    return;
  }

  if (typeof window !== 'undefined' && window) {
    window['coldsky'] = all;
  } else if (typeof global !== 'undefined' && global) {
    global['coldsky'] = all;
  }
}
