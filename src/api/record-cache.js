// @ts-check

import Dexie from 'dexie';
import { ColdskyAgent, likelyDID, shortenDID, shortenHandle, unwrapShortDID, unwrapShortHandle } from '../../coldsky/lib';
import { BSKY_PUBLIC_URL } from '../../coldsky/lib/coldsky-agent';
import { streamBuffer } from '../../coldsky/src/api/akpa';
import Fuse from 'fuse.js';

const db = new Dexie("atproto-cache");
db.version(9).stores({
  records: 'uri, did, cid, time, thread, reply, qt, *w',
  likes: 'did, uri, time',
  reposts: 'did, uri, time',
  accounts: 'did, handle, *w'
});

const publicAgent = new ColdskyAgent({
  service: BSKY_PUBLIC_URL
});

/**
 * @typedef {import ('@atproto/api/dist/client/types/app/bsky/actor/defs').ProfileView} ProfileView
 */

/**
 * @typedef {import ('@atproto/api/dist/client/types/app/bsky/actor/defs').ProfileViewBasic} ProfileViewBasic
 */

/**
 * @typedef {import ('@atproto/api/dist/client/types/app/bsky/actor/defs').ProfileViewDetailed} ProfileViewDetailed
 */

/**
 * @returns {AsyncIterable<ProfileViewDetailed>}
 */
export async function* resolveHandleOrDIDToProfile(handleOrDID) {
  let fullyResolved = false;
  const resolvedViaRequestPromise = resolveProfileViaRequest(handleOrDID);
  resolvedViaRequestPromise.then(() => fullyResolved = true);
  
  const cacheByDIDPromise = !likelyDID(handleOrDID) ? undefined : resolveDIDFromCache(handleOrDID);
  const cacheByHandlePromise = resolveHandleFromCache(handleOrDID);

  const raceCachePromise = !cacheByDIDPromise ? cacheByHandlePromise : new Promise(
    /** @param {(value: ProfileView) => void} resolve */
    resolve => {
      cacheByDIDPromise.then(resolve);
      cacheByHandlePromise.then(resolve);
    });

  const fastCacheResponse = await Promise.race([
    raceCachePromise,
    resolvedViaRequestPromise,
    new Promise(resolve => setTimeout(resolve, 100))
  ]);

  if (fastCacheResponse) yield fastCacheResponse;

  if (!fullyResolved) {
    const fullResponse = await resolvedViaRequestPromise;
    yield fullResponse;
  }
}

async function resolveHandleToProfileViaSearch(handle) {
  const matches = await directSearchAccountsFull(unwrapShortHandle(handle), 5);
  const shortHandle = shortenHandle(handle);
  for (const pro of matches) {
    storeAccountToCache(pro);
  }

  for (const pro of matches) {
      if (shortenHandle(pro.handle) === shortHandle) {
        return pro;
    }
  }
}

export async function resolveProfileViaRequest(handleOrDID) {
  const actorParam = likelyDID(handleOrDID) ? unwrapShortDID(handleOrDID) : unwrapShortHandle(handleOrDID);
  /** @type {ProfileViewDetailed} */
  const profile = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${actorParam}`).then(x => x.json());
  storeAccountToCache(profile);
  return profile;
}

/**
 * @param {string} handle
 * @returns {Promise<ProfileViewBasic | ProfileView | undefined>}
 */
async function resolveHandleFromCache(handle) {
  const matchByHandle = await db.accounts.where('handle').equals(unwrapShortHandle(handle)).first();
  return matchByHandle;
}

/**
 * @param {string} did
 * @returns {Promise<ProfileViewBasic | ProfileView | undefined>}
 */
async function resolveDIDFromCache(did) {
  const matchByDID = await db.accounts.where('did').equals(unwrapShortDID(did)).first();
  return matchByDID;
}

/** @param {string} did */
async function resolvePlcDirectly(did) {

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
   * }} PlcDirectoryAuditLogEntry
   */

  const fullDID = unwrapShortDID(did);
  /** @type {PlcDirectoryAuditLogEntry[]} */
  const entries = await fetch(`https://plc.directory/${fullDID}/log/audit`).then(x => x.json());
  return entries;
}

