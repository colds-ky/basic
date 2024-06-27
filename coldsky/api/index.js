// @ts-check
/// <reference path="../types.d.ts" />

import { likelyDID, shortenDID, shortenHandle, unwrapShortDID } from '../../lib';
import { resolveHandleOrDID } from './resolve-handle-or-did';

export { resolveHandleOrDID } from './resolve-handle-or-did';
export { searchHandle } from './search';

export { forAwait as useDerived } from './forAwait';

/**
 * @param {string} did
 * @param {string} cid
 */
export function getProfileBlobUrl(did, cid) {
  if (!did || !cid) return undefined;
  return `https://cdn.bsky.app/img/avatar/plain/${unwrapShortDID(did)}/${cid}@jpeg`;
}

/**
 * @param {string} did
 * @param {string} cid
 */
export function getFeedBlobUrl(did, cid) {
  if (!did || !cid) return undefined;
  return `https://cdn.bsky.app/img/feed_thumbnail/plain/${unwrapShortDID(did)}/${cid}@jpeg`;
}

/**
* @param {string | null | undefined} url
* @returns {{ handleOrDID: string, shortDID?: string, shortHandle?: string, [aspect: string]: string } | undefined}
*/
export function breakBskyURL(url) {
  if (!url) return;
  const match = _breakBskyURL_Regex.exec(url);
  if (!match) return;
  const handleOrDID = match[1];
  /** @type {ReturnType<typeof breakBskyURL>} */
  let result;
  const resolved = resolveHandleOrDID.peek(handleOrDID);
  if (resolved) {
    result = { handleOrDID, shortDID: resolved.shortDID, shortHandle: resolved.shortHandle };
  } else {
    if (likelyDID(handleOrDID)) result = { handleOrDID, shortDID: shortenDID(handleOrDID) };
    else result = { handleOrDID, shortHandle: shortenHandle(handleOrDID) };
  }

  if (match[2] && match[4]) result[match[2]] = match[4];

  return result;
}
const _breakBskyURL_Regex = /^http[s]?\:\/\/bsky\.app\/profile\/([a-z0-9\.\:]+)\/([^\/]+)(\/([^\\]+)(\/|$))?/i;

/**
* @param {string | null | undefined} uri
*/
export function breakFeedUri(uri) {
  if (!uri) return;
  const match = _breakFeedUri_Regex.exec(uri);
  if (!match || !match[3]) return;
  return { shortDID: match[2], postID: match[3] };
}
const _breakFeedUri_Regex = /^at\:\/\/(did:plc:)?([a-z0-9]+)\/[a-z\.]+\/?(.*)?$/;

