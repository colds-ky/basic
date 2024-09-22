// @ts-check

/**
 * @typedef {{
 *  shortDID: string,
 *  uri: string,
 *  placeholder?: boolean,
 *  text: string | undefined,
 *  facets: CompactFacet[] | undefined,
 *  embeds: CompactEmbed[] | undefined,
 *  quoting: string[] | undefined,
 *  threadStart: string | undefined,
 *  replyTo: string | undefined,
 *  words: string[] | undefined,
 *  repostedBy: string[] | undefined,
 *  likedBy: string[] | undefined,
 *  labels: Record<string, string> | undefined,
 *  asOf: number | undefined
 * }} CompactPost
 */

/**
 * @param {any} obj
 * @returns {obj is CompactPost}
 */
export function isCompactPost(obj) {
  if (!obj) return false;
  if (typeof obj !== 'object') return false;
  return (
    typeof obj.shortDID === 'string' &&
    typeof obj.uri === 'string' &&
    (obj.placeholder || typeof obj.text === 'string' || obj.embeds || obj.asOf)
  );
}

/**
 * @typedef {{
 *  start: number,
 *  length: number,
 *  mention?: string,
 *  url?: string,
 *  tag?: string
 * }} CompactFacet
 */

/**
 * @typedef {{
 *  imgSrc: string | undefined,
 *  aspectRatio: number | undefined,
 *  url: string | undefined,
 *  title: string | undefined,
 *  description: string | undefined
 * }} CompactEmbed
 */

/**
 * @typedef {{
 *  shortDID: string,
 *  handle: string | undefined,
 *  displayName: string | undefined,
 *  description: string | undefined,
 *  avatar: string | undefined,
 *  banner: string | undefined,
 *  words: string[] | undefined,
 *  followersCount: number | undefined,
 *  followsCount: number | undefined,
 *  postsCount: number | undefined,
 *  history: CompactHistoryEntry[] | undefined,
 *  asOf: number | undefined
 * }} CompactProfile
 */

/**
 * @typedef {{
 *  time: number,
 *  shortHandle: string | undefined,
 *  pds: string | undefined
 * }} CompactHistoryEntry
 */

/**
 * @typedef {{
 *  messages: import('../firehose').FirehoseRecord[],
 *  posts: CompactPost[],
 *  profiles: CompactProfile[],
 *  deletes: import('../firehose').FirehoseRecord[] | undefined,
 *  unexpecteds: import('../firehose').FirehoseRecord[] | undefined
 * }} CompactFirehoseBlock
 */

/**
 * @typedef {{
 *  all: CompactPost[],
 *  root: CompactPost,
 *  current: CompactPost
 * }} CompactThreadPostSet
 */

/**
 * @typedef {CompactProfile &
 *  Partial<Omit<import('fuse.js').default.FuseResult<any>, 'item'>> & {
 *    searchWords?: string[]
 * }} MatchCompactProfile
 */

/**
 * @typedef {CompactPost &
 *  Partial<Omit<import('fuse.js').default.FuseResult<any>, 'item'>> & {
 *    searchWords?: string[]
 * }} MatchCompactPost
 */

export { defineCachedStore } from './cached-store';
export { defineStore } from './define-store';
export { defineCacheIndexedDBStore } from './define-cache-indexedDB-store';

export { breakIntoWords, detectWordStartsNormalized } from './capture-records/compact-post-words';
