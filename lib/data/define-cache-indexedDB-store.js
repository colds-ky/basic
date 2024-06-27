// @ts-check

import Dexie from 'dexie';
import { defineStore } from '.';
import { breakFeedUri, breakPostURL, makeFeedUri } from '../shorten';
import { createRepoData } from './repo-data';
import { detectWordStartsNormalized } from './capture-records/compact-post-words';
import Fuse from 'fuse.js';

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
    capturePlcDirectoryEntries: memStore.capturePLCDirectoryEntries,

    getPost,
    getProfile,

    searchPosts,
    searchProfiles
  };

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
  function getPost(url) {
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
   * @param {string} text
   * @param {{ max?: number }} [options]
   */
  async function searchPosts(text, options) {
    if (!text) return;
    const words = detectWordStartsNormalized(text, undefined);
    if (!words?.length) return;

    /** @type {Map<string, import('.').CompactPost>} */
    const map = new Map();
    const dbPost = await db.posts.where('words').anyOf(words).toArray();
    for (const post of dbPost) {
      const uri = makeFeedUri(post.shortDID, post.rev);
      map.set(uri, post);
    }

    const wordMatcher = /** @param {string} w */(w) => words.includes(w)
    for (const uncachedPost of outstandingPostUpdatesByURI.values()) {
      if (uncachedPost.words?.some(wordMatcher)) {
        const uri = makeFeedUri(uncachedPost.shortDID, uncachedPost.rev);
        map.set(uri, uncachedPost);
      }
    }

    const allPosts = [...map.values()];

    const fuse = new Fuse(allPosts, {
      includeScore: true,
      keys: ['text'],
      includeMatches: true,
      shouldSort: true
    });

    const matches = fuse.search(text, options?.max ? { limit: options?.max } : undefined);
    
    return matches;
  }

  /**
   * @param {string | undefined} did
   */
  function getProfile(did) {
    if (!did) return;

    let repo = memStore.repos.get(did);
    if (repo && repo.profile) return repo.profile;

    return db.profiles.get(did).then(profile => {
      if (!profile) return;

      // cache in memory now
      if (!repo) repo = createRepoData(did);
      repo.profile = profile;

      return profile;
    });
  }

  /**
   * @param {string} text
   * @param {{ max?: number }} [options]
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

    return matches;
  }
}
