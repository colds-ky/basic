// @ts-check

import { BskyAgent } from '@atproto/api';
import { ColdskyAgent } from '../../lib/coldsky-agent';
import { BSKY_PUBLIC_URL } from '../coldsky-agent';
import { firehose as rawFirehose } from '../firehose';
import { isPromise } from '../is-promise';
import { breakFeedUri, breakPostURL, likelyDID, makeFeedUri, shortenDID, unwrapShortDID, unwrapShortHandle } from '../shorten';
import { defineCacheIndexedDBStore } from './define-cache-indexedDB-store';
import { throttledAsyncCache } from '../throttled-async-cache';
import { breakIntoWords } from './capture-records/compact-post-words';
import { plcDirectoryHistoryCompact, plcDirectoryHistoryRaw } from '../plc-directory';

/** @typedef {import('.').CompactPost} CompactPost */
/** @typedef {import('.').CompactProfile} CompactProfile */
/** @typedef {import('.').MatchCompactPost} MatchCompactPost */

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
    firehose,
    getPostOnly,
    getPostThreadIncrementally,
    getProfileIncrementally,
    searchPostsIncrementally,
    searchProfilesIncrementally
  };

  /**
   * @returns {AsyncGenerator<import('.').CompactFirehoseBlock>}
   */
  async function* firehose() {
    for await (const blockSet of rawFirehose()) {
      /** @type {Map<string, CompactPost>} */
      const updatedPosts = new Map();
      /** @type {Map<string, CompactProfile>} */
      const updatedProfiles = new Map();

      /** @type {import('../firehose').FirehoseRecord[]} */
      const messages = [];

      /** @type {import('../firehose').FirehoseRecord[] | undefined} */
      let deletes;

      /** @type {import('../firehose').FirehoseRecord[] | undefined} */
      let unexpecteds;

      for (const block of blockSet) {
        if (block.messages) {
          for (const rec of block.messages) {
            messages.push(rec);
            const updated = dbStore.captureRecord(rec, block.receiveTimestamp);
            if (updated) {
              if ('uri' in updated) updatedPosts.set(updated.uri, updated);
              else updatedProfiles.set(updated.shortDID, updated);
            }
          }
        }

        if (block.deletes?.length) {
          if (!deletes) deletes = [];
          for (const rec of block.deletes) {
            dbStore.deleteRecord(rec);
            deletes.push(rec);
          }
        }

        if (block.unexpected?.length) {
          if (!unexpecteds) unexpecteds = block.unexpected;
          else if (block.unexpected.length === 1) unexpecteds.push(block.unexpected[0]);
          else unexpecteds = unexpecteds.concat(block.unexpected);
        }
      }

      yield {
        messages,
        posts: [...updatedPosts.values()],
        profiles: [...updatedProfiles.values()],
        deletes,
        unexpecteds
      };
    }
  }

  /**
   * @param {string | null | undefined} uri
   */
  function getPostOnly(uri) {
    if (!uri) return;
    const dbPost = dbStore.getPostOnly(uri);
    if (dbPost && !isPromise(dbPost) && !dbPost.placeholder) return dbPost;

    if (!dbPost || !isPromise(dbPost)) return getPostOnlyAsync(uri);
    else return dbPost.then(post =>
      post && !post.placeholder ? post :
      getPostOnlyAsync(uri));
  }

  /**
   * @param {string} uri
   */
  async function getPostOnlyAsync(uri) {
    const parsedURL = breakFeedUri(uri);
    if (!parsedURL) throw new Error('Invalid post URI ' + JSON.stringify(uri));
    /**
     * @type {import('../firehose').FirehoseRecord$Typed<'app.bsky.feed.post'>}
     */
    const postRecord = (await agent_getRepoRecord_throttled(
      unwrapShortDID(parsedURL.shortDID),
      parsedURL.postID,
      'app.bsky.feed.post'))?.data?.value;

    postRecord.$type = 'app.bsky.feed.post';
    postRecord.repo = parsedURL.shortDID;
    postRecord.uri = uri;
    postRecord.action = 'create';

    const post = dbStore.captureRecord(postRecord, Date.now());
    if (post && 'uri' in post) return post;
  }

  /**
   * @param {string | null | undefined} uri
   * @returns {AsyncGenerator<import('.').CompactThreadPostSet | undefined>}
   */
  async function* getPostThreadIncrementally(uri) {
    if (!uri) return;

    const parsedURL = breakFeedUri(uri);
    if (!parsedURL) return;

    const remotePromise = agent_getPostThread_throttled(uri);

    const local = await dbStore.getPostThread(uri);
    if (local) yield local;

    const remoteThreadRaw = (await remotePromise)?.data?.thread;

    if ('post' in remoteThreadRaw) {
      const onePart = dbStore.captureThreadView(
        /** @type {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} */(remoteThreadRaw),
        Date.now());
      
      const ignoreBrokenPlaceholderUris = new Set();

      while (true) {
        const refreshedThread = await dbStore.getPostThread(uri);
        const allPlaceholders = [];
        if (refreshedThread?.all?.length) {
          for (const post of refreshedThread.all) {
            if (post.placeholder && !ignoreBrokenPlaceholderUris.has(post.uri))
              allPlaceholders.push(post);
          }
        }

        yield refreshedThread;
        if (!allPlaceholders.length) break;

        const orphanRemotePromises = allPlaceholders.map(placeholderPost =>
          [placeholderPost, agent_getPostThread_throttled(placeholderPost.uri)]);

        for (const [placeholderPost, orphanRemotePromise] of orphanRemotePromises) {
          try {
            const orphanRemoteRaw = (await orphanRemotePromise)?.data?.thread;
            if ('post' in orphanRemoteRaw) {
              dbStore.captureThreadView(
              /** @type {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} */(orphanRemoteRaw),
                Date.now());
            }
          } catch (error) {
            ignoreBrokenPlaceholderUris.add(placeholderPost.uri);
          }
        }
      }
    }
  }

  /**
   * @param {string | null | undefined} didOrHandle
   */
  async function* getProfileIncrementally(didOrHandle) {
    if (!didOrHandle) return;

    let profileRemotePromise;
    if (likelyDID(didOrHandle)) {
      profileRemotePromise = agent_getProfile_throttled(unwrapShortDID(didOrHandle));
    } else {
      const resolveHandlePromise = agent_resolveHandle_throttled(unwrapShortHandle(didOrHandle));
      if (isPromise(resolveHandlePromise)) {
        profileRemotePromise = (async () => {
          const rec = await resolveHandlePromise;
          const shortDID = shortenDID(rec.data.did);
          return agent_getProfile_throttled(unwrapShortDID(shortDID));
        })();
      } else {
        const rec = resolveHandlePromise;
        const shortDID = shortenDID(rec.data.did);
        profileRemotePromise = agent_getProfile_throttled(unwrapShortDID(shortDID));
      }
    }

    const profileLocal = await dbStore.getProfile(didOrHandle);
    if (profileLocal) yield profileLocal;

    const profileRemoteRaw = (await profileRemotePromise).data;
    const profileRemoteResolved = dbStore.captureProfileView(profileRemoteRaw, Date.now());
    yield profileRemoteResolved;
  }

  /**
   * @param {string | null | undefined} shortDID
   * @param {string | null | undefined} text
   * @returns {[] | AsyncGenerator<MatchCompactPost[] & { cachedOnly?: boolean }>}
   */
  function searchPostsIncrementally(shortDID, text) {
    if (shortDID) {
      return searchAccountHistoryPostsIncrementally(shortDID, text);
    } else if (!text) {
      return [];
    } else {
      return searchAllPostsIncrementally(text);
    }
  }

  /**
   * @param {string} shortDID
   * @param {string | null | undefined} text
   */
  async function* searchAccountHistoryPostsIncrementally(shortDID, text) {
    let REPORT_UPDATES_FREQUENCY_MSEC = 700;

    const cachedMatchesPromise = dbStore.searchPosts(shortDID, text);
    const allCachedHistoryPromise = !text ? cachedMatchesPromise :
      dbStore.searchPosts(shortDID, text);
    
    const plcDirHistoryPromise = plcDirectoryHistoryRaw(shortDID);

    let lastSearchReport = 0;
    let anyUpdates = false;

    /** @type {MatchCompactPost[] & { cachedOnly?: boolean } | undefined} */
    let lastMatches = await cachedMatchesPromise;
    if (lastMatches?.length) {
      lastMatches.cachedOnly = true;
      lastSearchReport = Date.now();
      yield lastMatches;
    }

    const plcDirHistoryRecords = await plcDirHistoryPromise;
    dbStore.capturePlcDirectoryEntries(plcDirHistoryRecords);
    const profile = await dbStore.getProfile(shortDID);

    const pdsAgent = new ColdskyAgent({
      service: profile?.history?.[0].pds
    });

    let cursor = '';
    const fullDID = unwrapShortDID(shortDID);
    /** @type {Set<string> | undefined} */
    let knownHistoryUri;
    while (true) {
      const moreData = await pdsAgent.com.atproto.repo.listRecords({
        repo: unwrapShortDID(shortDID),
        cursor,
        collection: 'app.bsky.feed.post',
        limit: Math.random() * 10 + 88
      });
      if (!knownHistoryUri) {
        const allHistory = await allCachedHistoryPromise;
        knownHistoryUri = new Set((allHistory || []).map(rec => rec.uri));
      }

      if (moreData?.data?.records?.length) {
        for (const rec of moreData.data.records) {
          /** @type {import('../firehose').FirehoseRecord$Typed<'app.bsky.feed.post'>} */
          const recEx = /** @type {*} */(rec.value);
          recEx.$type = 'app.bsky.feed.post';
          recEx.uri = rec.uri;
          recEx.repo = fullDID;
          if (!knownHistoryUri.has(rec.uri)) anyUpdates = true;
          dbStore.captureRecord(recEx, Date.now());
        }
      }

      if (anyUpdates && Date.now() - lastSearchReport > REPORT_UPDATES_FREQUENCY_MSEC) {

        /** @type {MatchCompactPost[] & { cachedOnly?: boolean } | undefined} */
        const newMatches = await dbStore.searchPosts(shortDID, text);
        if (newMatches?.length) {
          lastMatches = newMatches;
          lastSearchReport = Date.now();
          anyUpdates = false;
          yield newMatches;
          lastSearchReport = Date.now();
        }
      }

      if (!moreData?.data?.cursor) break;
      cursor = moreData.data.cursor;
    }
    
  }

  /**
   * @param {string} text
   * @returns {AsyncGenerator<MatchCompactPost[] & { cachedOnly?: boolean }>}
   */
  async function* searchAllPostsIncrementally(text) {
    const searchStringSanitised = (text || '')
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
      .replace(/\s+/g, ' ');
    
    let remoteSearchLatestPromise = agent_searchPosts_throttled(
      searchStringSanitised,
      97,
      'latest');

    const localResultsPromise = dbStore.searchPosts(undefined, text);
    /** @type {MatchCompactPost[] & { cachedOnly?: boolean }} */
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

      const refreshedResults = await dbStore.searchPosts(undefined, text);

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

  /**
   * @param {string} text
   * @param {{ max?: number }} [options]
   */
  async function* searchProfilesIncrementally(text, options) {
    const localSearchPromise = dbStore.searchProfiles(text, options);

    const normalizedText = text?.trim() || '';
    if (!normalizedText) return (async function* nothing() { })();

    const wholeTextSearchTypeahedPromise = directSearchAccountsTypeahead(normalizedText);
    const wholeTextSearchFullPromise = directSearchAccountsFull(normalizedText);

    const words = breakIntoWords(normalizedText);
    const wordSearchTypeaheadPromises = words.map(word => directSearchAccountsTypeahead(word));
    const wordSearchFullPromises = words.map(word => directSearchAccountsFull(word));

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

    const refreshedSearch = await dbStore.searchProfiles(text, options);
    return refreshedSearch;
  }

  /**
* @param {string} searchText
*/
  async function directSearchAccountsTypeahead(searchText) {

    const result = (await agent_searchActorsTypeAhead_throttled(searchText, 100)).data?.actors;

    return result;
  }

  /**
   * @param {string} searchText
   * @param {number} [limit]
   */
  async function directSearchAccountsFull(searchText, limit) {

    const result = (await agent_searchActors_throttled(searchText, limit || 100)).data?.actors;

    return result;
  }

}
