// @ts-check

import { firehose as rawFirehose } from '../../firehose';

/** @typedef {import('..').CompactPost} CompactPost */
/** @typedef {import('..').CompactProfile} CompactProfile */

/**
 * @param {ReturnType<typeof import('../define-cache-indexedDB-store').defineCacheIndexedDBStore>} dbStore
 * @returns {AsyncGenerator<import('..').CompactFirehoseBlock>}
 */
export async function* firehose(dbStore) {
  for await (const blockSet of rawFirehose()) {
    /** @type {Map<string, CompactPost>} */
    const updatedPosts = new Map();
    /** @type {Map<string, CompactProfile>} */
    const updatedProfiles = new Map();

    /** @type {import('../../firehose').FirehoseRecord[]} */
    const messages = [];

    /** @type {import('../../firehose').FirehoseRecord[] | undefined} */
    let deletes;

    /** @type {import('../../firehose').FirehoseRecord[] | undefined} */
    let unexpecteds;

    for (const block of blockSet) {
      if (block.messages) {
        for (const rec of block.messages) {
          messages.push(rec);
          const updated = dbStore.captureRecord(rec, block.receiveTimestamp);
          if (updated) {
            if ('uri' in updated) updatedPosts.set(updated.uri, updated);
            else updatedProfiles.set(updated.shortDID, updated);
          }
        }
      }

      if (block.deletes?.length) {
        if (!deletes) deletes = [];
        for (const rec of block.deletes) {
          dbStore.deleteRecord(rec);
          deletes.push(rec);
        }
      }

      if (block.unexpected?.length) {
        if (!unexpecteds) unexpecteds = block.unexpected;
        else if (block.unexpected.length === 1) unexpecteds.push(block.unexpected[0]);
        else unexpecteds = unexpecteds.concat(block.unexpected);
      }
    }

    yield {
      messages,
      posts: [...updatedPosts.values()],
      profiles: [...updatedProfiles.values()],
      deletes,
      unexpecteds
    };
  }
}