/**
 * @param {string} text
 */
export function searchAccounts(text) {
  const normalizedText = text?.trim() || '';
  if (!normalizedText) return (async function * nothing() { })();

  const wholeTextSearchTypeahedPromise = directSearchAccountsTypeahead(normalizedText);
  const wholeTextSearchFullPromise = directSearchAccountsFull(normalizedText);

  const words = breakIntoWords(normalizedText);
  const wordSearchTypeaheadPromises = words.map(word => directSearchAccountsTypeahead(word));
  const wordSearchFullPromises = words.map(word => directSearchAccountsFull(word));
  const cachedResults = searchAccountsFromCache(normalizedText);

  /** @type {Map<string, ProfileViewBasic | ProfileView>} */
  const storeNewAccountsByShortDID = new Map();
  let storeNewAccoutsDebounce = 0;

  return streamBuffer(
    /**
     * 
     * @param {import('../../coldsky/src/api/akpa').StreamParameters<
     *  (ProfileView | ProfileViewBasic)[],
     *  (ProfileView | ProfileViewBasic)[]>} streaming 
     */
    async streaming => {
      /**
       * @type {(ProfileView | ProfileViewBasic)[]}
       */
      const results = [];

      /**
       * @type {Record<string, (ProfileView | ProfileViewBasic)>}
       */
      const byShortDID = {};

      /**
       * @type {Promise[]}
       */
      const waitFor = [];

      waitFor.push(awaitPromiseAndMerge(wholeTextSearchTypeahedPromise));
      waitFor.push(awaitPromiseAndMerge(wholeTextSearchFullPromise));
      for (const promise of wordSearchTypeaheadPromises) {
        waitFor.push(awaitPromiseAndMerge(promise));
      }
      for (const promise of wordSearchFullPromises) {
        waitFor.push(awaitPromiseAndMerge(promise));
      }
      for (const promise of cachedResults) {
        waitFor.push(awaitPromiseAndMerge(promise));
      }

      await Promise.all(waitFor);
      streaming.complete();

      /**
       * @param {Promise<(ProfileView |ProfileViewBasic)[]>} promise 
       */
      async function awaitPromiseAndMerge(promise) {

        const result = await promise;
        let anyNew = false;
        for (const entry of result) {
          const shortDID = shortenDID(entry.did);
          const existing = byShortDID[shortDID];
          if (!existing || !existing.description && entry.description) {
            byShortDID[shortDID] = entry;
            if (!entry.w) {
              // for accounts directly from cache, don't store them back to cache
              storeNewAccountsByShortDID.set(shortDID, entry);
              clearTimeout(storeNewAccoutsDebounce);
              storeNewAccoutsDebounce = setTimeout(propagateStoreNewAccountsToCache, 1000);
            }
          }

          if (!existing) {
            results.push(entry);
            anyNew = true;
          }
        }

        if (anyNew) {
          sortResultsByText(results, text, words);
        }

        streaming.yield(results, buf => buf ? buf.concat(results) : results);
      }
    });
  
  function propagateStoreNewAccountsToCache() {
    const accounts = Array.from(storeNewAccountsByShortDID.values()).map(ac => {
      const wordLeads = populateWordLeads(ac.displayName, []);
      populateWordLeads(ac.handle, wordLeads);
      populateWordLeads(ac.description, wordLeads);
      ac.w = wordLeads;
      return ac;
    });
    storeNewAccountsByShortDID.clear();
    db.accounts.bulkPut(accounts);

    console.log('adding searched accounts ', accounts.length, ' to cache ', accounts);
  }
}

const accountsToStoreInCacheByShortDID = new Map();
let debounceAccountsToStoreInCache = 0;
let maxDebounceAccountsToStoreInCache = 0;

/**
 * @param {ProfileView | ProfileViewBasic} account 
 */
