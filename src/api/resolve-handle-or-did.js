// @ts-check
/// <reference path="../types.d.ts" />

import { BskyAgent } from '@atproto/api';
import { getProfileBlobUrl, isPromise, likelyDID, shortenDID, shortenHandle, unwrapShortDID, unwrapShortHandle } from '.';
import { throttledAsyncCache } from './throttled-async-cache';
import { ColdskyAgent, BSKY_SOCIAL_URL } from '../../lib/coldsky-agent';


const resolveHandleCache = throttledAsyncCache(async (handle) => {
  const atClient = new ColdskyAgent({});

  const resolved = await atClient.com.atproto.identity.resolveHandle({
    handle: unwrapShortHandle(handle)
  });

  if (!resolved.data.did) throw new Error('Handle did not resolve: ' + handle);
  return shortenDID(resolved.data.did);
});

const resolveDIDCache = throttledAsyncCache(async (did) => {
  const fullDID = unwrapShortDID(did);
  const shortDID = shortenDID(did);

  const describePromise = atClient.com.atproto.repo.describeRepo({
    repo: fullDID
  });

  const profilePromise = atClient.com.atproto.repo.listRecords({
    collection: 'app.bsky.actor.profile',
    repo: fullDID
  });

  const [describe, profile] = await Promise.all([describePromise, profilePromise]);

  if (!describe.data.handle) throw new Error('DID does not have a handle: ' + did);

  const shortHandle = shortenHandle(describe.data.handle);

  /** @type {*} */
  const profileRec = profile.data.records?.filter(rec => rec.value)[0]?.value;
  const avatarUrl = getProfileBlobUrl(fullDID, profileRec?.avatar?.ref?.toString());
  const bannerUrl = getProfileBlobUrl(fullDID, profileRec?.banner?.ref?.toString());
  const displayName = profileRec?.displayName;
  const description = profileRec?.description;

  const profileDetails = {
    shortDID,
    shortHandle,
    avatarUrl,
    bannerUrl,
    displayName,
    description
  };

  resolveHandleCache.prepopulate(shortDID, shortHandle);
  return profileDetails;
});

/**
 * @param {string} handleOrDid
 * @returns {AccountInfo | Promise<AccountInfo>}
 */
export function resolveHandleOrDID(handleOrDid) {
  if (likelyDID(handleOrDid)) return resolveDIDCache(unwrapShortDID(handleOrDid));
  const didOrPromise = resolveHandleCache(unwrapShortHandle(handleOrDid));

  if (isPromise(didOrPromise)) return didOrPromise.then(resolveDIDCache);
  else return resolveDIDCache(didOrPromise);
}
resolveHandleOrDID.peek = peekHandleOrDID;

/**
 * @param {string | null | undefined} handleOrDID
 * @returns {AccountInfo | undefined}
 */
function peekHandleOrDID(handleOrDID) {
  if (!handleOrDID) return;
  if (likelyDID(handleOrDID)) return resolveDIDCache.peek(unwrapShortDID(handleOrDID));
  return resolveHandleCache.peek(unwrapShortHandle(handleOrDID));
}
