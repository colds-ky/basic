// @ts-check

import Dexie from 'dexie';
import { ColdskyAgent, shortenDID } from '../../coldsky/lib';
import { BSKY_PUBLIC_URL } from '../../coldsky/lib/coldsky-agent';
import { streamBuffer } from '../../coldsky/src/api/akpa';
import Fuse from 'fuse.js';

const db = new Dexie("atproto-cache");
db.version(4).stores({
  records: 'uri, did, cid, time, *w',
  accounts: 'did, *w'
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
let debouncePostsToStoreInCache = 0;
let maxDebouncePostsToStoreInCache = 0;

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

  if (!maxDebouncePostsToStoreInCache)
    maxDebouncePostsToStoreInCache = setTimeout(cachePostsNow, 3100);
  clearTimeout(debouncePostsToStoreInCache);
  debouncePostsToStoreInCache = setTimeout(cachePostsNow, 300);
}

function cachePostsNow() {
  clearTimeout(maxDebouncePostsToStoreInCache);
  maxDebouncePostsToStoreInCache = 0;
  clearTimeout(debouncePostsToStoreInCache);
  debouncePostsToStoreInCache = 0;

  const posts = Array.from(postsToStoreInCacheByURI.values()).map(p => {
    const wordLeads = [];
    const text = collectPostText(p.record, []);
    for (const textChunk of text) {
      populateWordLeads(textChunk, wordLeads);
    }

    return {
      uri: p.uri,
      did: p.author.did,
      cid: p.cid,
      time: p.record.createdAt && new Date(p.record.createdAt).getTime(),
      text,
      w: wordLeads
    };
  });

  postsToStoreInCacheByURI.clear();
  if (posts.length) {
    db.records.bulkPut(posts);

    console.log('adding records ', posts.length, ' to cache ', posts);

  }
}

/**
 * @param {import('../../coldsky/lib/firehose').FirehoseMessageOfType<'app.bsky.feed.post'> | undefined} post
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
 */
async function directSearchAccountsFull(searchText) {

  const result = (await publicAgent.searchActors({
    q: searchText,
    limit: 100
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
