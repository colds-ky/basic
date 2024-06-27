// @ts-check

import { throttledAsyncCache } from '../../throttled-async-cache';
import { getPostThreadIncrementally } from './get-post-thread-incrementally';
import { searchAccountHistoryPostsIncrementally } from './search-posts-incrementally';

/**
 * @typedef {{
 *  shortDID: string | null | undefined,
 *  searchQuery: string | null | undefined,
 *  agent_searchPosts_throttled: import('./search-posts-incrementally').Args['agent_searchPosts_throttled'],
 *  agent_getPostThread_throttled: (uri) => ReturnType<import('@atproto/api').BskyAgent['getPostThread']>,
 *  dbStore: ReturnType<typeof import('../define-cache-indexedDB-store').defineCacheIndexedDBStore>
 * }} Args
 */

/**
 * @param {Args} args
 * @returns {AsyncGenerator<import('.').IncrementalMatchThreadResult>}
 */
export async function* getTimelineIncrementally(args) {
  const { shortDID, searchQuery } = args;
  const enrichPostToThreadParallel = throttledAsyncCache(
  /**
   * @param {string} uri
   * @param {boolean} shallow
   */
    (uri, shallow) => enrichPostToThread({ ...args, uri, shallow }),
    {
      maxConcurrency: 10,
      interval: 1
    });

  let REPORT_INTERVAL_MSEC = 700;
  let PARALLELISE_THREAD_BATCH = 20;

  /** @type {import('..').CompactThreadPostSet[]} */
  let timeline = [];
  let lastReportTimestamp = Date.now() - REPORT_INTERVAL_MSEC / 2;

  /** @type {Map<string, number>} */
  let latestRelevantPostForThreadRootUri = new Map();

  /** @type {import('.').IncrementalMatchThreadResult | undefined} */
  let report;

  const searchPostIterator = searchAccountHistoryPostsIncrementally({
    ...args,
    shortDID, searchQuery
  });

  for await (const entries of searchPostIterator) {
    // start enriching posts to threads from the most recent
    entries.sort((a, b) => (b.asOf || 0) - (a.asOf || 0));

    let anyReported = false;
    for (let iEntry = 0; iEntry < entries.length; iEntry += PARALLELISE_THREAD_BATCH) {
      /** @type {typeof entries} */
      const entriesBatch = entries.slice(iEntry, iEntry + PARALLELISE_THREAD_BATCH);
      entriesBatch.cachedOnly = entries.cachedOnly;
      entriesBatch.processedAllCount = entries.processedAllCount;
      entriesBatch.processedBatch = entries.processedBatch;

      for await (const report of processEntriesAndProduceBatchIfRequired(entriesBatch)) {
        if (report) {
          anyReported = true;
          yield report;
        }
      }
    }

    if (!anyReported) {
      /** @type {import('.').IncrementalMatchThreadResult} */
      const dummyBatch = timeline.slice();
      dummyBatch.cachedOnly = entries.cachedOnly;
      dummyBatch.processedAllCount = entries.processedAllCount;
      dummyBatch.processedBatch = entries.processedBatch;
      if (!report) report = dummyBatch;
      yield dummyBatch;
    }
  }

  
  /** @type {import('.').IncrementalMatchThreadResult} */
  const completeReport = timeline.slice();
  completeReport.cachedOnly = false;
  completeReport.processedAllCount =
    report ? report.processedAllCount : 0;
  completeReport.processedBatch = report?.processedBatch;
  completeReport.complete = true;
  yield completeReport;

  /**
   * @param {import('.').IncrementalMatchCompactPosts} entries
   */

  async function* processEntriesAndProduceBatchIfRequired(entries) {
    const threadPromises = entries.map(entry =>
      enrichPostToThreadParallel(
        entry.threadStart || entry.uri,
          /* shallow */ !!entries.cachedOnly));

    /** @type {Map<string, import('..').CompactPost>} */
    const searchMatchPosts = new Map();
    for (const post of entries) {
      searchMatchPosts.set(post.uri, post);

      if (!post.asOf) continue;
      const threadRootUri = post.threadStart || post.uri;
      let existingTimestamp = latestRelevantPostForThreadRootUri.get(threadRootUri);
      if (!existingTimestamp || existingTimestamp < post.asOf)
        latestRelevantPostForThreadRootUri.set(threadRootUri, post.asOf);
    }

    let reportDue = false;
    for (const threadPromise of threadPromises) {
      let postThreadRetrieved = await threadPromise;
      if (!postThreadRetrieved) continue;

      // Replace posts with search matches
      postThreadRetrieved = {
        ...postThreadRetrieved,
        all: postThreadRetrieved.all.map(post => searchMatchPosts.get(post.uri) || post),
        current: searchMatchPosts.get(postThreadRetrieved.current.uri) || postThreadRetrieved.current,
        root: searchMatchPosts.get(postThreadRetrieved.root.uri) || postThreadRetrieved.root
      };

      const timelineIndex = timeline.findIndex(t => t.root.uri === postThreadRetrieved.root.uri);
      if (timeline[timelineIndex] === postThreadRetrieved) continue;

      if (timelineIndex >= 0) timeline[timelineIndex] = postThreadRetrieved;
      else timeline.push(postThreadRetrieved);

      const now = Date.now();

      if (now - lastReportTimestamp > REPORT_INTERVAL_MSEC) {
        const report = makeReport();
        yield report;
      } else {
        reportDue = true;
      }
    }

    if (reportDue) {
      const report = makeReport();
      yield report;
    }

    function makeReport() {
      timeline.sort((a, b) => {
        const aTimestamp = latestRelevantPostForThreadRootUri.get(a.root.uri) || 0;
        const bTimestamp = latestRelevantPostForThreadRootUri.get(b.root.uri) || 0;
        return bTimestamp - aTimestamp;
      });

      /** @type {import('.').IncrementalMatchThreadResult | undefined} */
      const report = timeline.slice();

      report.cachedOnly = entries.cachedOnly;
      report.processedBatch = entries.processedBatch;
      report.processedAllCount = entries.processedAllCount;
      lastReportTimestamp = Date.now();
      reportDue = false;

      return report;
    }
  }
}

/**
 * @param {import( './get-post-thread-incrementally').Args & { shallow: boolean }} args
 */
async function enrichPostToThread(args) {
  try {
    let enrichedThread;
    for await (const thread of getPostThreadIncrementally(args)) {
      if (thread && args.shallow) return thread;
      if (thread) enrichedThread = thread;
    }
    return enrichedThread;
  } catch (error) {
    console.warn('Post ' + args.uri + ' could not be retrieved ', error);
  }
}
