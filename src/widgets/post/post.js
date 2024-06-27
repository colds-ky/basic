// @ts-check

import { FavoriteBorder } from '@mui/icons-material';
import React from 'react';
import { Link } from 'react-router-dom';

import { useDB } from '../..';
import { breakFeedUri, breakPostURL } from '../../../coldsky/lib';
import { forAwait } from '../../../coldsky/src/api/forAwait';
import { localise } from '../../localise';
import { AccountLabel } from '../account';
import { AccountChip } from '../account/account-chip';
import { FormatTime } from '../format-time';
import { PreFormatted } from '../preformatted';
import { PostEmbedsSection } from './embedded';
import { PostTextContent } from './post-text-content';

import './post.css';

/**
 * @typedef {import('../../../coldsky/lib').MatchCompactPost} MatchCompactPost
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
 *  indicateLeadsFromThread?: boolean | import('../../../coldsky/lib').CompactThreadPostSet,
 *  indicateTrailsFromThread?: boolean | import('../../../coldsky/lib').CompactThreadPostSet,
 * }} _
 */
export function Post({
  className,
  post,
  compact,
  linkTimestamp,
  linkAuthor,
  allowEmbedDepth,
  indicateEmbedding, ...rest }) {
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
  const parsedURL = breakFeedUri(uri) || breakPostURL(uri);

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
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean,
 *  suppressAuthor?: boolean,
 *  allowEmbedDepth?: number
 *  indicateEmbedding?: boolean
 * }} _
 */
export function CompletePostContent({
  className,
  post,
  compact,
  linkTimestamp,
  linkAuthor,
  suppressAuthor,
  allowEmbedDepth,
  indicateEmbedding
}) {
  return (
    <div className={className ? 'post-loaded-content ' + className : 'post-loaded-content'} onClick={() => {
      console.log('post clicked ', post);
    }}>
      {
        suppressAuthor ?
          <PostTimestamp className='post-timestamp-small-note' post={post} linkTimestamp={linkTimestamp} /> :
          <div className='post-top-line'>
            {
              !indicateEmbedding ? undefined :
                <span className='tiny-text-for-copy-paste'>
                  {localise(
                    'quoted post by: ',
                    { uk: 'процитовано від:' }
                  )}
                </span>
            }
            <AccountLabel
              className='post-author'
              account={post.shortDID}
              withDisplayName={!compact}
              linkToTimeline={linkAuthor}
            />
            <span className='post-author-right-overlay'></span>
            <PostTimestamp post={post} linkTimestamp={linkTimestamp} />
          </div>
      }
      <PostTextContent post={post} />
      <PostEmbedsSection
        post={post}
        compact={compact}
        allowEmbedDepth={allowEmbedDepth}
        matches={post.matches}
      />
      <div className='post-likes'>
        <FavoriteBorder className='heart-icon' />
        <span className='tiny-text-for-copy-paste'>
          {
            !post.likeCount ? undefined :
            localise(
              'likes: ',
              { uk: 'вподобайки: ' }
            )
          }
        </span>
        {
          !post?.likeCount ? undefined :
            <span className='post-like-count'>
              {post.likeCount.toLocaleString()}
            </span>
        }
      </div>
    </div>
  );
}

/**
 * @param {{
 *  className?: string,
 *  post: MatchCompactPost,
 *  linkTimestamp?: boolean
 * }} _
 */
function PostTimestamp({ className, post, linkTimestamp }) {
  if (!post.asOf) return null;

  if (!linkTimestamp) return <FormatTime className='post-date' time={post.asOf} />;

  const db = useDB();
  const profile = forAwait(post.shortDID, () => db.getProfileIncrementally(post.shortDID));

  const parsedURI = breakFeedUri(post.uri);

  return (
    <Link
      className={className ? 'post-date ' + className : 'post-date'}
      to={
        '/' + (profile?.handle || parsedURI?.shortDID) +
        '/' + parsedURI?.postID}>
      <FormatTime time={post.asOf} />
    </Link>
  );
}
