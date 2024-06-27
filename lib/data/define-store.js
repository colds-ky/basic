// @ts-check

import { breakFeedUri, breakPostURL, likelyDID, shortenDID } from '../shorten';
import { captureProfile } from './capture-profile';
import { captureAllRecords } from './capture-records/capture-all-records';
import { captureThread } from './capture-thread';
import { storeData } from './store-data';

/**
 * @typedef {{
 *  post?: (post: import('.').CompactPost) => void,
 *  profile?: (profile: import('.').CompactProfile) => void
 * }} Intercepts
 */

/**
 * @param {Intercepts} [intercepts]
 */
export function defineStore(intercepts) {

  const store = storeData();

  return {
    captureRecord,
    captureThreadView,
    captureProfileView,

    repos: store.repos
  };

  /**
   * @param {import('../firehose').FirehoseRecord} record
   * @param {number} now
   */
  function captureRecord(record, now) {
    return captureAllRecords(record.repo, record.cid, record, store.repos, now, intercepts);
  }

  /**
   * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} threadView
   * @param {number} now
   */
  function captureThreadView(threadView, now) {
    return captureThread(threadView, store.repos, now, intercepts);
  }

  /**
   * @param {import('@atproto/api').AppBskyActorDefs.ProfileViewDetailed} profileView
   * @param {number} now
   */
  function captureProfileView(profileView, now) {
    return captureProfile(profileView, store.repos, now);
  }
}
