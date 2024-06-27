// @ts-check

import { isPromise } from '../../is-promise';
import { breakFeedURIPostOnly, unwrapShortDID } from '../../shorten';

/**
 * @typedef {{
 *  uri: string | null | undefined,
 *  agent_getRepoRecord_throttled: (repo, rkey, collection) => ReturnType<import('@atproto/api').BskyAgent['com']['atproto']['repo']['getRecord']>,
 *  dbStore: ReturnType<typeof import('../define-cache-indexedDB-store').defineCacheIndexedDBStore>
 * }} Args
 */

/**
 * @param {Args} args
 */
export function getPostOnly(args) {
  if (!args.uri) return;
  const dbPost = args.dbStore.getPostOnly(args.uri);
  if (dbPost && !isPromise(dbPost) && !dbPost.placeholder) return dbPost;

  if (!dbPost || !isPromise(dbPost)) return getPostOnlyAsync(args);
  else return dbPost.then(post =>
    post && !post.placeholder ? post :
      getPostOnlyAsync(args));
}

/**
 * @param {Args} _
 */
async function getPostOnlyAsync({ uri, dbStore, agent_getRepoRecord_throttled }) {
  if (!uri) return;
  const parsedURL = breakFeedURIPostOnly(uri);
  if (!parsedURL) throw new Error('Invalid post URI ' + JSON.stringify(uri));

  const postRecord = /**
     * @type {import('../../firehose').FirehoseRecord$Typed<'app.bsky.feed.post'>} */(
      (await agent_getRepoRecord_throttled(
        unwrapShortDID(parsedURL.shortDID),
        parsedURL.postID,
        'app.bsky.feed.post'))?.data?.value);

  postRecord.$type = 'app.bsky.feed.post';
  postRecord.repo = parsedURL.shortDID;
  postRecord.uri = uri;
  postRecord.action = 'create';

  const post = dbStore.captureRecord(postRecord, Date.now());
  if (post && 'uri' in post) return post;
}
