// @ts-check

import { breakFeedUri, breakPostURL, makeFeedUri, unwrapShortDID } from '../../shorten'
import { addToArrayUnique } from '../compact-post';

/**
 * @param {string | null | undefined} url
 * @param {string[] | undefined} quotes
 */
export function detectQuoting(url, quotes) {
  const feedUri = breakFeedUri(url);
  if (feedUri?.shortDID && feedUri.postID && quotes)
    return addToArrayUnique(quotes, makeFeedUri(feedUri.shortDID, feedUri.postID));

  const postUri = breakPostURL(url);
  if (postUri?.shortDID && postUri.postID && quotes)
    return addToArrayUnique(quotes, makeFeedUri(postUri.shortDID, postUri.postID));
}

