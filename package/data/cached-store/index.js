// @ts-check

/**
 * @typedef {import('..').MatchCompactPost[] & {
 *  cachedOnly?: boolean,
 *  processedBatch?: import('..').CompactPost[],
 *  processedAllCount?: number
 * }} IncrementalMatchCompactPosts
 */

/**
 * @typedef {import('..').CompactThreadPostSet[] & {
 *  cachedOnly?: boolean,
 *  processedBatch?: import('..').CompactPost[],
 *  processedAllCount?: number,
 *  complete?: boolean
 * }} IncrementalMatchThreadResult
 */

export { defineCachedStore } from './cached-store';