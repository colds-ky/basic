// @ts-check

import { BskyAgent } from '@atproto/api';
import { throttledAsyncCache } from './throttled-async-cache';
import { unwrapShortPDC } from './shorten';

export const BSKY_SOCIAL_URL = 'https://bsky.social/';
export const BSKY_NETWORK_URL = 'https://bsky.network/';
export const BSKY_PUBLIC_URL = 'https://public.api.bsky.app/';

/**
 * @typedef {Omit<ConstructorParameters<typeof BskyAgent>[0], 'service'> & {
 *  service?: ConstructorParameters<typeof BskyAgent>[0]['service'],
 *  fetch?: import('@atproto/api').AtpAgentFetchHandler
 * }} ColdskyAgentOptions
 */

export class ColdskyAgent extends BskyAgent {
  /** @param {ColdskyAgentOptions} [args] */
  constructor(args) {
    super({
      ...args,
      // most of methods work fine on bsky.social
      service: args?.service ? unwrapShortPDC(args.service) : BSKY_SOCIAL_URL,
    });

    // find all clients to patch
    for (const key in this.com.atproto) {
      /** @type {typeof this.com.atproto.admin} */
      const ns = this.com.atproto[key];
      const baseClient = ns._service?.xrpc?.baseClient;
      if (baseClient) this.patchBaseClient(baseClient, !!args?.service, args?.fetch);
    }
  }

  /**
   * @param {typeof this.com.atproto.sync._service.xrpc.baseClient} baseClient
   * @param {boolean} serviceDefined
   * @param {typeof import('@atproto/api').AtpAgentFetchHandler | undefined} fetchOverride
   */
  patchBaseClient(baseClient, serviceDefined, fetchOverride) {
    baseClient.lex.assertValidXrpcOutput = function (lexUri, value, ...rest) {
      return true;
    };

    if (fetchOverride) {
      if (/** @type {*} */(baseClient.fetch)._patchedFetch) return;
      baseClient.fetch =
        fetchOverride;
        // overrideFetch(baseClient.fetch.bind(baseClient), serviceDefined);
    }
  }

}

const typedCaches = {};

/**
 * @param {BskyAgent['com']['atproto']['sync']['_service']['xrpc']['baseClient']['fetch'] &
 *  { _patchedFetch?: boolean }} baseFetch
 * @param {boolean} [serviceDefined]
 * @returns {BskyAgent['com']['atproto']['sync']['_service']['xrpc']['baseClient']['fetch'] &
 *  { _patchedFetch?: boolean }}
 */
function overrideFetch(baseFetch, serviceDefined) {
  if (baseFetch._patchedFetch) return baseFetch;
  fetchOverride._patchedFetch = true;
  return fetchOverride;

  function fetchOverride(httpUri, httpMethod, httpHeaders, httpReqBody) {
    const useBskyNetwork =
      !serviceDefined &&
      httpUri.indexOf('com.atproto.sync.listRepos') >= 0;

    const useHttpUri = useBskyNetwork ?
      'https://corsproxy.io/?' + httpUri.replace(BSKY_SOCIAL_URL, BSKY_NETWORK_URL) :
      httpUri;

    const qPos = useHttpUri.indexOf('?');
    const httpUriKey = qPos >= 0 ? useHttpUri.slice(0, qPos) : useHttpUri;

    const headersUnique = JSON.stringify(httpHeaders);
    const httpReqBodyUnique = JSON.stringify(httpReqBody);

    let cache = typedCaches[httpUriKey];
    if (!cache) {
      cache = typedCaches[httpUriKey] = throttledAsyncCache(
        fetchWithBase,
        { maxConcurrency: 2, interval: 100 });
    }

    return cache(useHttpUri, httpMethod, headersUnique, httpReqBodyUnique);
  

    function fetchWithBase(httpUri, httpMethod, httpHeadersStringified, httpReqBodyStringified) {
      const startFetch = Date.now();
      const httpHeaders = typeof httpHeadersStringified === 'undefined' ? undefined :
        JSON.parse(httpHeadersStringified);
      const httpReqBody = typeof httpReqBodyStringified === 'undefined' ? undefined :
        JSON.parse(httpReqBodyStringified);

      return fetchWithRateHandling();

      function fetchWithRateHandling() {
        return baseFetch(httpUri, httpMethod, httpHeaders, httpReqBody).then(
          result => {
            setTimeout(() => {
              cache.evict(httpUri, httpMethod, headersUnique, httpReqBodyUnique);
            }, httpMethod === 'GET' ? 1000 : 100);
            return result;
          },
          handleFetchError);
      }

      function handleFetchError(error) {
        if (/\brate\b/i.test(error.message || '')) {
          const waitTime = Math.min(
            Math.max(1000, (Date.now() - startFetch) / 3),
            1000);

          return new Promise(resolve => setTimeout(resolve, waitTime))
            .then(() => fetchWithRateHandling());
        } else {
          setTimeout(() => {
            cache.evict(httpUri, httpMethod, headersUnique, httpReqBodyUnique);
          }, 10);

          throw error;
        }
      }
    }
  }

}