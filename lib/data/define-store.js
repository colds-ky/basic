// @ts-check

import { captureAllRecords } from './capture-records/capture-all-records';
import { captureThread } from './capture-thread';
import { storeData } from './store-data';

export function defineStore() {

  const store = storeData();

  return {
    captureRecord,
    captureThreadView,
    captureProfileView
  };

  /**
   * @param {import('../firehose').FirehoseRecord} record
   * @param {number} now
   */
  function captureRecord(record, now) {
    return captureAllRecords(record.repo, record.cid, record, store.repos, now);
  }

  /**
   * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} threadView
   * @param {number} now
   */
  function captureThreadView(threadView, now) {
    return captureThread(threadView, store.repos, now);
  }

  /**
   * @param {import('@atproto/api').AppBskyActorDefs.ProfileViewDetailed} profileView
   */
  function captureProfileView(profileView) {
  }

  function getPost(url) {
    // TODO: update lastAccess
  }

  function getProfile(didOrHandle) {
    // TODO: update lastAccess
  }
}

