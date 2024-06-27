// @ts-check
/// <reference path="../types.d.ts" />

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

/** @param {string | null | undefined} text */
export function likelyDID(text) {
  return !!text && (
    !text.trim().indexOf('did:') ||
    text.trim().length === 24 && !/[^\sa-z0-9]/i.test(text)
  );
}

/**
 * @param {T} did
 * @returns {T}
 * @template {string | undefined | null} T
 */
export function shortenDID(did) {
  return did && /** @type {T} */(did.replace(_shortenDID_Regex, '').toLowerCase() || undefined);
}

const _shortenDID_Regex = /^did\:plc\:/;

export function unwrapShortDID(shortDID) {
  return !shortDID ? undefined : shortDID.indexOf(':') < 0 ? 'did:plc:' + shortDID.toLowerCase() : shortDID.toLowerCase();
}

/**
 * @param {T} handle
 * @returns {T}
 * @template {string | undefined | null} T
 */
export function shortenHandle(handle) {
  handle = cheapNormalizeHandle(handle);
  return handle && /** @type {T} */(handle.replace(_shortenHandle_Regex, '').toLowerCase() || undefined);
}
const _shortenHandle_Regex = /\.bsky\.social$/;

export function unwrapShortHandle(shortHandle) {
  shortHandle = cheapNormalizeHandle(shortHandle);
  return !shortHandle ? undefined : shortHandle.indexOf('.') < 0 ? shortHandle.toLowerCase() + '.bsky.social' : shortHandle.toLowerCase();
}

function cheapNormalizeHandle(handle) {
  handle = handle && handle.trim().toLowerCase();

  if (handle && handle.charCodeAt(0) === 64)
    handle = handle.slice(1);

  const urlprefix = 'https://bsky.app/';
  if (handle && handle.lastIndexOf(urlprefix, 0) === 0) {
    const bskyURL = breakBskyURL(handle);
    if (bskyURL && bskyURL.shortDID)
      return bskyURL.shortDID;
  }

  if (handle && handle.lastIndexOf('at:', 0) === 0) {
    const feedUri = breakFeedUri(handle);
    if (feedUri && feedUri.shortDID)
      return feedUri.shortDID;
  }

  return handle || undefined;
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

/**
 * @param {any} x
 * @returns {x is Promise<any>}
 */
export function isPromise(x) {
  if (!x || typeof x !== 'object') return false;
  else return typeof x.then === 'function';
}
