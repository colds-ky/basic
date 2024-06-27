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

/** @typedef {import('.').CompactPost} CompactPost */
/** @typedef {import('.').CompactProfile} CompactProfile */

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

  const agent_getPostThread_throttled = throttledAsyncCache(uri => agent.getPostThread({ uri }));

  const agent_getRepoRecord_throttled = throttledAsyncCache((repo, rkey, collection) => {
    const postRecordPromise = agent.com.atproto.repo.getRecord({
      repo,
      rkey,
      collection
    });
    return postRecordPromise;
  });

  const agent_searchActorsTypeAhead_throttled = throttledAsyncCache((q, limit) => agent.searchActorsTypeahead({ q, limit }));
  const agent_searchActors_throttled = throttledAsyncCache((q, limit) => agent.searchActors({ q, limit }));

  return {
    firehose,
    getPostOnly,
    getPostThreadIncrementally,
    getProfileIncrementally,
    searchPosts,
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
              if ('rev' in updated) updatedPosts.set(makeFeedUri(updated.shortDID, updated.rev), updated);
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
    if (dbPost && !isPromise(dbPost)) return dbPost;

    const parsedURI = breakFeedUri(uri) || breakPostURL(uri);
    if (!parsedURI) return;

    if (!dbPost) return getPostOnlyAsync(parsedURI.shortDID, parsedURI.postID);
    else return dbPost.then(post =>
      post || getPostOnlyAsync(parsedURI.shortDID, parsedURI.postID));
  }

  /**
   * @param {string} shortDID
   * @param {string} rev
   */
  async function getPostOnlyAsync(shortDID, rev) {
    const postRecord = await agent_getRepoRecord_throttled(
      unwrapShortDID(shortDID),
      rev,
      'app.bsky.actor.post');

    const post = dbStore.captureRecord(/** @type {*} */(postRecord.data), Date.now());
    if (post && 'rev' in post) return post;
  }

  /**
   * @param {string | null | undefined} url
   * @returns {AsyncGenerator<import('.').CompactThreadPostSet | undefined>}
   */
  async function* getPostThreadIncrementally(url) {
    if (!url) return;

    const parsedURL = breakFeedUri(url) || breakPostURL(url);
    if (!parsedURL) return;

    const remotePromise = agent_getPostThread_throttled(makeFeedUri(parsedURL.shortDID, parsedURL.postID));

    const local = await dbStore.getPostThread(url);
    if (local) yield local;

    const remoteThreadRaw = (await remotePromise)?.data?.thread;

    if ('post' in remoteThreadRaw) {
      const onePart = dbStore.captureThreadView(
        /** @type {import('@atproto/api').AppBskyFeedDefs.ThreadViewPost} */(remoteThreadRaw),
        Date.now());

      const refreshedThread = await dbStore.getPostThread(url);
      yield refreshedThread;
    }
  }

  /**
   * @param {string | null | undefined} didOrHandle
   */
  async function* getProfileIncrementally(didOrHandle) {
    if (!didOrHandle) return;

    let profileRemotePromise;
    if (likelyDID(didOrHandle)) {
      profileRemotePromise = agent.getProfile({ actor: unwrapShortDID(didOrHandle) });
    } else {
      profileRemotePromise = agent.com.atproto.identity.resolveHandle({ handle: unwrapShortHandle(didOrHandle) }).then(rec => {
        const shortDID = shortenDID(rec.data.did);
        return agent.getProfile({ actor: unwrapShortDID(shortDID) });
      });
    }

    const profileLocal = await dbStore.getProfile(didOrHandle);
    if (profileLocal) yield profileLocal;

    const profileRemoteRaw = (await profileRemotePromise).data;
    const profileRemoteResolved = dbStore.captureProfileView(profileRemoteRaw, Date.now());
    return profileRemoteResolved;
  }

  /**
   * @param {string} text
   * @param {{ max?: number }} [options]
   */
  function searchPosts(text, options) {
    return dbStore.searchPosts(text, options)
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
