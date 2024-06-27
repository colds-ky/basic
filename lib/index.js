export {
  likelyDID,
  shortenDID, shortenHandle,
  unwrapShortDID, unwrapShortHandle,
  breakFeedUri, breakPostURL
} from './shorten';

export {
  isPromise
} from './is-promise';

export {
  ColdskyAgent
} from './coldsky-agent';

export { firehose } from './firehose';

export { version } from '../package.json';
export { firehoseShortDIDs } from './firehose-short-dids';
export { plcDirectory } from './plc-directory';

// checkApplyGlobal();

// function checkApplyGlobal() {
//   if (typeof process !== 'undefined' && typeof process?.exit === 'function') {
//     if (typeof module !== 'undefined' && module?.exports) {
//       for (const key in all) {
//         module.exports[key] = all[key];
//       }
//     }
//     return;
//   }

//   if (typeof window !== 'undefined' && window) {
//     window['coldsky'] = all;
//   } else if (typeof global !== 'undefined' && global) {
//     global['coldsky'] = all;
//   }
// }
