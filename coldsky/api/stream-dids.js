// @ts-check

import { BskyAgent } from '@atproto/api';

/** @param {string} startCursor */
export async function* streamDIDs(startCursor) {
  const atClient = new BskyAgent({
    // service: 'https://bsky.social/xrpc'
    service: 'https://bsky.network/xrpc'
  });
  patchBskyAgentWithCORSProxy(atClient);

  let requestCount = 0;
  let requestTime = 0;
  /** @type {Error | undefined} */
  let currentError = undefined;
  let currentErrorRetryTime = 0;
  let currentCursor = startCursor;

  let lastNormal = Date.now();
  while (true) {
    const startTime = Date.now();
    let received;
    try {
      received = await fetchMore();
      requestCount++;
      requestTime += Date.now() - startTime;
      if (received.dids.length)
        lastNormal = Date.now();
    } catch (error) {
      currentError = error;
      currentErrorRetryTime = Date.now() - lastNormal;
    }

    // mark the preferred resume time --
    // for when we yield the execution is frozen anyway
    const now = Date.now();
    const waitUntil = now + Math.min(
      Date.now() - startTime + 300,
      1000 * 45
    ) * (0.5 + Math.random());

    if (received?.dids.length) yield makeYieldObject(received.dids);

    const waitMore = waitUntil - Date.now();
    if (waitMore > 0)
      await new Promise(resolve => setTimeout(resolve, waitMore));

    if (received?.reachedEnd) return makeYieldObject(received.dids);
  }

  /** @param {string[]} dids */
  function makeYieldObject(dids) {
    return {
      dids,
      stats: {
        requestCount,
        requestTime,
        currentError,
        currentErrorRetryTime,
        currentCursor
      }
    }
  }

  async function fetchMore() {
    const response = await atClient.com.atproto.sync.listRepos({
      cursor: currentCursor,
      limit: 995
    });
    if (!response?.data) return { reachedEnd: true, dids: [] };

    /** @type {string[]} */
    let dids = [];
    if (response.data.repos?.length) {
      for (const repo of response.data.repos) {
        if (repo.did) dids.push(repo.did);
      }
    }

    return {
      reachedEnd: !response.data.cursor,
      dids
    };
  }
}

/** @param {import('@atproto/api').BskyAgent} atClient */
function patchBskyAgentWithCORSProxy(atClient) {
  atClient.com.atproto.sync._service.xrpc.baseClient.lex.assertValidXrpcOutput = function (lexUri, value, ...rest) {
    return true;
  };

  if (typeof window !== 'undefined' && window) {
    // only patch CORS for browser
    const baseFetch = atClient.com.atproto.sync._service.xrpc.baseClient.fetch;
    atClient.com.atproto.sync._service.xrpc.baseClient.fetch = function (reqUri, ...args) {
      if (/com.atproto.sync.listRepos/.test(reqUri))
        reqUri = 'https://corsproxy.io/?' + reqUri;

      return baseFetch.call(
        atClient.com.atproto.sync._service.xrpc.baseClient,
        reqUri,
        ...args);
    };
  }
}