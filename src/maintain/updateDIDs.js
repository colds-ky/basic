// @ts-check

import { BskyAgent } from '@atproto/api';
import { shortenDID } from '../api';
import { getKeyShortDID } from '../api/core';

/**
 * @param {{
 *  readFile: (path: string) => Promise<{
 *    content: string,
 *    commit: string,
 *    timestamp: number
 *  }>
 * }} _
 */
export async function updateDIDs({
  readFile
}) {
  const startCursorFileEntry = await readFile('/dids/cursors.json');

  /** @type {import('../../dids/cursors.json')} */
  const startCursorsJSON = JSON.parse(
    startCursorFileEntry.content);

  const populatedDIDs = {
    /** @type {string[]} */
    shortDIDs: [],
    /** @type {{ [shortDID: string]: string[] }} */
    buckets: {},
    currentCursor: startCursorsJSON.listRepos.cursor,
    requestCount: 0,
    requestTime: 0,
    /** @type {Error | undefined} */
    currentError: undefined,
    currentErrorRetryTime: 0,
    reachedEnd: false
  };

  beginFetchingDIDs();

  return {
    ...startCursorsJSON,
    populatedDIDs,
    verifyGitHubAuth
  };

  /** @param {import('@atproto/api').BskyAgent} atClient */
  function patchBskyAgent(atClient) {
    atClient.com.atproto.sync._service.xrpc.baseClient.lex.assertValidXrpcOutput = function (lexUri, value, ...rest) {
      return true;
    };
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

  async function beginFetchingDIDs() {

    const atClient = new BskyAgent({
      // service: 'https://bsky.social/xrpc'
      // service: 'https://bsky.network/xrpc'
      service: 'https://bsky.network/xrpc'
    });
    patchBskyAgentWithCORSProxy(atClient);

    let lastNormal = Date.now();
    while (true) {
      const startTime = Date.now();
      try {
        let received = await fetchMore();
        populatedDIDs.requestCount++;
        populatedDIDs.requestTime += Date.now() - startTime;
        if (received)
          lastNormal = Date.now();
      } catch (error) {
        populatedDIDs.currentError = error;
        populatedDIDs.currentErrorRetryTime = Date.now() - lastNormal;
      }

      const waitMore = Math.min(
        Date.now() - startTime + 300,
        1000 * 45
      ) * (0.5 + Math.random());
      await new Promise(resolve => setTimeout(resolve, waitMore));

      if (populatedDIDs.reachedEnd) break;
    }

    async function fetchMore() {
      const response = await atClient.com.atproto.sync.listRepos({
        cursor: populatedDIDs.currentCursor,
        limit: 995
      });
      if (!response.data) return;

      if (response.data.repos.length) {
        for (const repo of response.data.repos) {
          const shortDID = shortenDID(repo.did);
          populatedDIDs.shortDIDs.push(shortDID);
          const twoLetter = getKeyShortDID(shortDID);
          if (!twoLetter) continue;
          const bucket = populatedDIDs.buckets[twoLetter] || (
            populatedDIDs.buckets[twoLetter] = []
          );
          bucket.push(shortDID);
        }
      }

      if (!response.data.cursor) {
        populatedDIDs.reachedEnd = true;
      } else {
        populatedDIDs.currentCursor = response.data.cursor;
      }

      return response.data.repos.length;
    }
  }

  async function verifyGitHubAuth(username, password) {
    //
  }
}
