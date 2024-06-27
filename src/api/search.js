// @ts-check

import { breakIntoWords } from '../../coldsky/lib/data/capture-records/compact-post-words';
import { BSKY_PUBLIC_URL, ColdskyAgent, shortenDID } from '../../coldsky/libs';
import { streamBuffer } from '../../coldsky/src/api/akpa';

/** @typedef {import ('@atproto/api/dist/client/types/app/bsky/actor/defs').ProfileView} ProfileView */
/** @typedef {import ('@atproto/api/dist/client/types/app/bsky/actor/defs').ProfileViewBasic} ProfileViewBasic */
/** @typedef {import ('@atproto/api/dist/client/types/app/bsky/actor/defs').ProfileViewDetailed} ProfileViewDetailed */
/** @typedef {import('../../coldsky/lib').CompactProfile} CompactProfile */

/**
 * @typedef {CompactProfile &
 *  Omit<import('fuse.js').default.FuseResult<any>, 'item'>} MatchCompactProfile
 */

/**
 * @param {{
 *  text: string,
 *  db: ReturnType<typeof import('../').useDB>,
 *  max?:  number
 * }} _
 */
export function searchAccounts({ text, db, max }) {
  /** @type {import('@atproto/api').BskyAgent} */
  const publicAgent = /** @type {*} */(
    new ColdskyAgent({
      service: BSKY_PUBLIC_URL
    }));

  const normalizedText = text?.trim() || '';
  if (!normalizedText) return (async function* nothing() { })();

  const wholeTextSearchTypeahedPromise = directSearchAccountsTypeahead(normalizedText);
  const wholeTextSearchFullPromise = directSearchAccountsFull(normalizedText);

  const words = breakIntoWords(normalizedText);
  const wordSearchTypeaheadPromises = words.map(word => directSearchAccountsTypeahead(word));
  const wordSearchFullPromises = words.map(word => directSearchAccountsFull(word));

  return streamBuffer(
    /**
     * 
     * @param {import('../../coldsky/src/api/akpa').StreamParameters<
     *  MatchCompactProfile[],
     *  MatchCompactProfile[]>} streaming 
     */
    async streaming => {
      /**
       * @type {CompactProfile[]}
       */
      const results = [];

      /**
       * @type {Record<string, CompactProfile>}
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

      await Promise.all(waitFor);
      streaming.complete();

      /**
       * @param {Promise<(ProfileView |ProfileViewBasic)[]>} promise 
       */
      async function awaitPromiseAndMerge(promise) {

        const resultRaw = await promise;
        const now = Date.now();
        for (const entry of resultRaw) {
          db.captureProfileView(entry, now);
        }

        const fuseMatches = await db.searchProfiles(normalizedText, { max });
        const results = fuseMatches?.map(fuseMatch => {
          return {
            ...fuseMatch,
            ...fuseMatch.item,
            item: undefined
          };
        }) || [];

        streaming.yield(
          results,
          () => results);
      }
    });

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
}

/**
 * @param {CompactProfile[]} buf
 * @param {string} text
 */
function applySearch(buf, text) {

}
