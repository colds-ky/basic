// @ts-check

import Dexie from 'dexie';
import { defineStore } from '.';
import { breakFeedUri, breakPostURL, likelyDID, makeFeedUri, shortenDID, shortenHandle } from '../shorten';
import { createRepoData } from './repo-data';
import { detectWordStartsNormalized } from './capture-records/compact-post-words';
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
   *  posts: import('dexie').Table<import('.').CompactPost, [shortDID: string, rev: string]>,
   *  profiles: import('dexie').Table<import('.').CompactProfile>
   * }}
   */(new Dexie(dbName || DEFAULT_DB_NAME));
  db.version(2).stores({
    posts: '[shortDID+rev], replyTo, threadStart, *quoting, *words',
    profiles: 'shortDID, *handle, *words'
  });

  const memStore = defineStore({
    post: handlePostUpdate,
    profile: handleProfileUpdate
  });

  /**
   * @type {Map<string, import('.').CompactPost>}
   */
  const outstandingPostUpdatesByURI = new Map();

  /**
   * @type {Map<string, import('.').CompactProfile>}
   */
  const outstandingProfileUpdatesByShortDID = new Map();

  var queueTimeoutDebounce;
  var queueTimeoutMax;

  return {
    captureRecord: memStore.captureRecord,
    captureThreadView: memStore.captureThreadView,
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
      makeFeedUri(post.shortDID, post.rev),
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
    if (!queueTimeoutMax) queueTimeoutMax = setTimeout(performUpdate, UPDATE_DB_MAX_TIME);
    clearTimeout(queueTimeoutDebounce);
    queueTimeoutDebounce = setTimeout(performUpdate, DEFAULT_DB_DEBOUNCE_TIME);
  }

  function performUpdate() {
    clearTimeout(queueTimeoutMax);
    clearTimeout(queueTimeoutDebounce);
    queueTimeoutMax = queueTimeoutDebounce = undefined;

    const updateReport = {};
    if (outstandingPostUpdatesByURI.size) {
      db.posts.bulkPut(updateReport.posts = [...outstandingPostUpdatesByURI.values()]);
      outstandingPostUpdatesByURI.clear();
    }
    if (outstandingProfileUpdatesByShortDID.size) {
      db.profiles.bulkPut(updateReport.profiles = [...outstandingProfileUpdatesByShortDID.values()]);
      outstandingProfileUpdatesByShortDID.clear();
    }

    console.log('dumping to indexedDB: ', updateReport);
  }

  /**
   * @param {string | undefined} url
   */
  function getPostOnly(url) {
    if (!url) return;
    const parsedURL = breakFeedUri(url) || breakPostURL(url);
    if (!parsedURL) return;

    let repo = memStore.repos.get(parsedURL.repo);
    if (repo) {
      const existingPost = repo.posts.get(parsedURL.cid);
      if (existingPost) return existingPost;
    }

    return db.posts.get([parsedURL.shortDID, parsedURL.postID]).then(post => {
      if (!post) return;

      // cache in memory now
      if (!repo) repo = createRepoData(parsedURL.repo);
      repo.posts.set(post.rev, post);

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
   * @param {string} url
   * @returns {Promise<import('.').CompactThreadPostSet | undefined>}
   */
  async function getPostThreadAsync(url) {
    const parsedURL = breakFeedUri(url) || breakPostURL(url);
    if (!parsedURL) return;

    let veryPost = outstandingPostUpdatesByURI.get(url);
    let threadStart = veryPost?.threadStart || url;
    let asThreadStartPromise = db.posts.where('threadStart').equals(veryPost?.threadStart || url).toArray();

    if (!veryPost) veryPost = await db.posts.get([parsedURL.shortDID, parsedURL.postID]);

    const dbPosts = await asThreadStartPromise;
    if (veryPost && !dbPosts.find(post => post.shortDID === veryPost.shortDID && post.rev === veryPost.rev))
      dbPosts.push(veryPost);

    const uncachedPostsForThread = [...outstandingPostUpdatesByURI.values()].filter(p =>
      p.shortDID === veryPost?.shortDID && p.rev === veryPost?.rev ||
      threadStart && p.threadStart === threadStart);

    const postsByUri = new Map(dbPosts.concat(uncachedPostsForThread).map(p => [makeFeedUri(p.shortDID, p.rev), p]));
    const all = [...postsByUri.values()];
    const current = postsByUri.get(url) || createSpeculativePost(parsedURL.shortDID, parsedURL.postID);
    let root = current?.threadStart ? postsByUri.get(current.threadStart) : undefined;
    if (!root) {
      const parsedRootURL = breakFeedUri(current?.threadStart);
      if (parsedRootURL) {
        const dbRoot = await db.posts.get([parsedRootURL.shortDID, parsedRootURL.postID]);
        if (dbRoot) root = createSpeculativePost(parsedRootURL.shortDID, parsedRootURL.postID);
      }

      if (!root) root = current;
    }
    return { all, root, current };
  }

  /**
   * @param {string | null | undefined} did
   * @param {string | null | undefined} text
   */
  async function searchPosts(did, text) {
    const words = detectWordStartsNormalized(text, undefined);
    if (!words?.length && !did) return;

    const shortDID = shortenDID(did);
    const wordMatcher = !words ?
      (() => true) :
      /** @param {string} w */(w) => words.includes(w)

    /** @type {Map<string, import('.').CompactPost>} */
    const map = new Map();

    // search by both shortDID and words
    const dbPost =
      !shortDID ?
        await db.posts.where('words').anyOf(words || []).toArray() :
        !words?.length ?
          await db.posts.where('shortDID').equals(shortDID).toArray() :
          await db.posts.where('shortDID').equals(shortDID).and(
            post => !!post.words && post.words.some(wordMatcher)).toArray();

    for (const post of dbPost) {
      const uri = makeFeedUri(post.shortDID, post.rev);
      map.set(uri, post);
    }

    for (const uncachedPost of outstandingPostUpdatesByURI.values()) {
      if (uncachedPost.words?.some(wordMatcher)) {
        const uri = makeFeedUri(uncachedPost.shortDID, uncachedPost.rev);
        map.set(uri, uncachedPost);
      }
    }

    const allPosts = [...map.values()];

    if (!text) return allPosts;

    const fuse = new Fuse(allPosts, {
      includeScore: true,
      keys: ['text'],
      includeMatches: true,
      shouldSort: true
    });

    const matches = fuse.search(text);

    /**
     * @type {import('.').MatchCompactPost[]}
     */
    const compact = matches.map(fuseMatch => {
      const joined = {
        ...fuseMatch,
        ...fuseMatch.item,
        item: undefined
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
        if (!repo) repo = createRepoData(shortDID);
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
    const words = detectWordStartsNormalized(text, undefined);
    if (!words?.length) return;

    /** @type {Map<string, import('.').CompactProfile>} */
    const map = new Map();
    const dbProfiles = await db.profiles.where('words').anyOf(words).toArray();
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
      shouldSort: true
    });

    const matches = fuse.search(text, options?.max ? { limit: options?.max } : undefined);

    const profileWithSearchData = matches.map(fuseMatch => {
      return {
        ...fuseMatch,
        ...fuseMatch.item,
        item: undefined
      };
    });

    return profileWithSearchData;
  }
}
