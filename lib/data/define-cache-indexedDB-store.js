// @ts-check

import Dexie from 'dexie';
import { defineStore } from '.';
import { breakFeedUri, breakPostURL, likelyDID, makeFeedUri, shortenDID, shortenHandle } from '../shorten';
import { createRepoData } from './repo-data';
import { breakIntoWords, detectWordStartsNormalized } from './capture-records/compact-post-words';
import Fuse from 'fuse.js';
import { createSpeculativePost } from './capture-records/speculative-post';

export const DEFAULT_DB_NAME = 'coldsky-db-11may2024';
export const DEFAULT_DB_DEBOUNCE_TIME = 2000;
export const UPDATE_DB_MAX_TIME = 10000;

/**
 * @param {string} [dbName]
 */
export function defineCacheIndexedDBStore(dbName) {

  const db =
  /**
   * @type {Dexie & {
   *  posts: import('dexie').Table<import('.').CompactPost, string>,
   *  profiles: import('dexie').Table<import('.').CompactProfile, string>
   * }}
   */(new Dexie(dbName || DEFAULT_DB_NAME));
  db.version(3).stores({
    posts: 'uri, shortDID, replyTo, threadStart, *quoting, *words',
    profiles: 'shortDID, *handle, *words'
  });

  const memStore = defineStore({
    post: handlePostUpdate,
    profile: handleProfileUpdate
  });

  /**
   * @type {Map<string, import('.').CompactPost>}
   */
  let outstandingPostUpdatesByURI = new Map();
  /** @type {typeof outstandingPostUpdatesByURI} */
  let outstandingPostUpdatesInProgressByURI = new Map();

  /**
   * @type {Map<string, import('.').CompactProfile>}
   */
  let outstandingProfileUpdatesByShortDID = new Map();
  /** @type {typeof outstandingProfileUpdatesByShortDID} */
  let outstandingProfileUpdatesInProgressByShortDID = new Map();

  var queueTimeoutDebounce;
  var queueTimeoutMax;

  return {
    captureRecord: memStore.captureRecord,
    captureThreadView: memStore.captureThreadView,
    capturePostView: memStore.capturePostView,
    captureProfileView: memStore.captureProfileView,

    deleteRecord,

    capturePlcDirectoryEntries: memStore.capturePLCDirectoryEntries,

    getPostOnly,
    getPostThread,
    getProfile,

    searchPosts,
    searchProfiles
  };

  function deleteRecord(rec) {
    // TODO: reconcile memStore and IndexedDB
  }

  /**
   * @param {import('.').CompactPost} post
   */
  function handlePostUpdate(post) {
    outstandingPostUpdatesByURI.set(
      post.uri,
      post);
    queueUpdate();
  }

  /**
   * @param {import('.').CompactProfile} profile
   */
  function handleProfileUpdate(profile) {
    outstandingProfileUpdatesByShortDID.set(profile.shortDID, profile);
    queueUpdate();
  }

  function queueUpdate() {
    if (outstandingPostUpdatesInProgressByURI.size || outstandingProfileUpdatesInProgressByShortDID.size) return;

    if (!queueTimeoutMax) queueTimeoutMax = setTimeout(performUpdate, UPDATE_DB_MAX_TIME);
    clearTimeout(queueTimeoutDebounce);
    queueTimeoutDebounce = setTimeout(performUpdate, DEFAULT_DB_DEBOUNCE_TIME);
  }

  async function performUpdate() {
    if (outstandingPostUpdatesInProgressByURI.size || outstandingProfileUpdatesInProgressByShortDID.size) return;

    clearTimeout(queueTimeoutMax);
    clearTimeout(queueTimeoutDebounce);
    queueTimeoutMax = queueTimeoutDebounce = undefined;

    const updateReport = {};
    let postUpdatePromise;
    if (outstandingPostUpdatesByURI.size) {
      postUpdatePromise = db.posts.bulkPut(updateReport.posts = [...outstandingPostUpdatesByURI.values()]);

      // push updates to in-progress map
      const tmp = outstandingPostUpdatesByURI;
      outstandingPostUpdatesByURI = outstandingPostUpdatesInProgressByURI;
      outstandingPostUpdatesInProgressByURI = tmp;
    }

    let profileUpdatePromise;
    if (outstandingProfileUpdatesByShortDID.size) {
      profileUpdatePromise = db.profiles.bulkPut(updateReport.profiles = [...outstandingProfileUpdatesByShortDID.values()]);

      // push updates to in-progress map
      const tmp = outstandingProfileUpdatesByShortDID;
      outstandingProfileUpdatesByShortDID = outstandingProfileUpdatesInProgressByShortDID;
      outstandingProfileUpdatesInProgressByShortDID = tmp;
    }

    console.log('dumping to indexedDB: ', updateReport);

    await postUpdatePromise;
    await profileUpdatePromise;

    outstandingPostUpdatesInProgressByURI.clear();
    outstandingProfileUpdatesInProgressByShortDID.clear();
  }

  /**
   * @param {string | undefined} uri
   */
  function getPostOnly(uri) {
    if (!uri) return;
    const parsedURL = breakFeedUri(uri) || breakPostURL(uri);
    if (!parsedURL) return;

    let repo = memStore.repos.get(parsedURL.repo);
    if (repo) {
      const existingPost = repo.posts.get(uri);
      if (existingPost) return existingPost;
    }

    return db.posts.get(uri).then(post => {
      if (!post) return;

      // cache in memory now
      if (!repo) {
        repo = createRepoData(parsedURL.repo);
        memStore.repos.set(parsedURL.repo, repo);
      }
      repo.posts.set(post.uri, post);

      return post;
    });
  }

  /**
   * @param {string | undefined} url
   * @returns {Promise<import('.').CompactThreadPostSet | undefined> | undefined}
   */
  function getPostThread(url) {
    if (!url) return;
    return getPostThreadAsync(url);
  }

  /**
   * @param {string} uri
   * @returns {Promise<import('.').CompactThreadPostSet | undefined>}
   */
  async function getPostThreadAsync(uri) {
    const shortDID = breakFeedUri(uri)?.shortDID;
    if (!shortDID) return;

    let veryPost = outstandingPostUpdatesByURI.get(uri) || outstandingPostUpdatesInProgressByURI.get(uri);
    let threadStart = veryPost?.threadStart || uri;
    let asThreadStartPromise = db.posts.where('threadStart').equals(veryPost?.threadStart || uri).toArray();

    if (!veryPost) veryPost = await db.posts.get(uri);

    const dbPosts = await asThreadStartPromise;
    if (veryPost && !dbPosts.find(post => post.uri === veryPost.uri))
      dbPosts.push(veryPost);

    const uncachedPostsForThread = [
      ...outstandingPostUpdatesByURI.values(),
      ...outstandingPostUpdatesInProgressByURI.values()
    ].filter(
      p => p.uri === veryPost?.uri ||
        threadStart && p.threadStart === threadStart ||
        p.uri === threadStart);

    const postsByUri = new Map(dbPosts.concat(uncachedPostsForThread).map(p => [p.uri, p]));
    const all = [...postsByUri.values()];
    const current = postsByUri.get(uri) || createSpeculativePost(shortDID, uri);
    let root = current?.threadStart ? postsByUri.get(current.threadStart) : undefined;
    if (!root) {
      const rootShortDID = breakFeedUri(current.threadStart)?.shortDID;
      if (rootShortDID && current.threadStart) {
        const dbRoot = await db.posts.get(current.threadStart);
        if (dbRoot) root = createSpeculativePost(rootShortDID, current.threadStart);
      }

      if (!root) root = current;
    }
    return { all, root, current };
  }

  /**
   * @param {string | null | undefined} did
   * @param {string | null | undefined} text
   * @returns {Promise<import('.').MatchCompactPost[]>}
   */
  async function searchPosts(did, text) {
    const wordStarts = detectWordStartsNormalized(text, undefined);
    if (!wordStarts?.length && !did) return [];

    const words = breakIntoWords(text || '');
    words.push(text || '');

    const shortDID = shortenDID(did);
    const wordMatcher = !wordStarts ?
      (() => true) :
      /** @param {string} w */(w) => wordStarts.includes(w)

    /** @type {Map<string, import('.').CompactPost>} */
    const map = new Map();

    // search by both shortDID and words
    const dbPosts =
      !shortDID ?
        await db.posts.where('words').anyOf(wordStarts || []).toArray() :
        !wordStarts?.length ?
          await db.posts.where('shortDID').equals(shortDID).toArray() :
          await db.posts.where('shortDID').equals(shortDID).and(
            post => !!post.words && post.words.some(wordMatcher)).toArray();

    for (const post of dbPosts) {
      map.set(post.uri, post);
    }

    for (const uncachedPost of outstandingPostUpdatesInProgressByURI.values()) {
      if (shortDID && uncachedPost.shortDID !== shortDID) continue;
      if (uncachedPost.words?.some(wordMatcher)) {
        map.set(uncachedPost.uri, uncachedPost);
      }
    }

    for (const uncachedPost of outstandingPostUpdatesByURI.values()) {
      if (shortDID && uncachedPost.shortDID !== shortDID) continue;
      if (uncachedPost.words?.some(wordMatcher)) {
        map.set(uncachedPost.uri, uncachedPost);
      }
    }

    const allPosts = [...map.values()];

    if (!text) {
      allPosts?.sort((a1, a2) => (a2.asOf || 0) - (a1.asOf || 0));
      return allPosts;
    }

    const FUSE_THRESHOLD = 0.6;

    const fuse = new Fuse(allPosts, {
      includeScore: true,
      keys: ['text'],
      includeMatches: true,
      shouldSort: true,
      findAllMatches: true,
      ignoreLocation: true,
      threshold: FUSE_THRESHOLD
    });

    const matches = fuse.search(text).filter(m => (m.score || 0) <= FUSE_THRESHOLD);

    /**
     * @type {import('.').MatchCompactPost[]}
     */
    const compact = matches.map(fuseMatch => {
      const joined = {
        ...fuseMatch,
        ...fuseMatch.item,
        item: undefined,
        searchWords: words
      };
      return joined;
    });
    
    return compact;
  }

  /**
   * @param {string | undefined} did
   */
  function getProfile(did) {
    if (likelyDID(did)) {
      const shortDID = shortenDID(did);
      if (!shortDID) return;

      let repo = memStore.repos.get(shortDID);
      if (repo && repo.profile) return repo.profile;

      return db.profiles.get(shortDID).then(profile => {
        if (!profile) return;

        // cache in memory now
        if (!repo) {
          repo = createRepoData(shortDID);
          memStore.repos.set(shortDID, repo);
        }
        repo.profile = profile;

        return profile;
      });
    } else {
      const shortHandle = shortenHandle(did);
      if (!shortHandle) return;

      const matchingProfiles = [];
      for (const repo of memStore.repos.values()) {
        if (repo.profile?.handle === shortHandle) matchingProfiles.push(repo.profile);
      }
      if (matchingProfiles.length > 1) return undefined; // can it happen???
      if (matchingProfiles.length === 1) return matchingProfiles[0];

      return db.profiles.where('handle').equals(shortHandle).toArray().then(profiles => {
        if (profiles.length === 1) return profiles[0];
      });
    }
  }

  /**
   * @param {string} text
   * @param {{ max?: number }} [options]
   * @returns {Promise<import('..').MatchCompactProfile[] | undefined>}
   */
  async function searchProfiles(text, options) {
    if (!text) return;
    const wordStarts = detectWordStartsNormalized(text, undefined);
    if (!wordStarts?.length) return;

    const words = breakIntoWords(text);
    words.push(text);

    /** @type {Map<string, import('.').CompactProfile>} */
    const map = new Map();
    const dbProfiles = await db.profiles.where('words').anyOf(wordStarts).toArray();
    for (const prof of dbProfiles) {
      map.set(prof.shortDID, prof);
    }

    for (const repo of memStore.repos.values()) {
      if (repo.profile) map.set(repo.profile.shortDID, repo.profile);
    }

    const allProfiles = [...map.values()];

    const fuse = new Fuse(allProfiles, {
      includeScore: true,
      keys: ['handle', 'displayName', 'description'],
      includeMatches: true,
      shouldSort: true,
      findAllMatches: true
    });

    const matches = fuse.search(text, options?.max ? { limit: options?.max } : undefined);

    const profileWithSearchData = matches.map(fuseMatch => {
      return {
        ...fuseMatch,
        ...fuseMatch.item,
        searchWords: words,
        item: undefined
      };
    });

    return profileWithSearchData;
  }
}
