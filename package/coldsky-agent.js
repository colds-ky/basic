// @ts-check

import { AtpAgent } from '@atproto/api';
import { unwrapShortPDS } from './shorten';

export const BSKY_SOCIAL_URL = 'https://bsky.social/';
export const BSKY_NETWORK_URL = 'https://bsky.network/';
export const BSKY_PUBLIC_URL = 'https://public.api.bsky.app/';

/**
 * @typedef {Omit<import('@atproto/api').AtpAgentOptions, 'service'> & {
 *  service?: import('@atproto/api').AtpAgentOptions['service'],
 *  fetch?: import('@atproto/api').AtpBaseClient['fetchHandler']
 * }} ColdskyAgentOptions
 */

export class ColdskyAgent extends AtpAgent {
  /** @param {ColdskyAgentOptions} [args] */
  constructor(args) {
    super({
      ...args,
      // most of methods work fine on bsky.social
      service:
        !args?.service ? BSKY_SOCIAL_URL :
          typeof args.service === 'string' ? unwrapShortPDS(String(args.service)) :
            args.service
    });

    // find all clients to patch
    for (const key in this.com.atproto) {
      /** @type {typeof this.com.atproto.admin} */
      const ns = this.com.atproto[key];
      const baseClient = ns._client;
      if (baseClient) this.patchBaseClient(baseClient, !!args?.service, args?.fetch);
    }
  }

  /**
   * @param {typeof this.com.atproto.sync._client} baseClient
   * @param {boolean} serviceDefined
   * @param {typeof this.com.atproto.sync._client.fetchHandler | undefined} fetchOverride
   */
  patchBaseClient(baseClient, serviceDefined, fetchOverride) {
    baseClient.lex.assertValidXrpcOutput = function (lexUri, value, ...rest) {
      return true;
    };

    if (fetchOverride) {
      if (/** @type {*} */(baseClient.fetchHandler)._patchedFetch) return;

      // @ts-ignore fetchHandler is notionally readonly
      baseClient.fetchHandler =
        fetchOverride;
        // overrideFetch(baseClient.fetch.bind(baseClient), serviceDefined);
    }
  }

}
