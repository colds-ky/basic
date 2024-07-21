// @ts-check

/// <reference path="./types.d.ts" />

import { ColdskyAgent } from '../../lib';
import { BSKY_PUBLIC_URL } from '../../lib/coldsky-agent';

/**
 * @typedef {{
 *  posts: any[];
 *  more(): Promise<void>;
 *  reachedEnd?: boolean;
 * }} HistoryAccess 
 */


/**
 * @param {string} shortDID
 * @returns {Promise<HistoryAccess>}
 */
export async function getHistory(shortDID) {
  // TODO: fetch from cache, fetch from repo, fetch CBOR

  const publicAgent = new ColdskyAgent({
    service: BSKY_PUBLIC_URL
  });

}
