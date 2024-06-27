// @ts-check

export { firehoseThreads } from './firehose-threads';
export { calcHash, nextRandom } from './hash';
export { searchAccounts } from './record-cache';

export function resolveAccount(handleOrDID) {
  // TODO: peek cache, try resolving, try public API fetch
}

export function getPost(postRef) {
  //
}