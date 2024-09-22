// @ts-check

import { FavoriteBorder } from '@mui/icons-material';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useDB } from '../../app';
import { forAwait } from '../../app-shared/forAwait';
import { localise } from '../../app-shared/localise';
import { breakFeedURIPostOnly, breakPostURL } from '../../package';
import { AccountChip } from '../account/account-chip';
import { PostEmbedsSection } from './embedded';
import { PostTextContent } from './post-text-content';
import { PostTimestamp } from './post-timestamp';
import { PostTopLine } from './post-top-line';
import { ThreadNestedChildren } from './thread-nested-children';

import './post.css';

/**
 * @typedef {import('../../package').MatchCompactPost} MatchCompactPost
 */

const DEFAULT_EMBED_DEPTH = 25;

/**
 * @param {{
 *  className?: string,
 *  post: string | MatchCompactPost,
 *  compact?: boolean,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean,
 *  allowEmbedDepth?: number,
 *  indicateEmbedding?: boolean,
 *  indicateLeadsFromThread?: boolean | import('../../package').CompactThreadPostSet,
 *  indicateTrailsFromThread?: boolean | import('../../package').CompactThreadPostSet,
 * }} _
 */
export function Post({
  className,
  post,
  compact,
  linkTimestamp,
  linkAuthor,
  allowEmbedDepth,
  indicateEmbedding,
  indicateLeadsFromThread,
  indicateTrailsFromThread,
  ...rest }) {
  const nextAllowEmbedDepth = typeof allowEmbedDepth === 'number' ? allowEmbedDepth - 1 : DEFAULT_EMBED_DEPTH;
  return (
    <PostFrame className={className} {...rest}>
      {
        typeof post === 'string' ?
          <LoadingPostInProgress
            uri={post}
            compact={compact}
            linkTimestamp={linkTimestamp}
            linkAuthor={linkAuthor}
            allowEmbedDepth={nextAllowEmbedDepth}
            indicateEmbedding={indicateEmbedding}
          /> :
          <CompletePostContent
            post={post}
            compact={compact}
            linkTimestamp={linkTimestamp}
            linkAuthor={linkAuthor}
            allowEmbedDepth={nextAllowEmbedDepth}
            indicateEmbedding={indicateEmbedding}
          />
        // indicateLeadsFromThread={indicateLeadsFromThread}
        // indicateTrailsFromThread={indicateTrailsFromThread}

      }
    </PostFrame>
  );
}

/**
 * @param {{
 *  className?: string,
 *  children?: import('react').ReactNode
 * }} _
 */
export function PostFrame({ className, children, ...rest }) {
  return (
    <div
      className={className ? 'post-frame-outer ' + className : 'post-frame-outer'}
      {...rest}>
      {children}
    </div>
  );
}

/**
 * @param {{
 *  uri: string,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean,
 *  compact?: boolean,
 *  allowEmbedDepth?: number,
 *  indicateEmbedding?: boolean
 * }} _
 */
function LoadingPostInProgress({ uri, ...rest }) {
  const db = useDB();
  const post = forAwait(uri, () => db.getPostOnly(uri));
  if (post) {
    return (
      <CompletePostContent
        post={post}
        {...rest}
      />
    );
  }
  const parsedURL = breakFeedURIPostOnly(uri) || breakPostURL(uri);

  return (
    <Link
      className='post-loading-in-progress'
      to={
        !parsedURL ? '/' + uri :
          '/' + parsedURL.shortDID + '/' + parsedURL.postID
      }>
      {
        localise('Post is loading...', { uk: 'Зачекайте...' })
      }
      <div className='post-loading-in-progress-url'>
        {uri}
      </div>
    </Link>
  );
}

/**
 * @param {{
 *  className?: string,
 *  post: MatchCompactPost,
 *  compact?: boolean,
 *  incrementTimestampSince?: number,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean,
 *  suppressAuthor?: boolean,
 *  allowEmbedDepth?: number
 *  indicateEmbedding?: boolean,
 *  replies?: import('./thread-structure').ThreadBranch[]
 * }} _
 */
