// @ts-check

import { shortenDID } from '../shorten';
import { extractEmbeds } from './capture-records/compact-post-embeds';
import { extractFacets } from './capture-records/compact-post-facets';
import { detectQuoting } from './capture-records/compact-post-quotes';
import { detectWordStartsNormalized } from './capture-records/compact-post-words';

/**
 * @param {string} repo
 * @param {string} uri
 * @param {import('../firehose').RepoRecord$Typed['app.bsky.feed.post']} record
 * @param {number} asOf
 */
export function makeCompactPost(repo, uri, record, asOf) {
  const shortDID = shortenDID(repo);

  /** @type {string[] | undefined} */
  let words = detectWordStartsNormalized(record.text, undefined);

  const embeds = extractEmbeds(repo, record.embed);
  const facets = extractFacets(record.facets, record.text);

  /** @type {string[] | undefined} */
  let quoting;
  if (embeds?.length) {
    for (const embed of embeds) {
      quoting = detectQuoting(embed.url, quoting);
      words = detectWordStartsNormalized(embed.title, words);
      words = detectWordStartsNormalized(embed.description, words);
      words = detectWordStartsNormalized(embed.url, words);
    } 
  }

  if (facets?.length) {
    for (const facet of facets) {
      quoting = detectQuoting(facet.mention, quoting);
      quoting = detectQuoting(facet.url, quoting);

      words = detectWordStartsNormalized(facet.tag, words);
      words = detectWordStartsNormalized(facet.url, words);
    }
  }

  /** @type {import('..').CompactPost} */
  const compact = {
    uri,
    shortDID,
    text: record.text,
    facets,
    embeds,
    threadStart: record.reply?.root?.uri === uri ? undefined : record.reply?.root?.uri,
    replyTo: record.reply?.parent?.uri,
    words,
    likedBy: undefined,
    repostedBy: undefined,
    quoting,
    asOf: Date.parse(record.createdAt) || asOf,
    labels: undefined
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