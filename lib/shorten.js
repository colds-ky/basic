// @ts-check

/** @param {string | null | undefined} text */
export function likelyDID(text) {
  return !!text && (
    !text.trim().indexOf('did:') ||
    text.trim().length === 24 && !/[^\sa-z0-9]/i.test(text)
  );
}

/**
 * @param {T} did
 * @returns {T}
 * @template {string | undefined | null} T
 */
export function shortenDID(did) {
  return did && /** @type {T} */(did.replace(_shortenDID_Regex, '').toLowerCase() || undefined);
}

const _shortenDID_Regex = /^did\:plc\:/;

/**
 * @param {T} shortDID
 * @returns {T}
 * @template {string | undefined | null} T
 */
export function unwrapShortDID(shortDID) {
  return /** @type {T} */(
    !shortDID ? undefined : shortDID.indexOf(':') < 0 ? 'did:plc:' + shortDID.toLowerCase() : shortDID.toLowerCase()
  );
}

/**
 * @param {T} handle
 * @returns {T}
 * @template {string | undefined | null} T
 */
export function shortenHandle(handle) {
  handle = cheapNormalizeHandle(handle);
  return handle && /** @type {T} */(handle.replace(_shortenHandle_Regex, '').toLowerCase() || undefined);
}
const _shortenHandle_Regex = /\.bsky\.social$/;

/**
 * @param {T} shortHandle
 * @returns {T}
 * @template {string | undefined | null} T
 */
export function unwrapShortHandle(shortHandle) {
  if (likelyDID(shortHandle)) return unwrapShortDID(shortHandle);
  shortHandle = cheapNormalizeHandle(shortHandle);
  return /** @type {T} */(
    !shortHandle ? undefined : shortHandle.indexOf('.') < 0 ? shortHandle.toLowerCase() + '.bsky.social' : shortHandle.toLowerCase()
  );
}

function cheapNormalizeHandle(handle) {
  handle = handle && handle.trim().toLowerCase();

  if (handle && handle.charCodeAt(0) === 64)
    handle = handle.slice(1);

  const urlprefix = 'https://bsky.app/';
  if (handle && handle.lastIndexOf(urlprefix, 0) === 0) {
    const postURL = breakPostURL(handle);
    if (postURL && postURL.shortDID)
      return postURL.shortDID;
  }

  if (handle && handle.lastIndexOf('at:', 0) === 0) {
    const feedUri = breakFeedUri(handle);
    if (feedUri && feedUri.shortDID)
      return feedUri.shortDID;

    if (handle && handle.lastIndexOf('at://', 0) === 0) handle = handle.slice(5);
    else handle = handle.slice(3);
  }

  return handle || undefined;
}

