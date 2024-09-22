// @ts-check

import { isCompactPost } from '..';
import { streamEvery } from '../../../package/akpa';
import { ColdskyAgent } from '../../coldsky-agent';
import { plcDirectoryHistoryRaw } from '../../plc-directory';
import { unwrapShortDID, unwrapShortHandle } from '../../shorten';
import { breakIntoWords } from '../capture-records/compact-post-words';
import { getPostOnly } from './get-post-only';
import { syncRepo } from './sync-repo';

/**
 * @typedef {{
 *  shortDID: string | null | undefined,
 *  searchQuery: string | null | undefined,
 *  likesAndReposts?: boolean | undefined,
 *  agent_getProfile_throttled: (did) => ReturnType<import('@atproto/api').BskyAgent['getProfile']>,
 *  agent_resolveHandle_throttled: (handle) => ReturnType<import('@atproto/api').BskyAgent['resolveHandle']>,
 *  agent_searchPosts_throttled: (q: string, limit: number | undefined, sort: string | undefined, cursor?: string) => ReturnType<import('@atproto/api').BskyAgent['app']['bsky']['feed']['searchPosts']>,
 *  agent_getRepoRecord_throttled: (repo, rkey, collection) => ReturnType<import('@atproto/api').BskyAgent['com']['atproto']['repo']['getRecord']>,
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
  const { shortDID, searchQuery, likesAndReposts, dbStore, agent_searchPosts_throttled } = args;

  let REPORT_UPDATES_FREQUENCY_MSEC = 700;

  const cachedMatchesPromise = dbStore.searchPosts(shortDID, searchQuery, likesAndReposts);
  /** @type {Set<string> | undefined} */
  const missingLikesAndReposts = !likesAndReposts ? undefined : new Set();
  const allCachedHistoryPromise = !searchQuery ? cachedMatchesPromise :
    dbStore.searchPosts(shortDID, undefined, likesAndReposts, missingLikesAndReposts);

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

  const parallelSearch = streamEvery(
    /** @param {import('../../../package/akpa').StreamParameters<import('..').CompactPost[] | undefined>} streaming  */
    streaming => {
      const words = breakIntoWords(searchQuery || '');
      words.unshift(searchQuery || '');

      const waitForAllCompletionPromises = [];
      let fullRepoIndexed = false;

      const waitUntilPageIndexed = Promise.race([
        fetchPaginatedAndIndex(),
        downloadFullRepoAndIndex()]);
      waitForAllCompletionPromises.push(waitUntilPageIndexed);

      for (const word of words) {
        waitForAllCompletionPromises.push(searchForWord(word));
      }

      Promise.all(waitForAllCompletionPromises.map(p => p.catch(() => { })))
        .then(() => {
          streaming.complete();
        });

      async function fetchPaginatedAndIndex() {
        for await (const batch of indexAccountHistoryPostsFromRepository(args)) {
          if (fullRepoIndexed) return;
          streaming.yield(batch);
        }
      }

      /** @param {string} word */
      async function searchForWord(word) {
        const wordSearchQuery =
          'from:' + unwrapShortHandle(profile?.handle || '') + 
          ' ' + word;
        const searchResult = await agent_searchPosts_throttled(wordSearchQuery, undefined, 'latest');
        const batch = [];
        if (searchResult?.data?.posts?.length) {
          for (const postRaw of searchResult.data.posts) {
            if (fullRepoIndexed) return;
            const post = dbStore.capturePostView(postRaw, Date.now());
            if (post) batch.push(post);
          }
        }

        streaming.yield(batch);
      }

      async function downloadFullRepoAndIndex() {
        const postsAndProfiles = await syncRepo({
          ...args,
          shortDID
        });

        const ownPostsOnly =
          !postsAndProfiles ? [] :
            /** @type {import('..').CompactPost[]} */(
              postsAndProfiles.filter(post =>
                isCompactPost(post) && post.shortDID === shortDID)
            );

        streaming.yield(ownPostsOnly);
        fullRepoIndexed = true;
      }
    });
  
  /** @type {ReturnType<typeof getPostOnly>[]} */
  let queuedMissingLikesAndReposts = [];
  const addMissingLikesAndRepostsToTheQueue = () => {
    if (missingLikesAndReposts && missingLikesAndReposts.size > queuedMissingLikesAndReposts.length) {
      const arr = [...missingLikesAndReposts];
      for (let i = queuedMissingLikesAndReposts.length; i < arr.length; i++) {
        const uri = arr[i];
        queuedMissingLikesAndReposts[i] = getPostOnly({
          uri,
          dbStore,
          agent_getRepoRecord_throttled: args.agent_getRepoRecord_throttled
        });
      }
    }
  };

  for await (const searchResult of parallelSearch) {
    if (searchResult) {
      if (!processedBatch) processedBatch = searchResult;
      else processedBatch = processedBatch.concat(searchResult);
    }

    if (Date.now() - lastSearchReport > REPORT_UPDATES_FREQUENCY_MSEC) {
      /** @type {import('.').IncrementalMatchCompactPosts} */
      const newMatches = await dbStore.searchPosts(shortDID, searchQuery, likesAndReposts, missingLikesAndReposts);
      addMissingLikesAndRepostsToTheQueue();

      lastMatches = newMatches;
      lastSearchReport = Date.now();
      anyUpdates = false;
      newMatches.processedBatch = processedBatch;
      if (!newMatches.processedAllCount)
        newMatches.processedAllCount = knownHistoryUri.size;

      processedBatch = undefined;
      yield newMatches;
      lastSearchReport = Date.now();
    }
  }

  if (queuedMissingLikesAndReposts.length) {
    await Promise.all(queuedMissingLikesAndReposts);
  }

  /** @type {import('.').IncrementalMatchCompactPosts} */
  const finalMatches = await dbStore.searchPosts(shortDID, searchQuery, likesAndReposts, missingLikesAndReposts);
  addMissingLikesAndRepostsToTheQueue();
  finalMatches.processedBatch = processedBatch;
  if (!finalMatches.processedAllCount)
    finalMatches.processedAllCount = knownHistoryUri.size;
  processedBatch = undefined;
  yield finalMatches;
}

/**
 * @param {Args} args
 */
async function* indexAccountHistoryPostsFromRepository(args) {
  const { shortDID, dbStore } = args;

  const plcDirHistoryPromise = plcDirectoryHistoryRaw(/** @type {string} */(shortDID));

  /** @type {import('..').CompactPost[] | undefined}  */
  let processedBatch;

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
      }
    }

    yield processedBatch;

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