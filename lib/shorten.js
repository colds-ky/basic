// @ts-check

/** @param {string | null | undefined} text */
export function likelyDID(text) {
  return text && (
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

export function unwrapShortDID(shortDID) {
  return !shortDID ? undefined : shortDID.indexOf(':') < 0 ? 'did:plc:' + shortDID.toLowerCase() : shortDID.toLowerCase();
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

export function unwrapShortHandle(shortHandle) {
  shortHandle = cheapNormalizeHandle(shortHandle);
  return !shortHandle ? undefined : shortHandle.indexOf('.') < 0 ? shortHandle.toLowerCase() + '.bsky.social' : shortHandle.toLowerCase();
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

  return 'https://' + shortPDC + 'host.bsky.network';
}

/** dd+hh:mm:ss */
export function parseTimestampOffset(dtOffsetStr) {
  // 30+23:59:59

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

/** dd+hh:mm:ss */
export function timestampOffsetToString(offset) {
  offset = Math.floor(offset / 1000);
  const seconds = offset % 60;
  offset = (offset - seconds) / 60;
  const minutes = offset % 60;
  offset = (offset - minutes) / 60;
  const hours = offset % 24;
  const days = (offset - hours) / 24;

  let str = (100 + seconds).toString().slice(1);
  if (days + hours + minutes) {
    str = (100 + minutes).toString().slice(1) + ':' + str;
    if (days + hours) {
      str = hours.toString() + ':' + str;
      if (days) {
        str = days + '+' + str;
      }
    }
  }

  return str;
}

/**
* @param {string | null | undefined} url
*/
export function breakPostURL(url) {
  if (!url) return;
  const match = _breakPostURL_Regex.exec(url);
  if (!match) return;
  return { shortDID: match[1], postID: match[2] };
}
const _breakPostURL_Regex = /^http[s]?\:\/\/bsky\.app\/profile\/([a-z0-9\.\:]+)\/post\/([a-z0-9]+)$/;

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
