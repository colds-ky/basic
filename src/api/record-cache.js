// @ts-check

import Dexie from 'dexie';
import { ColdskyAgent, shortenDID } from '../../coldsky/lib';
import { BSKY_PUBLIC_URL } from '../../coldsky/lib/coldsky-agent';
import { streamBuffer } from '../../coldsky/src/api/akpa';
import Fuse from 'fuse.js';

const db = new Dexie("atproto-record-cache");
db.version(3).stores({
  records: 'did, cid, time',
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
  const cachedResults = searchAccountsFromCache([...words, normalizedText]);

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
      const wordLeads = [];
      for (const w of breakIntoWords(ac.displayName + ' ' + ac.handle + ' ' + ac.description)) {
        const wLead = w.slice(0, 3).toLowerCase();
        if (wordLeads.indexOf(wLead) < 0)
          wordLeads.push(wLead);
      }
      ac.w = wordLeads;
      return ac;
    });
    storeNewAccountsByShortDID.clear();
    db.accounts.bulkPut(accounts);
  }
}

/**
 * @param {string[]} words
 */
function searchAccountsFromCache(words) {
  const wordLeads = [];
  for (const w of words) {
    const wLead = w.slice(0, 3).toLowerCase();
    if (wordLeads.indexOf(wLead) < 0)
      wordLeads.push(wLead);
  }

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
