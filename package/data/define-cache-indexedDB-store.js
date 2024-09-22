// @ts-check

import Dexie from 'dexie';
import { defineStore } from '.';
import { breakFeedURI, breakFeedURIPostOnly, breakPostURL, likelyDID, makeFeedUri, shortenDID, shortenHandle } from '../shorten';
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
   *  profiles: import('dexie').Table<import('.').CompactProfile, string>,
   *  repoSync: import('dexie').Table<{shortDID: string, lastSyncRev: string }>
   * }}
   */(new Dexie(dbName || DEFAULT_DB_NAME));

  // this is to clean up old posts, with incorrect URI
  db.version(3).stores({
    posts: 'uri, shortDID, replyTo, threadStart, *quoting, *words',
    profiles: 'shortDID, *handle, *words'
  });

  // incorrect URIs: at:// prefix missing
  db.version(4).stores({
    posts: null,
    profiles: 'shortDID, *handle, *words'
  });
  db.version(5).stores({
    posts: 'uri, shortDID, replyTo, threadStart, *quoting, *words',
    profiles: 'shortDID, *handle, *words'
  });

  // repoSync introduced
  db.version(6).stores({
    posts: 'uri, shortDID, replyTo, threadStart, *quoting, *words',
    profiles: 'shortDID, *handle, *words',
    repoSync: 'shortDID' // 
  });

  // incorrect URI: missing a slash in the middle
  db.version(7).stores({
    posts: null,
    profiles: 'shortDID, *handle, *words'
  });
  db.version(8).stores({
    posts: 'uri, shortDID, replyTo, threadStart, *quoting, *words',
    profiles: 'shortDID, *handle, *words',
    repoSync: 'shortDID'
  });

  db.version(9).stores({
    posts: 'uri, shortDID, replyTo, threadStart, *quoting, *words, *likedBy, repostedBy*',
    profiles: 'shortDID, *handle, *words',
    repoSync: 'shortDID'
  }).upgrade(async tr => {
    await tr.table('repoSync').toCollection().modify(rsync => {
      // likes were not being captured, so full re-download is required now
      delete rsync.lastSyncRev;
    });
    await tr.table('posts').toCollection().modify(post => {
      if (post.likeCount)
        post.likedBy = Array(post.likeCount).fill('?');
      if (post.repostCount)
        post.repostedBy = Array(post.repostCount).fill('?');

      delete post.likeCount;
      delete post.repostCount;
    });
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
    searchProfiles,

    getLastRepoSyncRev,
    syncRepoWithData
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

  var currentBulkUpdate;
  async function performUpdate() {
    if (outstandingPostUpdatesInProgressByURI.size || outstandingProfileUpdatesInProgressByShortDID.size) return;

    clearTimeout(queueTimeoutMax);
    clearTimeout(queueTimeoutDebounce);
    queueTimeoutMax = queueTimeoutDebounce = undefined;

    let BULK_UPDATE_BATCH_COUNT = 1023;

    currentBulkUpdate = (async () => {
      while (outstandingPostUpdatesByURI.size || outstandingProfileUpdatesByShortDID.size) {

        const postUpdates = [...outstandingPostUpdatesByURI.values()];
        const profileUpdates = [...outstandingProfileUpdatesByShortDID.values()];

        {
          // push post updates to in-progress map
          const tmp = outstandingPostUpdatesByURI;
          outstandingPostUpdatesByURI = outstandingPostUpdatesInProgressByURI;
          outstandingPostUpdatesInProgressByURI = tmp;
        }

        {
          // push profile updates to in-progress map
          const tmp = outstandingProfileUpdatesByShortDID;
          outstandingProfileUpdatesByShortDID = outstandingProfileUpdatesInProgressByShortDID;
          outstandingProfileUpdatesInProgressByShortDID = tmp;
        }

        for (let i = 0; i < Math.max(postUpdates.length, profileUpdates.length); i += BULK_UPDATE_BATCH_COUNT) {
          if (i) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          const postBatch = postUpdates.slice(i, i + BULK_UPDATE_BATCH_COUNT);
          const profileBatch = profileUpdates.slice(i, i + BULK_UPDATE_BATCH_COUNT);

          const updateReport = {};
          updateReport.postsTotal = postUpdates.length;
          updateReport.profilesTotal = profileUpdates.length;

          let postUpdatePromise;
          if (postBatch.length) {
            postUpdatePromise = db.posts.bulkPut(updateReport.posts = postBatch);
          }

          let profileUpdatePromise;
          if (profileBatch.length) {
            profileUpdatePromise = db.profiles.bulkPut(updateReport.profiles = profileBatch);
          }

          const startBulkUpdate = Date.now();
          await postUpdatePromise;
          await profileUpdatePromise;
          console.log('dumping to indexedDB: ', updateReport, ' in ' + (Date.now() - startBulkUpdate).toLocaleString() + 'ms');

          for (const post of postBatch) {
            outstandingPostUpdatesInProgressByURI.delete(post.uri);
          }
          for (const profile of profileBatch) {
            outstandingProfileUpdatesInProgressByShortDID.delete(profile.shortDID);
          }
        }

      }

      currentBulkUpdate = undefined;

    })();

    await currentBulkUpdate;
  }

  /**
   * @param {string | undefined} uri
   */
  function getPostOnly(uri) {
    if (!uri) return;
    const parsedURL = breakFeedURIPostOnly(uri) || breakPostURL(uri);
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
    const currentPostURIParsed = breakFeedURIPostOnly(uri);
    if (!currentPostURIParsed) return;
    const { shortDID, postID: currentPostID } = currentPostURIParsed;

    let currentPost = outstandingPostUpdatesByURI.get(uri) || outstandingPostUpdatesInProgressByURI.get(uri);
    if (!currentPost) currentPost = memStore.repos.get(shortDID)?.posts.get(currentPostID);
    if (!currentPost) await db.posts.get(uri);
    if (!currentPost) return;

    let threadStartURI = currentPost.threadStart || uri;
    const threadStartPostPromise = db.posts.get(threadStartURI);
    const dbPosts = await db.posts.where('threadStart').equals(threadStartURI).toArray();
    if (currentPost && !dbPosts.find(post => post.uri === currentPost.uri))
      dbPosts.push(currentPost);
    const threadStartPost = await threadStartPostPromise;
    if (threadStartPost && !dbPosts.find(post => post.uri === threadStartPost.uri))
      dbPosts.push(threadStartPost);

    const uncachedPostsForThread = [
      ...outstandingPostUpdatesByURI.values(),
      ...outstandingPostUpdatesInProgressByURI.values()
    ].filter(
      p => p.uri === currentPost?.uri ||
        threadStartURI && p.threadStart === threadStartURI ||
        p.uri === threadStartURI);

    const postsByUri = new Map(dbPosts.concat(uncachedPostsForThread).map(p => [p.uri, p]));
    const all = [...postsByUri.values()];
    const current = postsByUri.get(uri) || createSpeculativePost(shortDID, uri);
    let root = current?.threadStart ? postsByUri.get(current.threadStart) : undefined;
    if (!root) {
      const rootShortDID = breakFeedURIPostOnly(current.threadStart)?.shortDID;
      if (rootShortDID && current.threadStart) {
        const dbRoot = await db.posts.get(current.threadStart);
        if (dbRoot) root = dbRoot;
        else root = createSpeculativePost(rootShortDID, current.threadStart);
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

    const allPostsForShortDIDPromise = !shortDID ? undefined :
      db.posts.where('shortDID').equals(shortDID).count();

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
     * @type {import('.').MatchCompactPost[] & { processedAllCount?: number }}
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
    if (allPostsForShortDIDPromise)
      compact.processedAllCount = await allPostsForShortDIDPromise;
    
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

  /**
   * @param {string} shortDID
   */
  async function getLastRepoSyncRev(shortDID) {
    return db.repoSync.get(shortDID).then(sync => sync?.lastSyncRev);
  }

  /**
   * @param {import('../firehose').FirehoseRecord[]} records
   * @param {number} now
   */
  async function syncRepoWithData(records, now) {
    let lastSync = '';
    for (const record of records) {
      if (record.$type === 'app.bsky.feed.like' || record.$type === 'app.bsky.feed.post') {
        const parsedURI = breakFeedURI(record.uri);
        if (parsedURI?.postID && parsedURI.postID > lastSync) {
          // only consider POSTs, not other feed URIs
          lastSync = parsedURI.postID;
        }
      }
    }

    const compact = [];
    for (const record of records) {
      const co = memStore.captureRecord(record, now);
      if (co) {
        compact.push(co);
      }
    }

    await currentBulkUpdate;
    await performUpdate();

    if (lastSync) {
      db.repoSync.put({ shortDID: shortenDID(records[0].repo), lastSyncRev: lastSync });
    }

    return compact;
  }
}
