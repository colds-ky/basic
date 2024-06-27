// @ts-check

import { BskyAgent } from '@atproto/api';
import Dexie from 'dexie';
import { known$Types } from '../lib/firehose';
import { breakFeedUri, breakPostURL, getProfileBlobUrl, shortenDID, unwrapShortDID } from '../lib/shorten';

/** @typedef {import('@atproto/api').AppBskyActorDefs.ProfileViewDetailed} ProfileViewDetailed */
/** @typedef {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} ThreadViewPost */


/** @typedef {import('../lib/firehose').RepoRecord$Typed} RepoRecord$Typed */

/**
 * @template {Object} T
 * @typedef {{
 *  ownerShortDID: string,
 *  ownID: string | undefined,
 *  reShortDIDs: string[] | undefined,
 *  rePostIDs: string[] | undefined,
 *  rec: T,
 *  timeOfCapture: number,
 *  timesOfLastAccess: number[]
 * }} TrackedEntryOfRecord
 */

/**
 * @typedef {{
 *  [$Type in keyof RepoRecord$Typed]: RepoRecord$Typed[$Type] } & {
 *  profiles: ProfileViewDetailed,
 *  threads: ThreadViewPost
 * }} RawRecordTypes
 */

/**
 * @typedef {{
 *  [K in keyof RawRecordTypes]:
 *    K extends 'app.bsky.actor.profile' ?
 *      TrackedEntryOfRecord<RawRecordTypes['profiles']> :
 *      TrackedEntryOfRecord<RawRecordTypes[K]>
 * }} CacheEntryTypes
 */

/**
 * @typedef {Dexie & {
 * [K in keyof CacheEntryTypes]: Dexie.Table<CacheEntryTypes[K], string>
 * }} TypedDB
 */

/**
 * @template {Object} RecordType
 * @typedef {{
 *  byOwnerShortDIDAndOwnID: Map<string, Map<string | undefined, RecordType>>,
 *  byReShortDID: Map<string, Set<RecordType>>,
 *  byRePostID: Map<string, Set<RecordType>>
 * }} MemoryCacheForEntry
 */

/**
 * @typedef {{
 *  [K in keyof CacheEntryTypes]: MemoryCacheForEntry<CacheEntryTypes[K]>
 * }} MemoryCache
 */

let MAX_ACCESS_HISTORY = 64;