export function CompletePostContent({
  className,
  post,
  compact,
  incrementTimestampSince,
  linkTimestamp,
  linkAuthor,
  suppressAuthor,
  allowEmbedDepth,
  indicateEmbedding,
  replies
}) {
  const [expanded, setExpanded] = React.useState(false);

  const replyAvatars = useMemo(() => collectReplyAvatars(replies), [replies]);
  const notesHeight = (replyAvatars?.length || 0) + (post.likedBy?.length ? 1 : 0);

  let wholeClassName = className ? 'complete-post-content ' + className : 'complete-post-content';
  if (notesHeight && !expanded) wholeClassName += ' notes-height-' + notesHeight;

  return (
    <div
      className={wholeClassName}
      onClick={() => {
      console.log('post clicked ', post);
    }}>
      {
        suppressAuthor ?
          <PostTimestamp
            className='post-timestamp-small-note'
            post={post}
            since={incrementTimestampSince}
            linkTimestamp={linkTimestamp} /> :
          <PostTopLine
            post={post}
            since={incrementTimestampSince}
            compact={compact}
            allowLinks={linkAuthor || linkTimestamp}
            indicateEmbedding={indicateEmbedding} />
      }
      <PostTextContent post={post} />
      <PostEmbedsSection
        post={post}
        compact={compact}
        linkTimestamp={linkTimestamp}
        linkAuthor={linkAuthor}
        allowEmbedDepth={allowEmbedDepth}
        matches={post.matches}
      />

      <div className='post-notes-area'>
        {
          expanded || !replies?.length ? null :
            <div className='post-replies'
              onClick={() => setExpanded(true)}>
              <ReplyAvatars shortDIDs={replyAvatars} />
            </div>
        }
        <div className='post-likes'>
          <span className='tiny-text-for-copy-paste'>
            {
              !post.likedBy?.length ? undefined :
                localise(
                  'likes: ',
                  { uk: 'вподобайки: ' }
                )
            }
          </span>
          {
            !post?.likedBy?.length || post.likedBy?.length === 1 ? undefined :
                (
                  post.embeds?.length ?
                    <div className='post-like-count'>
                      {post.likedBy?.length.toLocaleString()}
                    </div> :
                    <span className='post-like-count'>
                      {post.likedBy?.length.toLocaleString()}
                    </span>
                )
          }
          <FavoriteBorder className={post.likedBy?.length ? 'heart-icon heart-icon-with-likes' : 'heart-icon heart-icon-no-likes'} />
        </div>
      </div>
      {
        !expanded || !replies?.length ? null :
          <ThreadNestedChildren
            className='thread-post-expandos'
            branches={replies}
            linkTimestamp={linkTimestamp}
            linkAuthor={linkAuthor}
          />
          
      }
    </div>
  );
}

/**
 * @param {{
 *  shortDIDs?: string[],
 * }} _
 */
function ReplyAvatars({ shortDIDs }) {
  if (!shortDIDs?.length) return null;
  return (
    <div className='reply-avatars'>
      {shortDIDs.map((shortDID, index) => (
        index === MAX_AVATAR_DISPLAY ?
          <div key='reply-avatar-more' className='reply-avatar-marker reply-avatar-marker-more'>
            {shortDIDs.length.toLocaleString()}
          </div> :
          <AccountChip
            key={'reply-avatar-' + shortDID}
            className='reply-avatar-marker'
            account={shortDID} />
      ))}
    </div>
  );
}

const MAX_AVATAR_DISPLAY = 3;

/**
 * @param {(import('../../package').CompactPost | { post: import('../../package').CompactPost })[] | undefined} posts
 * @param {string[]} [shortDIDs]
 */
function collectReplyAvatars(posts, shortDIDs) {

  if (!posts) return shortDIDs;
  if (!shortDIDs) shortDIDs = [];
  for (const p of posts) {
    /** @type {import('../../package').CompactPost} */
    const post = /** @type {*} */(p).post || p;
    if (shortDIDs.indexOf(post.shortDID) < 0)
      shortDIDs.push(post.shortDID);
    if (shortDIDs.length > MAX_AVATAR_DISPLAY)
      break;
  }
  return shortDIDs;
}
