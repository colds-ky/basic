// @ts-check

import { BskyAgent } from '@atproto/api';

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
import { unwrapShortDID } from '../../shorten';

/** @typedef {import('..').CompactPost} CompactPost */
/** @typedef {import('..').CompactProfile} CompactProfile */
/** @typedef {import('..').MatchCompactPost} MatchCompactPost */
/** @typedef {import('..').CompactThreadPostSet} CompactThreadPostSet */

/**
 * @param {{
 *  dbName?: string,
 *  fetch?: import('@atproto/api').AtpAgentFetchHandler,
 *  service?: string
 * }} _
 */
export function defineCachedStore({ dbName, fetch: fetchOverride, service }) {
  const dbStore = defineCacheIndexedDBStore(dbName);

  /**
   * @type {BskyAgent}
   */
  const agent = /** @type {*} */(new ColdskyAgent({
    fetch: fetchOverride,
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
     */
    searchPostsIncrementally: (shortDID, searchQuery) =>
      searchPostsIncrementally({
        shortDID,
        searchQuery,
        dbStore,
        agent_searchPosts_throttled
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
     */
    getTimelineIncrementally: (shortDID, searchQuery) =>
      getTimelineIncrementally({
        shortDID,
        searchQuery,
        dbStore,
        agent_getPostThread_throttled,
        agent_searchPosts_throttled
    })
  };

}
