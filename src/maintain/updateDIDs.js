// @ts-check

import { BskyAgent } from '@atproto/api';
import { shortenDID } from '../api';
import { getKeyShortDID } from '../api/core';

/**
 * @param {{
 *  readFile: (path: string) => Promise<string>;
 *  provideAuthToken(token: string): Promise<{ commit: string, timestamp: number }>;
 *  commitChanges(files: { path: string, content: string}[]): Promise;
 * }} _
 */
export async function updateDIDs({
  readFile,
  provideAuthToken,
  commitChanges
}) {
  const startCursorContent = await readFile('/dids/cursors.json');

  /** @type {import('../../dids/cursors.json')} */
  const startCursorsJSON = JSON.parse(startCursorContent);
  
  let committingStarted = false;

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
        if (committingStarted) return;

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
      if (committingStarted) return;
      if (!response.data) return;

      if (response.data.repos?.length) {
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

  async function verifyGitHubAuth(authToken) {
    committingStarted = true;
    const authPromise = provideAuthToken(authToken);

    const bucketFileEntriesOrNull = await Promise.all(
      Object.entries(populatedDIDs.buckets).map(
        async ([twoLetter, bucket]) => {
          const bucketPath = twoLetter === 'web' ?
            '/dids/web.json' :
            '/dids/' + twoLetter[0] + '/' + twoLetter + '.json';

          const bucketFileContent = await readFile(bucketPath);

          /** @type {Set<string>} */
          const existingBucketShortDIDs = new Set(JSON.parse(bucketFileContent));

          const newShortDIDs = bucket.filter(shortDID => !existingBucketShortDIDs.has(shortDID));

          if (!newShortDIDs.length) return;
          const newContent =
            bucketFileContent.trim().slice(0, -1) + ',\n' +
            packDidsJson(newShortDIDs, '');

          return {
            bucketPath,
            bucket,
            newShortDIDs,
            newContent,
            oldContent: bucketFileContent
          };
        }));
    
    const bucketFileEntries =
      /** @type {NonNullable<typeof bucketFileEntriesOrNull[0]>[]} */
      (bucketFileEntriesOrNull.filter(Boolean));

    const authDetails = await authPromise;

    return {
      bucketData: bucketFileEntries,
      applyChanges
    };

    function applyChanges() {
      return commitChanges(
        bucketFileEntries.map(entry => ({
          path: entry.bucketPath,
          content: entry.newContent
        })));
    }
  }
}

function packDidsJson(dids, lead = '[\n', tail = '\n]\n') {
  const DIDS_SINGLE_LINE = 6;
  const didsLines = [];
  for (let i = 0; i < dids.length; i += DIDS_SINGLE_LINE) {
    const chunk = dids.slice(i, i + DIDS_SINGLE_LINE);
    const line = chunk.map(shortDID => '"' + shortDID + '"').join(',');
    didsLines.push(line);
  }

  return lead + didsLines.join(',\n') + tail;
}
