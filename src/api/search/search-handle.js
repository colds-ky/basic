// @ts-check
/// <reference path="../../types.d.ts" />

import { breakFeedUri, breakPostURL, isPromise, resolveHandleOrDID, shortenDID, shortenHandle } from '..';
import { performSearchOverBuckets } from './perform-search-over-buckets';

/**
 * @typedef {{ [shortDID: string]: CompactHandleOrHandleDisplayName }} IndexedBucket
 */

/** @type {{ [searchText: string]: SearchMatch[] }}*/
const cachedSearches = {};

/**
 * @param {string} searchText
 * @return {SearchMatch[] | Promise<SearchMatch[]>}
 */
export function searchHandle(searchText) {
  if (cachedSearches[searchText]) return cachedSearches[searchText];

  const directResolvesOrPromises = searchText.split(/\s+/).filter(word => !!word).map(word => {
    const postLink = breakPostURL(word) || breakFeedUri(word);
    if (postLink) {
      let accountOrPromise = resolveHandleOrDID(postLink.shortDID);
      if (isPromise(accountOrPromise))
        return accountOrPromise.catch(() => undefined).then(account =>
          expandResolvedAccountToSearchMatch(word, account, postLink.postID));
      else
        return expandResolvedAccountToSearchMatch(word, accountOrPromise, postLink.postID);
    }

    /** @type {Promise<AccountInfo | undefined> | AccountInfo | undefined} */
    let accountOrPromise = resolveHandleOrDID(word);
    if (isPromise(accountOrPromise))
      return accountOrPromise.catch(() => undefined).then(account =>
        expandResolvedAccountToSearchMatch(word, account));
    else
      return expandResolvedAccountToSearchMatch(word, accountOrPromise);
  });

  const wordStarts = getWordStartsLowerCase(searchText, 3);
  if (!wordStarts.length) return [];

  const bucketsOrPromises = wordStarts.map(wordStart => getBucket(wordStart));
  const allStaticallyResolved =
    !directResolvesOrPromises.some(accountOrPromise => isPromise(accountOrPromise)) &&
    !bucketsOrPromises.some(bucket => isPromise(bucket));

  if (allStaticallyResolved) {
    let searchMatches = performSearchOverBuckets(
      searchText,
      /** @type {IndexedBucket[]} */(bucketsOrPromises));

    const exactMatches = /** @type {(SearchMatch & AccountInfo)[]} */(directResolvesOrPromises)
      .filter(account =>
        !!account &&
        !searchMatches.some(match => match.shortDID === account.shortDID));

    searchMatches = exactMatches.concat(searchMatches);

    cachedSearches[searchText] = searchMatches;
    return searchMatches;
  }

  return (async () => {
    const buckets = await Promise.all(bucketsOrPromises);
    const directResolves = await Promise.all(directResolvesOrPromises);
    let searchMatches = performSearchOverBuckets(searchText, buckets);

    const exactMatches = /** @type {(SearchMatch & AccountInfo)[]} */(directResolves)
      .filter(account =>
        !!account &&
        !searchMatches.some(match => match.shortDID === account.shortDID));
    searchMatches = exactMatches.concat(searchMatches);

    cachedSearches[searchText] = searchMatches;
    return searchMatches;
  })();
}

var wordStartRegExp = /[A-Z]*[a-z]*/g;
/**
 * @param {string} str
 * @param {number=} count
 * @param {string[]=} wordStarts
 */
function getWordStartsLowerCase(str, count, wordStarts) {
  if (typeof count !== 'number' || !Number.isFinite(count)) count = 3;
  if (!wordStarts) wordStarts = [];
  str.replace(wordStartRegExp, function (match) {
    const wordStart = match && match.slice(0, count).toLowerCase();
    if (wordStart && wordStart.length === count && /** @type {string[]} */(wordStarts).indexOf(wordStart) < 0)
        /** @type {string[]} */(wordStarts).push(wordStart);
    return match;
  });
  return wordStarts;
}

/** @type {{ [threeLetterPrefix: string]: Promise<IndexedBucket> | IndexedBucket }} */
const buckets = {};

/**
 * @param {string} threeLetterPrefix
 * @returns {Promise<IndexedBucket> | IndexedBucket}
 */
function getBucket(threeLetterPrefix) {
  if (buckets[threeLetterPrefix]) return buckets[threeLetterPrefix];

  // TODO: failover/retry?
  return buckets[threeLetterPrefix] = (async () => {
    const bucketPath =
      'https://colds.ky/index/' +
      threeLetterPrefix[0] + '/' +
      threeLetterPrefix.slice(0, 2) + '/' +
      threeLetterPrefix.slice(1) + '.json';

    const bucket = await fetch(bucketPath)
      .then(r => r.json())
      .catch(err => {
        console.warn(
          'Failed to fetch bucket for ' + threeLetterPrefix,
          err);
      });

    return bucket;
  })();
}

/**
 * 
 * @param {string} handleOrDID
 * @param {AccountInfo | undefined} account
 * @param {string | undefined} [postID]
 * @returns {SearchMatch & AccountInfo | undefined}
 */
function expandResolvedAccountToSearchMatch(handleOrDID, account, postID) {
  return account && {
    ...account,
    rank: 2000,
    matchShortDID:
      shortenDID(handleOrDID) === account.shortDID,
    matchHandle:
      shortenHandle(handleOrDID) === account.shortHandle,
    matchDisplayName:
      (account.displayName || '').toLowerCase().indexOf(handleOrDID.toLowerCase()) >= 0,
    postID
  };
}