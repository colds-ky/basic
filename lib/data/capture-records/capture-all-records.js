// @ts-check

import { captureLikeRecord } from './capture-like-record';
import { capturePostRecord } from './capture-post-record';
import { captureProfileRecord } from './capture-profile-record';
import { captureRepostRecord } from './capture-repost-record';

/** @typedef {import('../../firehose').RepoRecord$Typed} RepoRecord$Typed */

/**
 * @param {string} repo
 * @param {string} rev
 * @param {RepoRecord$Typed[keyof RepoRecord$Typed]} rec
 * @param {Map<string, import('../store-data').RepositoryData>} store
 * @param {number} asOf
 * @param {import('../define-store').Intercepts} [intercepts]
 */
export function captureAllRecords(repo, rev, rec, store, asOf, intercepts) {
  switch (rec['$type']) {
    case 'app.bsky.feed.like':
      return captureLikeRecord(repo, /** @type {RepoRecord$Typed['app.bsky.feed.like']} */(rec), store, intercepts);

    case 'app.bsky.feed.repost':
      return captureRepostRecord(repo, /** @type {RepoRecord$Typed['app.bsky.feed.repost']} */(rec), store, intercepts);

    case 'app.bsky.feed.post':
      return capturePostRecord(repo, rev, /** @type {RepoRecord$Typed['app.bsky.feed.post']} */(rec), store, asOf, intercepts);

    case 'app.bsky.actor.profile':
      return captureProfileRecord(repo, /** @type {RepoRecord$Typed['app.bsky.actor.profile']} */(rec), store, asOf, intercepts);
  }
}