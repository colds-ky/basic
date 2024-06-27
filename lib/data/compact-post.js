// @ts-check

import { shortenDID } from '../shorten';
import { extractEmbeds } from './compact-post-embeds';
import { extractFacets } from './compact-post-facets';
import { detectQuote } from './compact-post-quotes';
import { detectWordStartsNormalized } from './compact-post-words';

/**
 * @param {string} repo
 * @param {string} cid
 * @param {import('../firehose').RepoRecord$Typed['app.bsky.feed.post']} record
 */
export function makeCompactPost(repo, cid, record) {
  const shortDID = shortenDID(repo);

  /** @type {string[] | undefined} */
  let words = detectWordStartsNormalized(record.text, undefined);

  const embeds = extractEmbeds(record.embed);
  const facets = extractFacets(record.facets, record.text);

  /** @type {string[] | undefined} */
  let quotes;
  if (embeds?.length) {
    for (const embed of embeds) {
      quotes = detectQuote(embed.url, quotes);
      words = detectWordStartsNormalized(embed.title, words);
      words = detectWordStartsNormalized(embed.description, words);
      words = detectWordStartsNormalized(embed.url, words);
    } 
  }

  if (facets?.length) {
    for (const facet of facets) {
      quotes = detectQuote(facet.mention, quotes);
      quotes = detectQuote(facet.url, quotes);

      words = detectWordStartsNormalized(facet.tag, words);
      words = detectWordStartsNormalized(facet.url, words);
    }
  }

  /** @type {string[] | undefined} */
  let likes;

  /** @type {string[] | undefined} */
  let reposts;

  /**
   * @type {import('..').CompactPost}
   */
  const compact = {
    shortDID,
    cid,
    text: record.text,
    facets,
    embeds,
    threadStart: record.reply?.root?.cid === cid ? undefined : record.reply?.root?.uri,
    replyTo: record.reply?.parent?.uri,
    words,
    likes,
    reposts,
    quotes
  };

  return compact;
}

/**
 * @template T
 * @param {T[] | undefined} array
 * @param {T | undefined} element
 * @returns T[] | undefined
 */
export function addToArray(array, element) {
  if (!element) return array;
  if (!array) return [element];
  array.push(element);
  return array;
}

/**
 * @template T
 * @param {T[] | undefined} array
 * @param {T | undefined} element
 * @returns T[] | undefined
 */
export function addToArrayUnique(array, element) {
  if (!element) return array;
  if (!array) return [element];
  if (array.indexOf(element) >= 0) return array;
  array.push(element);
  return array;
}