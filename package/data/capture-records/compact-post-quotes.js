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