export function storeAccountToCache(account) {
  const shortDID = shortenDID(account.did);
  const existing = accountsToStoreInCacheByShortDID.get(shortDID);
  let shouldStore = !existing;
  if (existing) {
    const indexed = account.indexedAt && new Date(account.indexedAt).getTime();
    const existingIndexed = existing.indexedAt && new Date(existing.indexedAt).getTime();
    if (!existingIndexed && indexed) shouldStore = true;
    else if (existingIndexed && indexed && indexed > existingIndexed) shouldStore = true;
  }

  if (!shouldStore) return;

  accountsToStoreInCacheByShortDID.set(shortDID, account);

  if (!maxDebounceAccountsToStoreInCache)
    maxDebounceAccountsToStoreInCache = setTimeout(cacheAccountsNow, 3100);
  clearTimeout(debounceAccountsToStoreInCache);
  debounceAccountsToStoreInCache = setTimeout(cacheAccountsNow, 300);
}

/**
 * @type {Map<string, import('@atproto/api/dist/client/types/app/bsky/feed/defs').PostView>}
 */
const postsToStoreInCacheByURI = new Map();

/** @type {Map<string, Map<string, number>>} */
const likesToStoreInCacheByShortDIDAndURI = new Map();

/** @type {Map<string, Map<string, number>>} */
const repostsToStoreInCacheByShortDIDAndURI = new Map();

let debounceStoreTimeout = 0;
let maxDebounceStoreTimeout = 0;

/** @param {import('@atproto/api/dist/client/types/app/bsky/feed/defs').PostView} post */
export function storePostIndexToCache(post) {
  const existing = postsToStoreInCacheByURI.get(post.uri);
  let shouldStore = !existing;
  if (existing) {
    const indexed = post.indexedAt && new Date(post.indexedAt).getTime();
    const existingIndexed = existing.indexedAt && new Date(existing.indexedAt).getTime();
    if (!existingIndexed && indexed) shouldStore = true;
    else if (existingIndexed && indexed && indexed > existingIndexed) shouldStore = true;
  }

  if (!shouldStore) return;

  postsToStoreInCacheByURI.set(post.uri, post);

  queueStoreEvent();
}

/**
 * @param {string} did
 * @param {string} uri
 * @param {number} time
 */
export function storeLikeToCache(did, uri, time) {
  const shortDID = shortenDID(did);
  let likesByDid = likesToStoreInCacheByShortDIDAndURI.get(shortDID);
  if (!likesByDid)
    likesToStoreInCacheByShortDIDAndURI.set(shortDID, likesByDid = new Map());
  likesByDid.set(uri, time);

  queueStoreEvent();
}

/**
 * @param {string} did
 * @param {string} uri
 * @param {number} time
 */
export function storeRepostToCache(did, uri, time) {
  const shortDID = shortenDID(did);
  let repostsByDid = repostsToStoreInCacheByShortDIDAndURI.get(shortDID);
  if (!repostsByDid)
    repostsToStoreInCacheByShortDIDAndURI.set(shortDID, repostsByDid = new Map());
  repostsByDid.set(uri, time);

  queueStoreEvent();
}

function queueStoreEvent() {
  if (!maxDebounceStoreTimeout)
    maxDebounceStoreTimeout = /** @type {*} */(setTimeout(storeToCacheNow, 3100));
  clearTimeout(debounceStoreTimeout);
  debounceStoreTimeout = /** @type {*} */(setTimeout(storeToCacheNow, 300));
}

