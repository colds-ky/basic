// @ts-check

import { capturePLCDirectoryEntriesForStore } from './capture-plc-directory-entries';
import { captureProfile } from './capture-profile';
import { captureAllRecords } from './capture-records/capture-all-records';
import { captureThread, capturePostView as captureRawPostView } from './capture-thread';
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
    capturePostView,
    captureProfileView,
    capturePLCDirectoryEntries,

    repos: store.repos
  };

  /**
   * @param {import('../firehose').FirehoseRecord} record
   * @param {number} now
   */
  function captureRecord(record, now) {
    return captureAllRecords(record.repo, record.uri, record, store.repos, now, intercepts);
  }

  /**
   * @param {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} threadView
   * @param {number} now
   */
  function captureThreadView(threadView, now) {
    return captureThread(threadView, store.repos, now, intercepts);
  }

  /**
   * @param {import('@atproto/api').AppBskyFeedDefs.PostView} postView
   * @param {number} now
   */
  function capturePostView(postView, now) {
    return captureRawPostView(postView, store.repos, now, intercepts);
  }

  /**
   * @param {import('@atproto/api').AppBskyActorDefs.ProfileViewDetailed} profileView
   * @param {number} now
   */
  function captureProfileView(profileView, now) {
    return captureProfile(profileView, store.repos, now);
  }

  /**
   * @param {(PLCDirectoryEntry | PLCDirectoryAuditLogEntry)[]} recs
   */
  function capturePLCDirectoryEntries(recs) {
    return capturePLCDirectoryEntriesForStore(recs, store.repos, intercepts);
  }
}

/**
 * @typedef {{
 *  did: string,
 *  cid: string,
 *  nullified: boolean,
 *  createdAt: string,
 *  operation: {
 *    type: 'create' | 'plc_operation',
 *    sig: string,
 *    alsoKnownAs?: string[],
 *    handle?: string,
 *    prev: string | null,
 *    service?: string,
 *    services?: {
 *      atproto_pds?: {
 *        type: 'AtprotoPersonalDataServer',
 *        endpoint: string
 *      }
 *    },
 *    rotationKeys: any[],
 *    verificationMethods: {}
 *  }
 * }} PLCDirectoryEntry
 */

/**
 * @typedef {{
 *   did: string,
 *   operation: {
 *     sig: string,
 *     type: 'plc_operation' | string,
 *     services: {
 *       atproto_pds: {
 *         type: 'AtprotoPersonalDataServer' | string,
 *         endpoint: 'https://bsky.social' | string
 *      }
 *     },
 *     alsoKnownAs: ('at://mihailik.bsky.social' | string)[]
 *     rotationKeys: string[],
 *     verificationMethods: { atproto: string }
 *  },
 *  cid: string,
 *  nullified: boolean,
 *  createdAt: '2023-06-23T10:02:29.289Z' | string
 * }} PLCDirectoryAuditLogEntry
 */
