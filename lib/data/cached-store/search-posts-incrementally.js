// @ts-check

import { ColdskyAgent } from '../../coldsky-agent';
import { plcDirectoryHistoryRaw } from '../../plc-directory';
import { unwrapShortDID } from '../../shorten';

/**
 * @typedef {{
 *  shortDID: string | null | undefined,
 *  searchQuery: string | null | undefined,
 *  agent_searchPosts_throttled: (q: string, limit: number | undefined, sort: string | undefined, cursor?: string) => ReturnType<import('@atproto/api').BskyAgent['app']['bsky']['feed']['searchPosts']>
 *  dbStore: ReturnType<typeof import('../define-cache-indexedDB-store').defineCacheIndexedDBStore>
 * }} Args
 */

/**
 * @param {Args} args
 * @returns {[] | AsyncGenerator<import('.').IncrementalMatchCompactPosts>}
 */
export function searchPostsIncrementally(args) {
  const { shortDID, searchQuery } = args;
  if (shortDID) {
    return searchAccountHistoryPostsIncrementally(args);
  } else if (!searchQuery) {
    return [];
  } else {
    return searchAllPostsIncrementally(args);
  }
}

/**
 * @param {Args} args
 */
export async function* searchAccountHistoryPostsIncrementally(args) {
  const { shortDID, searchQuery, dbStore } = args;

  let REPORT_UPDATES_FREQUENCY_MSEC = 700;

  const cachedMatchesPromise = dbStore.searchPosts(shortDID, searchQuery);
  const allCachedHistoryPromise = !searchQuery ? cachedMatchesPromise :
    dbStore.searchPosts(shortDID, undefined);

  const plcDirHistoryPromise = plcDirectoryHistoryRaw(/** @type {string} */(shortDID));

  let lastSearchReport = 0;
  /** @type {import('..').CompactPost[] | undefined}  */
  let processedBatch;
  let anyUpdates = false;

  /** @type {import('.').IncrementalMatchCompactPosts | undefined} */
  let lastMatches = await cachedMatchesPromise;

  const allHistory = await allCachedHistoryPromise;

  /** @type {Set<string> | undefined} */
  let knownHistoryUri = new Set((allHistory || []).map(rec => rec.uri));

  if (lastMatches?.length) {
    lastMatches.cachedOnly = true;
    lastMatches.processedAllCount = knownHistoryUri.size;
    lastMatches.processedBatch = allHistory.slice();
    lastSearchReport = Date.now();
    yield lastMatches;
  }

  const plcDirHistoryRecords = await plcDirHistoryPromise;
  dbStore.capturePlcDirectoryEntries(plcDirHistoryRecords);
  const profile = await dbStore.getProfile(/** @type {string} */(shortDID));

  const pdsAgent = new ColdskyAgent({
    service: profile?.history?.[0].pds
  });

  let cursor = '';
  const fullDID = unwrapShortDID(/** @type {string} */(shortDID));
  while (true) {
    const moreData = await pdsAgent.com.atproto.repo.listRecords({
      repo: unwrapShortDID(/** @type {string} */(shortDID)),
      cursor,
      collection: 'app.bsky.feed.post',
      limit: Math.random() * 10 + 88
    });

    if (moreData?.data?.records?.length) {
      for (const rec of moreData.data.records) {
        /** @type {import('../../firehose').FirehoseRecord$Typed<'app.bsky.feed.post'>} */
        const recEx = /** @type {*} */(rec.value);
        recEx.$type = 'app.bsky.feed.post';
        recEx.uri = rec.uri;
        recEx.repo = fullDID;
        const post = /** @type {import('..').CompactPost} */(dbStore.captureRecord(recEx, Date.now()));
        if (post) {
          if (!processedBatch) processedBatch = [post];
          else processedBatch.push(post);
        }

        if (!knownHistoryUri.has(rec.uri)) {
          knownHistoryUri.add(rec.uri);
          anyUpdates = true;
        }
      }
    }

    if (anyUpdates || Date.now() - lastSearchReport > REPORT_UPDATES_FREQUENCY_MSEC) {

      /** @type {import('.').IncrementalMatchCompactPosts} */
      const newMatches = await dbStore.searchPosts(shortDID, searchQuery);
      lastMatches = newMatches;
      lastSearchReport = Date.now();
      anyUpdates = false;
      newMatches.processedBatch = processedBatch;
      newMatches.processedAllCount = knownHistoryUri.size;
      processedBatch = undefined;
      yield newMatches;
      lastSearchReport = Date.now();
    }

    if (!moreData?.data?.cursor) break;
    cursor = moreData.data.cursor;
  }

}


/**
 * @param {Args} args
 * @returns {AsyncGenerator<import('.').IncrementalMatchCompactPosts>}
 */
async function* searchAllPostsIncrementally(args) {
  const { searchQuery, dbStore, agent_searchPosts_throttled } = args;

  const searchStringSanitised = (searchQuery || '')
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ');

  let remoteSearchLatestPromise = agent_searchPosts_throttled(
    searchStringSanitised,
    97,
    'latest');

  const localResultsPromise = dbStore.searchPosts(undefined, searchQuery);
  /** @type {import('..').MatchCompactPost[] & { cachedOnly?: boolean }} */
  const localResults = await localResultsPromise;
  if (localResults?.length) {
    localResults.cachedOnly = true;
    yield localResults;
  }

  let cursor = '';
  while (true) {
    const remoteSearchData = (await remoteSearchLatestPromise).data;

    const now = Date.now();
    for (const postRaw of remoteSearchData?.posts || []) {
      dbStore.capturePostView(postRaw, now);
    }

    const refreshedResults = await dbStore.searchPosts(undefined, searchQuery);

    if (remoteSearchData?.cursor) {
      cursor = remoteSearchData.cursor;
      remoteSearchLatestPromise = agent_searchPosts_throttled(
        searchStringSanitised,
        97,
        'latest',
        cursor);
    }

    if (refreshedResults?.length) {
      yield refreshedResults;
    }

    if (!remoteSearchData?.cursor) break;
  }
}