/** @param {string | undefined | null} pdc */
export function shortenPDC(pdc) {
  if (!pdc) return undefined;

  pdc = pdc.trim().toLowerCase();

  if (pdc === 'https://bsky.social') return '.s';
  else if (pdc === 'https://bsky.network') return '.n';
  else if (pdc === 'https://bsky.app') return '.a';

  // https://morel.us-east.host.bsky.network
  return pdc.replace(/^https:\/\//, '').replace(/host\.bsky\.network$/, '');
}

export function unwrapShortPDC(shortPDC) {
  if (!shortPDC) return undefined;

  if (shortPDC === '.s') return 'https://bsky.social';
  else if (shortPDC === '.n') return 'https://bsky.network';
  else if (shortPDC === '.a') return 'https://bsky.app';
  if (/^http:/i.test(shortPDC) || /^https:/i.test(shortPDC)) return shortPDC;

  return 'https://' + shortPDC + 'host.bsky.network';
}

/**
 * dd+hh:mm:ss - like 30+23:59:59
 * @param {string | null | undefined} dtOffsetStr
 */
export function parseTimestampOffset(dtOffsetStr) {

  if (!dtOffsetStr) return undefined;

  let offset = 0;
  let lead = 0;
  const plusPos = dtOffsetStr.indexOf('+');
  if (plusPos >= 0) {
    offset = Number(dtOffsetStr.substring(0, plusPos)) * 24 * 60 * 60 * 1000;
    lead = plusPos + 1;
  }

  const secondsColonPos = dtOffsetStr.lastIndexOf(':');
  if (secondsColonPos < 0) {
    offset += Number(dtOffsetStr.substring(lead)) * 1000;
  } else {
    offset += Number(dtOffsetStr.substring(secondsColonPos + 1)) * 1000;

    const minutesColonPos = dtOffsetStr.lastIndexOf(':', secondsColonPos - 1);
    if (minutesColonPos < 0) {
      offset += Number(dtOffsetStr.substring(lead, secondsColonPos)) * 60 * 1000;
    } else {
      offset += Number(dtOffsetStr.substring(minutesColonPos + 1, secondsColonPos)) * 60 * 1000;
      offset += Number(dtOffsetStr.substring(lead, minutesColonPos)) * 60 * 60 * 1000;
    }
  }

  return offset;
}

const offsetTooLarge = Date.UTC(2022, 1, 1);

/**
 * @param {number} offset
 * @returns dd+hh:mm:ss like 30+23:59:59 or 59:59.999
 */
export function timestampOffsetToString(offset) {
  if (offset > offsetTooLarge) {
    console.error('timestampOffsetToString: offset too large', offset, new Date(offset));
  }

  const milliseconds = offset % 1000;
  offset = (offset - milliseconds) / 1000;
  const seconds = offset % 60;
  offset = (offset - seconds) / 60;
  const minutes = offset % 60;
  offset = (offset - minutes) / 60;
  const hours = offset % 24;
  const days = (offset - hours) / 24;

  let str = (100 + seconds).toString().slice(1);
  if (milliseconds) {
    str = str + '.' + (1000 + milliseconds).toString().slice(1).replace(/0+$/, '');
  }

  if (days + hours + minutes) {
    str = (100 + minutes).toString().slice(1) + ':' + str;
    if (days + hours) {
      str = hours.toString() + ':' + str;
      if (days) {
        str = days + '+' + str;
      }
    }
  }

  // no need for leading zero
  if (str.lastIndexOf('0', 0) === 0) str = str.slice(1);

  return str;
}

/**
* @param {string | null | undefined} url
*/
export function breakPostURL(url) {
  if (!url) return;
  const matchBsky = _breakBskyPostURL_Regex.exec(url);
  if (matchBsky) return { shortDID: shortenDID(matchBsky[1]), postID: matchBsky[2]?.toString().toLowerCase() };
  const matchGisting = _breakGistingPostURL_Regex.exec(url);
  if (matchGisting) return { shortDID: shortenDID(matchGisting[2]), postID: matchGisting[3]?.toString().toLowerCase() };
}
const _breakBskyPostURL_Regex = /^http[s]?\:\/\/bsky\.app\/profile\/([a-z0-9\.\:\-]+)\/post\/([a-z0-9]+)(\/|$)/i;
const _breakGistingPostURL_Regex = /^http[s]?\:\/\/(gist\.ing|gisti\.ng|gist\.ink)\/([a-z0-9\.\:\-]+)\/([a-z0-9]+)(\/|$)/i;

/**
* @param {string | null | undefined} url
*/
export function detectProfileURL(url) {
  if (!url) return;
  const matchBsky = _detectBskyProfileURL_Regex.exec(url);
  if (matchBsky) return shortenDID(matchBsky[1]);
  const matchGisting = _detectGistingProfileURL_Regex.exec(url);
  if (matchGisting) return shortenDID(matchGisting[2]);
  const matchOyinboReceipts = _detectOyinboReceiptsURL_Regex.exec(url);
  if (matchOyinboReceipts) return shortenDID(matchOyinboReceipts[1]);
  const matchClearSky = _detectClearSkyProfileURL_Regex.exec(url);
  if (matchClearSky) return shortenDID(matchClearSky[2]);
}
const _detectBskyProfileURL_Regex = /^http[s]?\:\/\/bsky\.app\/profile\/([a-z0-9\.\:\-]+)(\/|$)/i;
const _detectGistingProfileURL_Regex = /^http[s]?\:\/\/(gist\.ing|gisti\.ng|gist\.ink)\/([a-z0-9\.\:\-]+)(\/|$)/i;
const _detectOyinboReceiptsURL_Regex = /^http[s]?\:\/\/oyin\.bo\/receipts\/?\?handle\=([a-z0-9\.\:\-]+)(\/|$)/i;
const _detectClearSkyProfileURL_Regex = /^http[s]?\:\/\/(clearsky\.app|bsky\.thieflord\.dev)\/([a-z0-9\.\:\-]+)(\/|$)/i;

export function makeFeedUri(shortDID, postID) {
  return 'at://' + unwrapShortDID(shortDID) + '/app.bsky.feed.post/' + postID;
}

/**
* @param {string | null | undefined} uri
*/
export function breakFeedUri(uri) {
  if (!uri) return;
  const match = _breakFeedUri_Regex.exec(uri);
  if (!match || !match[3]) return;
  return { shortDID: match[2], postID: match[3] };
}
const _breakFeedUri_Regex = /^at\:\/\/(did:plc:)?([a-z0-9]+)\/[a-z\.]+\/?(.*)?$/;

export function getProfileBlobUrl(did, cid) {
  if (!did || !cid) return undefined;
  return `https://cdn.bsky.app/img/avatar/plain/${unwrapShortDID(did)}/${cid}@jpeg`;
}

export function getFeedBlobUrl(did, cid) {
  if (!did || !cid) return undefined;
  return `https://cdn.bsky.app/img/feed_thumbnail/plain/${unwrapShortDID(did)}/${cid}@jpeg`;
}