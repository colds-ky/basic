// @ts-check

import { captureLikeRecord } from './capture-like-record';

/** @typedef {import('../firehose').RepoRecord$Typed} RepoRecord$Typed */

/**
 * @param {string} repo
 * @param {RepoRecord$Typed[keyof RepoRecord$Typed]} rec
 * @param {Map<string, import('./store-data').RepositoryData>} store
 */
export function captureAllRecords(repo, rec, store) {
  switch (rec['@type']) {
    case 'app.bsky.feed.like':
      captureLikeRecord(repo, /** @type {RepoRecord$Typed['app.bsky.feed.like']} */(rec), store);
      return;

  }
}