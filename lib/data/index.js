// @ts-check

/**
 * @typedef {{
 *  shortDID: string,
 *  cid: string,
 *  text: string | undefined,
 *  facets: CompactFacet[] | undefined,
 *  embeds: CompactEmbed[] | undefined,
 *  threadStart: string | undefined,
 *  replyTo: string | undefined,
 *  words: string[] | undefined,
 *  likes: string[] | undefined,
 *  reposts: string[] | undefined,
 *  quotes: string[] | undefined
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
 *  followersCount: number | undefined,
 *  followsCount: number | undefined,
 *  postsCount: number | undefined,
 *  history: CompactHistoryEntry[] | undefined
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
