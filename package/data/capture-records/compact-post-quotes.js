// @ts-check

import { breakFeedURIPostOnly, breakPostURL, makeFeedUri } from '../../shorten'
import { addToArrayUnique } from '../compact-post';

/**
 * @param {string | null | undefined} url
 * @param {string[] | undefined} quotes
 */
export function detectQuoting(url, quotes) {
  const feedUri = breakFeedURIPostOnly(url);
  if (feedUri?.shortDID && feedUri.postID)
    return addToArrayUnique(quotes, makeFeedUri(feedUri.shortDID, feedUri.postID));

  const postUri = breakPostURL(url);
  if (postUri?.shortDID && postUri.postID)
    return addToArrayUnique(quotes, makeFeedUri(postUri.shortDID, postUri.postID));
}

/**
 * @param {import('../../firehose').RepositoryRecordTypes$['app.bsky.feed.post']} record
 */
export function allQuoting(record) {
  /** @type {string[] | undefined} */
  let quoting;

  if (record.embed?.external)
    quoting = detectQuoting(
      /** @type {import('@atproto/api').AppBskyEmbedExternal.Main['external']} */(record.embed.external).uri,
      quoting);
  // if (record.embed)

  if (record.facets?.length) {
    for (const facet of record.facets) {
      if (facet.features?.length) {
        for (const feat of facet.features)
          quoting = detectQuoting(/** @type {*} */(feat.uri), quoting);
      }
    }
  }

  return quoting;
}