function storeToCacheNow() {
  clearTimeout(maxDebounceStoreTimeout);
  maxDebounceStoreTimeout = 0;
  clearTimeout(debounceStoreTimeout);
  debounceStoreTimeout = 0;

  const posts = Array.from(postsToStoreInCacheByURI.values()).map(p => {
    const rec = /** @type {import('@atproto/api').AppBskyFeedPost.Record} */(p.record);
    const wordLeads = [];
    const text = collectPostText(rec, []);
    for (const textChunk of text) {
      populateWordLeads(textChunk, wordLeads);
    }

    let thread = rec.reply?.root?.uri;
    let reply = rec.reply?.parent?.uri;
    let qt;
    if (rec.embed?.$type === 'app.bsky.embed.record') {
      qt = /** @type {import('@atproto/api').AppBskyEmbedRecord.Main} */(rec.embed).record?.uri;
    }

    return {
      uri: p.uri,
      did: p.author.did,
      cid: p.cid,
      time: rec.createdAt && new Date(rec.createdAt).getTime(),
      text,
      thread,
      reply,
      qt,
      w: wordLeads
    };
  });

  const [likes, reposts] =
    [likesToStoreInCacheByShortDIDAndURI, repostsToStoreInCacheByShortDIDAndURI].map(map => {
      return Array.from(map.entries()).map(([shortDID, byURI]) => {
        return Array.from(byURI.entries()).map(([uri, time]) => {
          return {
            did: shortDID,
            uri,
            time
          };
        });
      }).flat();
    });

  postsToStoreInCacheByURI.clear();
  likesToStoreInCacheByShortDIDAndURI.clear();
  repostsToStoreInCacheByShortDIDAndURI.clear();

  if (posts.length) {
    db.records.bulkPut(posts);
    console.log('adding records ', posts.length, ' to cache ', posts);
  }

  if (likes.length) {
    db.likes.bulkPut(likes);
    console.log('adding likes ', likes.length, ' to cache ', likes);
  }

  if (reposts.length) {
    db.reposts.bulkPut(reposts);
    console.log('adding reposts ', reposts.length, ' to cache ', reposts);
  }
}

/**
 * @param {import('@atproto/api').AppBskyFeedPost.Record} post
 * @param {string[]} textArray
 */
function collectPostText(post, textArray) {
  if (!post) return textArray;

  if (post.text) textArray.push(post.text);
  if (post.embed) {
    if (post.embed.images?.length) {
      for (const img of post.embed.images) {
        if (img.alt) textArray.push(img.alt);
        if (img.title) textArray.push(img.title);
      }
    }

    if (post.embed.media?.images?.length) {
      for (const img of post.embed.media.images) {
        if (img.alt) textArray.push(img.alt);
        if (img.title) textArray.push(img.title);
      }
    }
  }

  return textArray;
}

function cacheAccountsNow() {
  clearTimeout(maxDebounceAccountsToStoreInCache);
  maxDebounceAccountsToStoreInCache = 0;
  clearTimeout(debounceAccountsToStoreInCache);
  debounceAccountsToStoreInCache = 0;

  const accounts = Array.from(accountsToStoreInCacheByShortDID.values())
    .map(ac => {
      const wordLeads = [];
      for (const w of breakIntoWords(ac.displayName + ' ' + ac.handle + ' ' + ac.description)) {
        const wLead = w.slice(0, 3).toLowerCase();
        if (wordLeads.indexOf(wLead) < 0)
          wordLeads.push(wLead);
      }
      ac.w = wordLeads;
      return ac;
    });

  accountsToStoreInCacheByShortDID.clear();

  if (accounts.length) {
    db.accounts.bulkPut(accounts);

    console.log('adding accounts ', accounts.length, ' to cache ', accounts);
  }
}

/**
 * @param {string} text
 */
function searchAccountsFromCache(text) {
  const wordLeads = populateWordLeads(text, []);

  return wordLeads.map(async wLead => {
    const dbMatches = await db.accounts.where('w').equals(wLead).toArray();
    return dbMatches;
  });
}

/**
 * @param {(ProfileViewBasic | ProfileView)[]} results
 * @param {string} text
 * @param {string[]} words
 */
