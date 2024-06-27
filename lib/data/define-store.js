// @ts-check

import { captureAllRecords } from './capture-all-records';
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
   */
  function captureRecord(record) {
    captureAllRecords(record.repo, record, store.repos);
  }

  /**
   * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} threadView
   */
  function captureThreadView(threadView) {
  }

  /**
   * @param {import('@atproto/api').AppBskyActorDefs.ProfileViewDetailed} profileView
   */
  function captureProfileView(profileView) {
  }
}

