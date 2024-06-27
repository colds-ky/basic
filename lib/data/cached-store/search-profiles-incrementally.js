// @ts-check

import { breakIntoWords } from '../capture-records/compact-post-words';

/**
 * @typedef {{
 *  searchQuery: string,
 *  max?: number,
 *  agent_searchActorsTypeAhead_throttled: (q: string, limit: number | undefined) => ReturnType<import('@atproto/api').BskyAgent['searchActorsTypeahead']>
 *  agent_searchActors_throttled: (q: string, limit: number | undefined) => ReturnType<import('@atproto/api').BskyAgent['searchActors']>
 *  dbStore: ReturnType<typeof import('../define-cache-indexedDB-store').defineCacheIndexedDBStore>
 * }} Args
 */

/**
 * @param {Args} args
 */
export async function* searchProfilesIncrementally(args) {
  const { searchQuery, max, dbStore } = args;

  const localSearchPromise = dbStore.searchProfiles(searchQuery, max ? { max } : undefined);

  const normalizedText = searchQuery?.trim() || '';
  if (!normalizedText) return (async function* nothing() { })();

  const wholeTextSearchTypeahedPromise = directSearchAccountsTypeahead({ ...args, searchQuery: normalizedText });
  const wholeTextSearchFullPromise = directSearchAccountsFull({ ...args, searchQuery: normalizedText });

  const words = breakIntoWords(normalizedText);
  const wordSearchTypeaheadPromises = words.map(word => directSearchAccountsTypeahead({ ...args, searchQuery: word }));
  const wordSearchFullPromises = words.map(word => directSearchAccountsFull({ ...args, searchQuery: word }));

  const localResult = await localSearchPromise;
  if (localResult?.length) {
    yield localResult;
  }

  const searchResponses = await Promise.all([
    wholeTextSearchTypeahedPromise,
    wholeTextSearchFullPromise,
    ...wordSearchTypeaheadPromises,
    ...wordSearchFullPromises
  ]);

  for (const searchMatchList of searchResponses) {
    for (const searchMatch of searchMatchList) {
      dbStore.captureProfileView(searchMatch, Date.now());
    }
  }

  const refreshedSearch = await dbStore.searchProfiles(searchQuery, max ? { max } : undefined);
  return refreshedSearch;
}

/**
* @param {Args} args
*/
async function directSearchAccountsTypeahead(args) {
  const { searchQuery, agent_searchActorsTypeAhead_throttled } = args;

  const result = (await agent_searchActorsTypeAhead_throttled(searchQuery, 100)).data?.actors;

  return result;
}

/**
 * @param {Args} args
 */
async function directSearchAccountsFull(args) {
  const { searchQuery, agent_searchActors_throttled } = args;

  const result = (await agent_searchActors_throttled(searchQuery, 100)).data?.actors;

  return result;
}
