// @ts-check

import { breakFeedURIPostOnly, firehose, isPromise, shortenDID, unwrapShortDID } from '../package';

/** @param {import('../app').DBAccess} db */
export function streamStats(db) {
  const byType = {};
  const errors = {};
  let receiveStart = 0;
  let parseTime = 0;
  let count = 0;
  let batchCount = 0;

  /** @type {Record<string, number>} */
  const posters = {};

  /** @type {Record<string, number>} */
  const likers = {};

  /** @type {Record<string, number>} */
  const likeds = {};

  return run;

  async function* run() {
    for await (const block of firehose()) {
      batchCount++;
      count += block.length;
      if (!receiveStart) receiveStart = Date.now();

      for (const msg of block) {
        byType[msg.$type] = (byType[msg.$type] || 0) + 1;
        parseTime += msg.parseTime;

        if (msg.$type === 'error') {
          errors[msg.message] = (errors[msg.message] || 0) + 1;
        }

        if (msg.$type === 'app.bsky.feed.post' && Math.random() > -20) {
          const shortDID = shortenDID(msg.repo);

          posters[shortDID] = (posters[shortDID] || 0) + 1;
        } if (msg.$type === 'app.bsky.feed.like' && msg.action === 'create' && Math.random() > 20) {
          const shortDID = shortenDID(msg.repo);
          const subject = breakFeedURIPostOnly(msg.subject.uri);
          if (subject) {
            likeds[subject.shortDID] = (likeds[subject.shortDID] || 0) + 1;
          }

          const likerPromise = getProfile(shortDID);
          const likedPromise = getProfile(subject?.shortDID);

          let liker = likerPromise && !isPromise(likerPromise) ? likerPromise : undefined;
          let liked = likedPromise && !isPromise(likedPromise) ? likedPromise : undefined;

          if (!liker || !liked)
            [liker, liked] = await Promise.all([likerPromise, likedPromise]);

          const likerHandle = liker?.handle || shortDID;
          const likedHandle = liked?.handle || subject?.shortDID;

          if (likerHandle) likers[likerHandle] = (likers[likerHandle] || 0) + 1;
          if (likedHandle) likeds[likedHandle] = (likeds[likedHandle] || 0) + 1;
        }
      }

      let [topPosters, topLikers, topLikeds] = [posters, likers, likeds].map(topAndResolveHandles);
      const anyPromises = isPromise(topPosters) || isPromise(topLikers) || isPromise(topLikeds);
      if (anyPromises) {
        [topPosters, topLikers, topLikeds] = await Promise.all([topPosters, topLikers, topLikeds]);
      }

      yield {
        perSecond: count * 1000 / (Date.now() - receiveStart),
        perBatch: count / batchCount,
        parsePerMessage: parseTime / count,
        topPosters,
        topLikers,
        topLikeds,
        errors: { ...errors },
        ...byType,
      };

      await new Promise(resolve => setTimeout(resolve, 220));
    }
  }

  /** @param {Record<string, number>} counts */
  async function topAndResolveHandles(counts) {
    const shortDIDCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (!shortDIDCounts?.length || shortDIDCounts[shortDIDCounts.length - 1][1] < 2) return {};

    let profilesOrPromises = shortDIDCounts.map(([shortDID]) => getProfile(shortDID));
    let anyPromises = profilesOrPromises.some(isPromise);
    if (anyPromises) {
      profilesOrPromises = await Promise.all(profilesOrPromises);
    }
    return Object.fromEntries(profilesOrPromises.map((profile, i) => [
      (/** @type {*} */(profile)?.handle || '') + ' ' + unwrapShortDID(shortDIDCounts[i][0]),
      shortDIDCounts[i][1]]));
  }

  function getProfile(handleOrDID) {
    if (!handleOrDID) return;

    const direct = db.getProfileOnly(handleOrDID);
    if (direct && !isPromise(direct)) return direct;

    return getProfileLong(handleOrDID);
  }

  async function getProfileLong(handleOrDID) {
    for await (const profile of db.getProfileIncrementally(handleOrDID)) {
      if (profile.handle) return profile;
    }
  }
}