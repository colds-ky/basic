// @ts-check

/**
 * @typedef {{
 *  shortDID: string,
 *  rev: string,
 *  placeholder?: boolean,
 *  text: string | undefined,
 *  facets: CompactFacet[] | undefined,
 *  embeds: CompactEmbed[] | undefined,
 *  quoting: string[] | undefined,
 *  threadStart: string | undefined,
 *  replyTo: string | undefined,
 *  words: string[] | undefined,
 *  likeCount: number | undefined,
 *  repostCount: number | undefined,
 *  asOf: number | undefined
 * }} CompactPost
 */

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

export { defineStore } from './define-store';

export { defineCacheIndexedDBStore } from './define-cache-indexedDB-store';

export { breakIntoWords, detectWordStartsNormalized } from './capture-records/compact-post-words';