function sortResultsByText(results, text, words) {
  const resultsWithHandleJoin = results.map(r => {
    const withHandleJoin = { ...r, handlejoin: (r.handle || '').replace(/[^\w\d]+/g, '').toLowerCase() };
    return withHandleJoin;
  });

  const fuseKeyFields = new Fuse(resultsWithHandleJoin, {
    keys: ['handle', 'displayName', 'description', 'handlejoin'],
    findAllMatches: true,
    includeScore: true
  });

  const fuseAll = new Fuse(results, {
    keys: ['handle', 'displayName', 'description'],
    findAllMatches: true,
    includeScore: true
  });

  const keyFieldsResults = fuseKeyFields.search(text);
  const allResults = fuseAll.search(text);

  /** @type {Record<string, number>} */
  const keyRankByShortDID = {};

  for (const bestResult of keyFieldsResults) {
    if (bestResult.score) {
      const shortDID = shortenDID(bestResult.item.did);
      keyRankByShortDID[shortDID] = bestResult.score;
    }
  }

  /** @type {Record<string, number>} */
  const secondaryRankByShortDID = {};
  for (const bestResult of allResults) {
    if (bestResult.score) {
      const shortDID = shortenDID(bestResult.item.did);
      secondaryRankByShortDID[shortDID] = bestResult.score;
    }
  }

  results.sort((p1, p2) => {
    const shortDID1 = shortenDID(p1.did);
    const shortDID2 = shortenDID(p2.did);

    const keyRank1 = keyRankByShortDID[shortDID1];
    const keyRank2 = keyRankByShortDID[shortDID2];

    if (keyRank1 >=0 && keyRank2 >= 0) {
      if (keyRank1 !== keyRank2) return keyRank1 - keyRank2;
    }

    const secondaryRank1 = secondaryRankByShortDID[shortDID1];
    const secondaryRank2 = secondaryRankByShortDID[shortDID2];

    if (secondaryRank1 >=0 && secondaryRank2 >= 0) {
      if (secondaryRank1 !== secondaryRank2) return secondaryRank1 - secondaryRank2;
    }

    const hasRank1 = keyRank1 >= 0 || secondaryRank1 >= 0;
    const hasRank2 = keyRank2 >= 0 || secondaryRank2 >= 0;

    return (hasRank1 ? 0 : 1) - (hasRank2 ? 0 : 1);
  });
}

const NOT_WORD_CHARACTERS_REGEX = /[^\w\d]+/g;

/**
 * @param {string} text
 */
function breakIntoWords(text) {
  const words = text.split(NOT_WORD_CHARACTERS_REGEX);
  const result = [];
  for (const word of words) {
    if (word.length >=3 && word !== text) result.push(word);
  }
  return result;
}

/**
 * @param {string} searchText
 */
async function directSearchAccountsTypeahead(searchText) {

  const result = (await publicAgent.searchActorsTypeahead({
    q: searchText,
    limit: 100
  })).data?.actors;

  return result;
}

/**
 * @param {string} searchText
 * @param {number} [limit]
 */
async function directSearchAccountsFull(searchText, limit) {

  const result = (await publicAgent.searchActors({
    q: searchText,
    limit: limit || 100
  })).data?.actors;

  return result;
}

/**
 * @param {string | null | undefined} text
 * @param {string[]} result
 */
export function populateWordLeads(text, result) {
  if (!text) return result;

  const words = text.split(NOT_WORD_CHARACTERS_REGEX);
  for (const word of words) {
    if (word.length < 3) continue;

    const wLead = word.slice(0, 3).toLowerCase();
    if (result.indexOf(wLead) < 0)
      result.push(wLead);
  }

  return result;
}

/**
 * @param {string} handleOrDID
 * @returns {AsyncIterable<import('../../coldsky/lib/firehose').FirehoseMessage[]>}
 */
export async function* getProfileHistory(handleOrDID) {
  let profile = likelyDID(handleOrDID) ?
    await resolveDIDFromCache(handleOrDID) :
    await resolveHandleFromCache(handleOrDID);

  if (!profile) {
    for await (const pro of resolveHandleOrDIDToProfile(handleOrDID)) {
      if (pro)
        profile = pro;
    }
  }

  if (!profile) throw new Error('Profile not found: ' + handleOrDID);

  const shortDID = shortenDID(profile.did);

  const recordsPromise = db.records.where('did').equals(shortDID).toArray();
  const likesPromise = db.likes.where('did').equals(shortDID).toArray();
  const repostsPromise = db.reposts.where('did').equals(shortDID).toArray();



}

async function* getProfileHistoryViaListRecords(shortDID) {
  const pds = await getPDS(shortDID);

  if (!pds) throw new Error('No PDS for DID: ' + shortDID);

  
}

async function getPDS(shortDID) {
  const plcEntries = await resolvePlcDirectly(shortDID);
  for (let i = 0; i < plcEntries.length; i++) {
    const fromEnd = plcEntries[plcEntries.length - i - 1];

    const pdsEndpoint =
      fromEnd.operation?.services?.atproto_pds?.endpoint;
    
    if (pdsEndpoint) return pdsEndpoint;
  }
}


