// @ts-check

import { firehose as rawFirehose } from '../../firehose';

/** @typedef {import('..').CompactPost} CompactPost */
/** @typedef {import('..').CompactProfile} CompactProfile */

/**
 * @param {ReturnType<typeof import('../define-cache-indexedDB-store').defineCacheIndexedDBStore>} dbStore
 * @returns {AsyncGenerator<import('..').CompactFirehoseBlock>}
 */
export async function* firehose(dbStore) {
  for await (const block of rawFirehose()) {
    /** @type {Map<string, CompactPost>} */
    const updatedPosts = new Map();
    /** @type {Map<string, CompactProfile>} */
    const updatedProfiles = new Map();

    /** @type {import('../../firehose').FirehoseRecord[]} */
    const all = [];

    /** @type {import('../../firehose').FirehoseRepositoryRecord<keyof import('../../firehose').RepositoryRecordTypes$>[]} */
    const records = [];

    /** @type {import('../../firehose').FirehoseDeleteRecord[] | undefined} */
    let deletes;

    /** @type {import('../../firehose').FirehoseErrorRecord[] | undefined} */
    let errors;

    for (const rec of block) {
      all.push(rec);
      if (rec.$type === 'error') {
        if (!errors) errors = [];
        errors.push(rec);
      } else if (rec.action === 'delete') {
        dbStore.deleteRecord(rec);
        if (!deletes) deletes = [];
        deletes.push(rec);
      } else if (rec.action === 'create' || rec.action === 'update') {
        records.push(rec);

        const updated = dbStore.captureRecord(rec, rec.receiveTimestamp);
        if (updated) {
          if ('uri' in updated) updatedPosts.set(updated.uri, updated);
          else updatedProfiles.set(updated.shortDID, updated);
        }
      }
    }

    yield {
      records,
      posts: [...updatedPosts.values()],
      profiles: [...updatedProfiles.values()],
      all,
      deletes,
      errors
    };
  }
}