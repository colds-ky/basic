// @ts-check

import { firehose as bski_firehose } from 'bski';

/** @param {string} [address] */
export async function* firehose(address) {
  for await (const record of bski_firehose(address)) {
    record['messages'] = record;
    yield record;
  }
}