export function defineDB() {

  const db = /** @type {TypedDB}*/(new Dexie("coldsky-db"));

  db.version(1).stores(defineSchema());

  const mem = /** @type {MemoryCache} */({});
  for (const type of known$Types) {
    mem[type] = createMemoryCacheForEntry();
  }
  mem.profiles = createMemoryCacheForEntry();
  mem.threads = createMemoryCacheForEntry();

  /**
   * @type {Record<string, Set<CacheEntryTypes[keyof CacheEntryTypes]>>}
   */
  let updatesToStore = {};

  return {
    getStoredEntry,
    getCachedEntry,
    getEntryForFreshRecord
  };

  /**
   * @returns {MemoryCacheForEntry<any>}
   */
  function createMemoryCacheForEntry() {
    return {
      byOwnerShortDIDAndOwnID: new Map(),
      byReShortDID: new Map(),
      byRePostID: new Map()
    };
  }

  function defineSchema() {
    /** @type {Record<string,string>} */
    const schema = {};
    for (const type of known$Types) {
      schema[type] =
        'ownerShortDID+ownID, [reShortDIDs], [rePostIDs], [timesOfLastAccess]';
    }
    schema.profiles = 'ownerShortDID+ownID, [timesOfLastAccess]';
    schema.threads = 'ownerShortDID+ownID, [rePostIDs], [timesOfLastAccess]';
    return schema;
  }

  /**
   * @template {keyof CacheEntryTypes} $Type
   * @param {$Type} $type
   * @param {string} ownerShortDID
   * @param {string} [ownID]
   */
  function getCachedEntry($type, ownerShortDID, ownID) {
    const cache = mem[$type];
    const byOwnID = cache.byOwnerShortDIDAndOwnID.get(ownerShortDID);
    const entry = byOwnID?.get(ownID || '');
    if (entry) {
      updateLastAccess(entry);
      scheduleLastAccessUpdate($type, entry);
    }
    return entry;
  }

  /**
   * @template {keyof CacheEntryTypes} $Type
   * @param {$Type} $type
   * @param {string} ownerShortDID
   * @param {string} [ownID]
   * @returns {CacheEntryTypes[$Type] | Promise<CacheEntryTypes[$Type]| undefined>}
   */
  function getStoredEntry($type, ownerShortDID, ownID) {
    const cached = getCachedEntry($type, ownerShortDID, ownID);
    if (cached) return cached;

    const table = /** @type {Dexie.Table<CacheEntryTypes[$Type], string>} */(db[$type]);

    return table.get({ ownerShortDID, ownID: ownID || '' }).then(
      entry => {
        if (!entry) return;

        // TODO: update last access, check if garbage collection is needed
        addToMemoryCache($type, entry);
        updateLastAccess(entry);
        scheduleLastAccessUpdate($type, entry);

        return entry;
      });
  }

  /**
   * @template {keyof CacheEntryTypes} $Type
   * @param {$Type} $type
   * @param {CacheEntryTypes[$Type]} entry
   */
  function addToMemoryCache($type, entry) {
    const cache = mem[$type];
    let byOwnID = cache.byOwnerShortDIDAndOwnID.get(entry.ownerShortDID);
    if (!byOwnID) {
      byOwnID = new Map();
      cache.byOwnerShortDIDAndOwnID.set(entry.ownerShortDID, byOwnID);
    }

    let existingEntry = byOwnID.get(entry.ownID || '');
    if (!existingEntry) {
      byOwnID.set(entry.ownID || '', entry);
    }
  }

  function updateLastAccess(entry) {
    entry.timesOfLastAccess.push(Date.now());
    if (entry.timesOfLastAccess.length > MAX_ACCESS_HISTORY) {
      entry.timesOfLastAccess.shift();
    }
  }

  /**
   * @template {keyof CacheEntryTypes} $Type
   * @param {$Type} $type
   * @param {CacheEntryTypes[$Type]} entry
   */
  function scheduleLastAccessUpdate($type, entry) {
    // TODO: debounce and store to the DB
  }

  /**
   * @template {keyof CacheEntryTypes} $Type
   * @param {$Type} $type
   * @param {string} repo
   * @param {string} cid
   * @param {RawRecordTypes[$Type]} rec
   * @returns {CacheEntryTypes[$Type]}
   */
  function getEntryForFreshRecord($type, repo, cid, rec) {
    // TODO: update memory cache and indexeddb

  }

/**
 * @template {keyof RawRecordTypes} $Type
 * @param {$Type} $type
 * @param {string} repo
 * @param {string} cid
 * @param {RawRecordTypes[$Type]} rec
 */
  function makeNewEntryForRecord($type, repo, cid, rec) {
    switch ($type) {
      case 'profiles':
        return makeNewProfileEntry(repo, cid, /** @type {RawRecordTypes['profiles']} */(rec));
      case 'threads':
        return makeThreadEntry(repo, cid, rec);
      case 'app.bsky.feed.like':
        return makeLikeEntry(repo, cid, /** @type {RawRecordTypes['app.bsky.feed.like']} */(rec));
      case 'app.bsky.feed.post':
        return makePostEntry(repo, cid, /** @type {RawRecordTypes['app.bsky.feed.post']} */(rec));

      // TODO: make all other kind of entries
      default:
        return undefined;
    }

  }

  /**
   * @param {string} repo
   * @param {string} cid
   * @param {ProfileViewDetailed} profile
   * @returns {CacheEntryTypes['profiles']}
   */
  function makeNewProfileEntry(repo, cid, profile) {
    const ownerShortDID = shortenDID(repo);
    return {
      ownerShortDID,
      ownID: cid,
      reShortDIDs: undefined,
      rePostIDs: undefined,
      rec: profile,
      timeOfCapture: Date.now(),
      timesOfLastAccess: []
    };
  }

  /**
 * @param {string} repo
 * @param {string} cid
 * @param {RepoRecord$Typed['app.bsky.actor.profile']} profileRec
 * @returns {CacheEntryTypes['profiles']}
 */
  function makeNewProfileRecordEntry(repo, cid, profileRec) {
    const ownerShortDID = shortenDID(repo);
    return {
      ownerShortDID,
      ownID: cid,
      reShortDIDs: undefined,
      rePostIDs: undefined,
      rec: /** @type {ProfileViewDetailed} */({
        did: unwrapShortDID(ownerShortDID),
        handle: '',
        ...profileRec,
        avatar: getProfileBlobUrl(repo, profileRec?.avatar?.ref?.toString()),
        banner: getProfileBlobUrl(repo, profileRec?.banner?.ref?.toString())
      }),
      timeOfCapture: Date.now(),
      timesOfLastAccess: []
    };
  }

  /**
   * @param {string} repo
   * @param {string} cid
   * @param {RawRecordTypes['app.bsky.feed.like']} like
   * @returns {CacheEntryTypes['app.bsky.feed.like']}
   */
  function makeLikeEntry(repo, cid, like) {
    const ownerShortDID = shortenDID(repo);
    const uri = breakFeedUri(like.subject?.uri);
    return {
      ownerShortDID,
      ownID: cid,
      reShortDIDs: uri?.shortDID ? [uri.shortDID] : undefined,
      rePostIDs: uri?.postID ? [uri.postID] : undefined,
      rec: like,
      timeOfCapture: Date.now(),
      timesOfLastAccess: []
    };
  }

  /**
   * @param {string} repo
   * @param {string} cid
   * @param {RawRecordTypes['app.bsky.feed.post']} post
   * @returns {CacheEntryTypes['app.bsky.feed.post']}
   */
  function makePostEntry(repo, cid, post) {
    const ownerShortDID = shortenDID(repo);

    /** @type {string[]} */
    const reShortDIDs = [];
    /** @type {string[]} */
    const rePostIDs = [];

    if (post.facets?.length) {
      for (const fa of post.facets) {
        if (fa.features?.length) {
          for (const fe of fa.features) {
            if (!fe) continue;
            const mentionDID = /** @type {import('@atproto/api/dist/client/types/app/bsky/richtext/facet').Mention} */(fe).did;
            addShortDID(mentionDID, reShortDIDs);
            const linkURL = /** @type {import('@atproto/api/dist/client/types/app/bsky/richtext/facet').Link} */(fe).uri;
            const postURL = breakPostURL(linkURL);
            if (postURL) {
              addShortDID(postURL.shortDID, reShortDIDs);
              addString(postURL.postID, rePostIDs);
            }
          }
        }
      }
    }

    if (post.embed) {
      const embedRecord = /** @type {import('@atproto/api/dist/client/types/app/bsky/embed/record').Main} */(post.embed).record;
      if (embedRecord?.uri) {
        const postURL = breakPostURL(embedRecord.uri);
        if (postURL) {
          addShortDID(postURL.shortDID, reShortDIDs);
          addString(postURL.postID, rePostIDs);
        }
      }

      const embedRecordWithMedia = /** @type {import('@atproto/api/dist/client/types/app/bsky/embed/recordWithMedia').Main} */(post.embed).record;
      if (embedRecordWithMedia?.record?.uri) {
        const postURL = breakPostURL(embedRecordWithMedia.record.uri);
        if (postURL) {
          addShortDID(postURL.shortDID, reShortDIDs);
          addString(postURL.postID, rePostIDs);
        }
      }
    }

    return {
      ownerShortDID,
      ownID: cid,
      reShortDIDs: reShortDIDs.length ? reShortDIDs : undefined,
      rePostIDs: rePostIDs.length ? rePostIDs : undefined,
      rec: post,
      timeOfCapture: Date.now(),
      timesOfLastAccess: []
    };
  }

}

/**
 * @param {string | null | undefined} did
 * @param {string[]} shortDIDs
 */
function addShortDID(did, shortDIDs) {
  const shortDID = shortenDID(did);
  if (shortDID && shortDIDs.indexOf(shortDID) < 0)
    shortDIDs.push(shortDID);
}

/**
 * @param {string | null | undefined} str
 * @param {string[]} strings
 */
function addString(str, strings) {
  if (str && strings.indexOf(str) < 0)
    strings.push(str);
}