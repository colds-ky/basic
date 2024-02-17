// @ts-check

/**
 * @typedef {{
 *  error: Error,
 *  started: number,
 *  tryCount: number,
 *  waitUntil: number
 * }} RetryArgs
 */

/**
 * @param {Parameters<typeof fetch>[0] & { onretry?: ({}: RetryArgs) => void, nocorsproxy?: boolean }} req
 * @param {Parameters<typeof fetch>[1] & { onretry?: ({}: RetryArgs) => void, nocorsproxy?: boolean }} [init]
 * @returns {ReturnType<typeof fetch>}
 */
export async function retryFetch(req, init, ...rest) {
  // only allow GET requests to use corsproxy
  let corsproxyMightBeNeeded = (init?.method || '').toUpperCase() === 'get';
  if (req.nocorsproxy || init?.nocorsproxy) corsproxyMightBeNeeded = false;

  const started = Date.now();
  let tryCount = 0;
  while (true) {

    try {
      const useCors = tryCount && corsproxyMightBeNeeded && Math.random() > 0.5;
      const re = useCors ? await fetchWithCors(req, init) : await fetch(req, init, ...rest);

      if (re.status >= 200 && re.status < 400 ||
        re.status === 404) {
        // success or 404 is a sign of request having been processed
        if (!useCors) corsproxyMightBeNeeded = false;
        return re;
      }

      retry(new Error('HTTP' + re.status + ' ' + re.statusText));
    } catch (e) {
      await retry(e);
    }
  }

  /** @param {Error} error */
  function retry(error) {
    tryCount++;
    let onretry = req.onretry || init?.onretry;

    const now = Date.now();
    let waitFor = Math.min(
      30000,
      Math.max(300, (now - started) / 3)
    ) * (0.7 + Math.random() * 0.6);

    if (typeof onretry === 'function') {
      const args = { error, started, tryCount, waitUntil: now + waitFor };
      onretry(args);

      // allow adjusting the timeout from onretry callback
      if (args.waitUntil >= now)
        waitFor = args.waitUntil - now;
    }

    console.warn(
      tryCount + ' error' + (tryCount > 1 ? 's' : '') +
      ', retry in ', waitFor, 'ms ',
      req,
      error);

    return new Promise(resolve => setTimeout(resolve, waitFor));
  }
}

/**
 * @param {Parameters<typeof fetch>[0]} req
 * @param {Parameters<typeof fetch>[1]} [init]
 * @returns {ReturnType<typeof fetch>}
 */
function fetchWithCors(req, init, ...rest) {
  if (typeof req === 'string') {
    req = wrapCorsProxy(req);
  } else if (req instanceof Request) {
    req = new Request(wrapCorsProxy(req.url), req);
  } else if (req instanceof URL) {
    req = new URL(wrapCorsProxy(req.href));
  } else {
    req = {
      .../** @type {*} */(req),
      url: wrapCorsProxy(/** @type {*} */(req).url)
    };
  }

  return /** @type {*} */(fetch)(req, init, ...rest);
}

/** @param {string} url */
function wrapCorsProxy(url) {
  const dt = Date.now();
  const wrappedURL =
    'https://corsproxy.com/?' + url +
    (url.indexOf('?') < 0 ? '?' : '&') + 't' + dt + '=' + (dt + 1);
  return wrappedURL;
}