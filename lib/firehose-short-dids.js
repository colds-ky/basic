// @ts-check

import { firehose } from './firehose';
import { breakFeedUri, shortenDID } from './shorten';

/**
 * @typedef {{
 *  [shortDID: string]: number | undefined, error?: undefined, errorCount?: undefined, waitUntil?: undefined } | {
 *  error: Error,
 *  errorCount: number,
 *  waitUntil: number }} FirehoseShortDIDs
 */

/**
 * @param {(shortDID: string) => number} [filterShortDIDs]
 * @returns {AsyncGenerator<FirehoseShortDIDs>}
 */
export async function* firehoseShortDIDs(filterShortDIDs) {

  /** @type {FirehoseShortDIDs} */
  let shortDIDs = {};
  let addedAny = false;

  let lastHealth = Date.now();
  let errorCount = 0;
  while (true) {
    try {
      for await (const block of firehose()) {
        lastHealth = Date.now();
        if (!block?.length) continue;

        for (const entry of block) {
          if (!entry.messages?.length) continue;

          for (const msg of entry.messages) {
            collectShortDIDs(msg);
          }
        }

        if (addedAny) {
          /** @type {(typeof shortDIDs) & { error?: undefined, errorCount?: number, waitUntil?: undefined }} */
          const report = shortDIDs;
          shortDIDs = {};
          addedAny = false;
          yield report;
        }
      }
    } catch (error) {
      errorCount++;
      const now = Date.now();
      let waitFor = Math.min(
        30000,
        Math.max(300, (now - lastHealth) / 3)
      ) * (0.7 + Math.random() * 0.6);

      console.error('firehose error ' + errorCount + ', retry in ' + waitFor + 'ms ', error);

      yield { error: /** @type {Error} */(error), errorCount, waitUntil: now + waitFor };

      return new Promise(resolve => setTimeout(resolve, waitFor));
    }
  }

  /**
   * @param {import('./firehose').FirehoseMessage} msg 
   */
  function collectShortDIDs(msg) {
    addShortDID(msg.repo);
    switch (msg.$type) {
      case 'app.bsky.feed.like':
        addShortDID(breakFeedUri(msg.subject?.uri)?.shortDID);
        return;

      case 'app.bsky.feed.post':
        addShortDID(breakFeedUri(msg.reply?.parent?.uri)?.shortDID);
        addShortDID(breakFeedUri(msg.reply?.root?.uri)?.shortDID);
        if (msg.embed?.$type === 'app.bsky.embed.record')
          addShortDID(breakFeedUri(/** @type {*} */(msg.embed?.record)?.uri)?.shortDID);
        return;

      case 'app.bsky.feed.repost':
        addShortDID(breakFeedUri(msg.subject?.uri)?.shortDID);
        return;

      case 'app.bsky.feed.threadgate':
        // TODO extend
        return;

      case 'app.bsky.graph.follow':
        addShortDID(msg.subject);
        return;

      case 'app.bsky.graph.block':
        addShortDID(msg.subject);
        return;

      case 'app.bsky.graph.list':
        // TODO extend
        return;

      case 'app.bsky.graph.listitem':
        addShortDID(msg.subject);
        return;

      case 'app.bsky.actor.profile':
        return;
    }
  }

  /**
   * @param {string | undefined} did
   * @param {number} [ratio]
   */
  function addShortDID(did, ratio) {
    if (!did) return;
    const shortDID = shortenDID(did);
    let increment =
      (typeof filterShortDIDs === 'function' ? filterShortDIDs(did) : 1) * (ratio || 1);
    if (!increment) return;

    shortDIDs[shortDID] = (shortDIDs[shortDID] || 0) + increment;
    addedAny = true;
  }
}