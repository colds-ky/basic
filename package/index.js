import * as atproto_api_import from '@atproto/api';

export * from './shorten';
export * from './is-promise';
export * from './coldsky-agent';
export * from '@atproto/api';
export * from './firehose';
export * from './read-car';

export { version } from '../package.json';
export { firehoseShortDIDs } from './firehose-short-dids';
export * from './plc-directory';

export * from './data';

export * from './throttled-async-cache';


export const atproto = atproto_api_import;

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
