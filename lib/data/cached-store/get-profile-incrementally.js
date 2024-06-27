// @ts-check

import { isPromise } from '../../is-promise';
import { likelyDID, shortenDID, unwrapShortDID, unwrapShortHandle } from '../../shorten';

/**
 * @typedef {{
 *  didOrHandle: string | null | undefined,
 *  agent_getProfile_throttled: (did) => ReturnType<import('@atproto/api').BskyAgent['getProfile']>,
 *  agent_resolveHandle_throttled: (handle) => ReturnType<import('@atproto/api').BskyAgent['resolveHandle']>,
 *  dbStore: ReturnType<typeof import('../define-cache-indexedDB-store').defineCacheIndexedDBStore>
 * }} Args
 */

/**
 * @param {Args} _
 */
export async function* getProfileIncrementally({
  didOrHandle,
  dbStore,
  agent_getProfile_throttled,
  agent_resolveHandle_throttled
}) {
  if (!didOrHandle) return;

  let profileRemotePromise;
  if (likelyDID(didOrHandle)) {
    profileRemotePromise = agent_getProfile_throttled(unwrapShortDID(didOrHandle));
  } else {
    const resolveHandlePromise = agent_resolveHandle_throttled(unwrapShortHandle(didOrHandle));
    if (isPromise(resolveHandlePromise)) {
      profileRemotePromise = (async () => {
        const rec = await resolveHandlePromise;
        const shortDID = shortenDID(rec.data.did);
        return agent_getProfile_throttled(unwrapShortDID(shortDID));
      })();
    } else {
      const rec = resolveHandlePromise;
      const shortDID = shortenDID(/** @type {*} */(rec).data.did);
      profileRemotePromise = agent_getProfile_throttled(unwrapShortDID(shortDID));
    }
  }

  const profileLocal = await dbStore.getProfile(didOrHandle);
  if (profileLocal) yield profileLocal;

  const profileRemoteRaw = (await profileRemotePromise).data;
  const profileRemoteResolved = dbStore.captureProfileView(profileRemoteRaw, Date.now());
  yield profileRemoteResolved;
}
