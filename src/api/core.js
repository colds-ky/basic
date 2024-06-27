// @ts-check
/// <reference path="../types.d.ts" />

import { BskyAgent } from '@atproto/api';
import { shortenDID, unwrapShortDID } from '.';

const oldXrpc = 'https://bsky.social/xrpc';
// const newXrpc = 'https://bsky.network/xrpc';

export const atClient = new BskyAgent({ service: oldXrpc });
patchBskyAgent(atClient);

/** @param {import('@atproto/api').BskyAgent} atClient */
function patchBskyAgent(atClient) {
  atClient.com.atproto.sync._service.xrpc.baseClient.lex.assertValidXrpcOutput = function (lexUri, value, ...rest) {
    return true;
  };
}

let baseURL = 'https://api.staging.clearsky.services/';

export function unwrapClearSkyURL(apiURL) {
  return baseURL + apiURL.replace(/^\//, '');
}

/** @param {number | string | null | undefined} value */
export function calcHash(value) {
  if (!value) return 13;

  return hashString(String(value));
}

/** @param {string} str */
function hashString(str) {
  let hash = 19;
  for (let i = 0; i < str.length; i++) {
    let char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

/** @param {number} rnd */
export function nextRandom(rnd) {
  if (!rnd) rnd = 251;
  if (rnd > 1) rnd = Math.abs(rnd + 1 / rnd);
  if (rnd > 10) rnd = (rnd / 10 - Math.floor(rnd / 10)) * 10;
  rnd = Math.pow(10, rnd);
  rnd = rnd - Math.floor(rnd);
  return rnd;
}

/** @param {string} did */
export function getKeyShortDID(did) {
  const shortDID = shortenDID(did);
  const fullDID = unwrapShortDID(did);
  if (!shortDID) return undefined;
  if (shortDID && shortDID === fullDID) return shortDID.slice(0, 2);
  return 'web';
}
