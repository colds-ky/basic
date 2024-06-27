// @ts-check

import Dexie from 'dexie';
import { defineStore } from '.';
import { breakFeedUri, breakPostURL } from '../shorten';
import { createRepoData } from './repo-data';

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
   *  posts: import('dexie').Table<import('.').CompactPost>,
   *  profiles: import('dexie').Table<import('.').CompactProfile>
   * }}
   */(new Dexie(dbName || DEFAULT_DB_NAME));
  db.version(1).stores({
    posts: 'cid [words]',
    profiles: 'shortDID [handle] [words]'
  });

  const memStore = defineStore({
    post: handlePostUpdate,
    profile: handleProfileUpdate
  });

  /**
   * @type {Map<string, import('.').CompactPost>}
   */
  const outstandingPostUpdatesByCID = new Map();

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

    getPost,
    getProfile
  };

  /**
   * @param {import('.').CompactPost} post
   */
  function handlePostUpdate(post) {
    outstandingPostUpdatesByCID.set(post.cid, post);
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
    if (outstandingPostUpdatesByCID.size) {
      db.posts.bulkPut(updateReport.posts = [...outstandingPostUpdatesByCID.values()]);
      outstandingPostUpdatesByCID.clear();
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

    return db.posts.get(parsedURL.cid).then(post => {
      if (!post) return;

      // cache in memory now
      if (!repo) repo = createRepoData(parsedURL.repo);
      repo.posts.set(post.cid, post);

      return post;
    });
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
}
