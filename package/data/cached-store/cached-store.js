// @ts-check

import { AtpAgent } from '@atproto/api';

import { BSKY_PUBLIC_URL, ColdskyAgent } from '../../coldsky-agent';
import { throttledAsyncCache } from '../../throttled-async-cache';
import { defineCacheIndexedDBStore } from '../define-cache-indexedDB-store';
import { firehose } from './firehose';
import { getPostOnly } from './get-post-only';
import { getPostThreadIncrementally } from './get-post-thread-incrementally';
import { getProfileIncrementally } from './get-profile-incrementally';
import { getTimelineIncrementally } from './get-timeline-incrementally';
import { searchPostsIncrementally } from './search-posts-incrementally';
import { searchProfilesIncrementally } from './search-profiles-incrementally';
import { syncRepo } from './sync-repo';

/** @typedef {import('..').CompactPost} CompactPost */
/** @typedef {import('..').CompactProfile} CompactProfile */
/** @typedef {import('..').MatchCompactPost} MatchCompactPost */
/** @typedef {import('..').CompactThreadPostSet} CompactThreadPostSet */

/**
 * @param {{
 *  dbName?: string,
 *  service?: string
 * }} [options]
 */
export function defineCachedStore({ dbName, service } = {}) {
  const dbStore = defineCacheIndexedDBStore(dbName);

  const agent = /** @type {*} */(new ColdskyAgent({
    service: service || BSKY_PUBLIC_URL
  }));

  const agent_getProfile_throttled = throttledAsyncCache(actor => agent.getProfile({ actor }));
  const agent_resolveHandle_throttled = throttledAsyncCache(handle => agent.com.atproto.identity.resolveHandle({ handle }));

  const agent_getPostThread_throttled = throttledAsyncCache(uri => agent.getPostThread({ uri }));

  const agent_getRepoRecord_throttled = throttledAsyncCache((repo, rkey, collection) => {
    const postRecordPromise = agent.com.atproto.repo.getRecord({
      repo,
      rkey,
      collection,
    });
    return postRecordPromise;
  });

  const agent_searchActorsTypeAhead_throttled = throttledAsyncCache((q, limit) => agent.searchActorsTypeahead({ q, limit }));
  const agent_searchActors_throttled = throttledAsyncCache((q, limit) => agent.searchActors({ q, limit }));

  const agent_searchPosts_throttled = throttledAsyncCache((q, limit, sort, cursor) => agent.app.bsky.feed.searchPosts({ q, limit, sort, cursor }));

  return {
    firehose: () =>
      firehose(dbStore),

    /** @param {string | null | undefined} uri */
    getPostOnly: (uri) =>
      getPostOnly({ uri, dbStore, agent_getRepoRecord_throttled }),

    /** @param {string | null | undefined} uri */
    getPostThreadIncrementally: (uri) =>
      getPostThreadIncrementally({ uri, dbStore, agent_getPostThread_throttled }),

    /** @param {string | null | undefined} didOrHandle */
    getProfileIncrementally: (didOrHandle) =>
      getProfileIncrementally({
        didOrHandle,
        dbStore,
        agent_getProfile_throttled,
        agent_resolveHandle_throttled
      }),

    /**
     * @param {string | null | undefined} shortDID
     * @param {string | null | undefined} searchQuery
     * @param {boolean} [likesAndReposts]
     */
    searchPostsIncrementally: (shortDID, searchQuery, likesAndReposts) =>
      searchPostsIncrementally({
        shortDID,
        searchQuery,
        likesAndReposts,
        dbStore,
        agent_getProfile_throttled,
        agent_resolveHandle_throttled,
        agent_searchPosts_throttled,
        agent_getRepoRecord_throttled
      }),

    searchProfilesIncrementally: (searchQuery, max) =>
      searchProfilesIncrementally({
        searchQuery,
        max,
        dbStore,
        agent_searchActorsTypeAhead_throttled,
        agent_searchActors_throttled
      }),

    /**
     * @param {string | null | undefined} shortDID
     * @param {string | null | undefined} searchQuery
     * @param {boolean} [likesAndReposts]
     */
    getTimelineIncrementally: (shortDID, searchQuery, likesAndReposts) =>
      getTimelineIncrementally({
        shortDID,
        searchQuery,
        likesAndReposts,
        dbStore,
        agent_getProfile_throttled,
        agent_resolveHandle_throttled,
        agent_getPostThread_throttled,
        agent_searchPosts_throttled,
        agent_getRepoRecord_throttled
      }),
    
    syncRepo: (shortDID) =>
      syncRepo({
        shortDID,
        dbStore,
        agent_getProfile_throttled,
        agent_resolveHandle_throttled
      })
  };

}

/** @param {string} search */
export function extractKnownArguments(search) {
  let toArguments = [];
  let dateOrTimeArguments = [];
  const reducedSearch = search.replace(
    /\s?(to\:([^\s]+))|(date|time\:([^\s]+))\s?/g,
    (m, to, toSlice, dateOrTime, dateSlice) => {
      let anyMatched = false;
      if (toSlice) {
        anyMatched = true;
        toArguments.push(toSlice);
      }

      const dt = new Date(dateSlice);
      if (dt.getTime() > 0) {
        dateOrTimeArguments.push(dt);
        anyMatched = true;
      }

      if (anyMatched) return ' ';
      else return m;
    });

  if (toArguments?.length || dateOrTimeArguments?.length)
    return { to: toArguments, dateOrTime: dateOrTimeArguments, reduced: reducedSearch.trim() };
}
