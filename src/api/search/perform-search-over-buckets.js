// @ts-check
/// <reference path="../../types.d.ts" />

/**
 * @param {string} searchText
 * @param {(import('./search-handle').IndexedBucket | undefined)[]} buckets
 * @return {SearchMatch[]}
 */
export function performSearchOverBuckets(searchText, buckets) {
  const searchWords = searchText.split(/\s+/g)
    .map(function (w) { return w.trim().toLowerCase(); })
    .filter(function (w) { return !!w; });

  const combinedSearchUniverse = [];
  for (const bucket of buckets) {
    if (!bucket) continue;
    for (var shortDID in bucket) {
      const accountIndexEntry = bucket[shortDID];
      if (typeof accountIndexEntry === 'string')
        combinedSearchUniverse.push({ shortDID: shortDID, shortHandle: accountIndexEntry });
      else if (Array.isArray(accountIndexEntry))
        combinedSearchUniverse.push({ shortDID: shortDID, shortHandle: accountIndexEntry[0], displayName: accountIndexEntry[1] });
    }
  }

  const searchResults = [];
  for (const entry of combinedSearchUniverse) {
    const shortDID = entry.shortDID;
    const shortHandle = entry.shortHandle || '';
    const displayName = entry.displayName || '';

    let rank = 0;
    let matchShortDID = false;
    let matchHandle = false;
    let matchDisplayName = false;
    for (const searchWord of searchWords) {
      const shortDIDRank = rankShortDID(searchWord, shortDID);
      if (shortDIDRank) matchShortDID = true;
      const handleRank = rankHandle(searchWord, shortHandle);
      if (handleRank) matchHandle = true;
      const displayNameRank = rankDisplayName(searchWord, displayName);
      if (displayNameRank) matchDisplayName = true;

      rank += shortDIDRank + handleRank + displayNameRank;
    }

    if (rank > 0) searchResults.push({
      shortDID,
      shortHandle,
      displayName: displayName || undefined,
      rank,

      matchShortDID,
      matchHandle,
      matchDisplayName
    });
  }

  searchResults.sort(function (a, b) {
    return b.rank - a.rank;
  });

  return searchResults;
}

/**
 * @param {string | null | undefined} searchString
 * @param {string | null | undefined} shortDID
 */
function rankShortDID(searchString, shortDID) {
  if (!searchString || !shortDID) return 0;
  if (searchString.endsWith('did:plc:') && ('did:plc:' + shortDID).endsWith(searchString)) return 2000;
  if (shortDID.startsWith(searchString)) return 1000;
  return 0;
}

/**
 * @param {string | null | undefined} searchString
 * @param {string | null | undefined} handle
 */
function rankHandle(searchString, handle) {
  if (!searchString || !handle) return 0;
  if (searchString.endsWith('.bsky.social')) {
    if (handle.indexOf('.') >= 0 && handle + '.bsky.social' === searchString) return 2000;
    else rankHandle(searchString.slice(0, -('.bsky.social').length), handle) / 2;
  }

  let posInHandle =
    handle.indexOf(searchString);

  let downRankRatio = 1;
  if (posInHandle < 0) {
    posInHandle = handle.replace(/[^a-z0-9]/g, '').indexOf(searchString);
    if (posInHandle >= 0) downRankRatio = 0.5;
  }

  if (posInHandle < 0) return 0;
  if (posInHandle === 0) return searchString.length * 1.5 * downRankRatio;
  else return searchString.length * 0.8 * downRankRatio;
}

/**
 * @param {string | null | undefined} searchString
 * @param {string | null | undefined} displayName
 */
function rankDisplayName(searchString, displayName) {
  if (!searchString || !displayName) return 0;
  const displayNameLower = displayName.toLowerCase();
  const posInDisplayName = displayNameLower.indexOf(searchString);
  if (posInDisplayName < 0) return 0;
  if (posInDisplayName === 0) return searchString.length * 1.5;
  if (displayName.charAt(posInDisplayName - 1) === ' ') return searchString.length * 0.9;
  else return searchString.length * 0.5;
}