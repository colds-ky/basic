// @ts-check

import { FavoriteBorder } from '@mui/icons-material';
import React from 'react';

import { localise } from '../../localise';
import { AccountLabel } from '../account';
import { PreFormatted } from '../preformatted';

import './post.css';
import { FormatTime } from '../format-time';
import { breakFeedUri, breakPostURL } from '../../../coldsky/lib';
import { useDB } from '../..';
import { forAwait } from '../../../coldsky/src/api/forAwait';
import { Link } from 'react-router-dom';
import { PostEmbedsSection } from './embedded';

/**
 * @typedef {import('../../../coldsky/lib').MatchCompactPost} MatchCompactPost
 */

/**
 * @param {{
 *  className?: string,
 *  post: string | MatchCompactPost,
 *  compact?: boolean,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean
 * }} _
 */
export function Post({ className, post, compact, linkTimestamp, linkAuthor, ...rest }) {
  return (
    <PostFrame className={className} {...rest}>
      {
        typeof post === 'string' ?
          <LoadingPostInProgress
            uri={post} /> :
          <LoadedPost
            post={post}
            compact={compact}
            linkTimestamp={linkTimestamp}
            linkAuthor={linkAuthor}
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
function PostFrame({ className, children, ...rest }) {
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
 *  uri: string
 * }} _
 */
function LoadingPostInProgress({ uri }) {
  const db = useDB();
  const post = forAwait(uri, () => db.getPostOnly(uri));
  if (post) {
    return (
      <LoadedPost post={post} />
    );
  }

  return (
    <div className='post-loading-in-progress'>
      {
        localise('Post is loading...', { uk: 'Зачекайте...' })
      }
    </div>
  );
}

/**
 * @param {{
 *  post: MatchCompactPost,
 *  compact?: boolean,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean
 * }} _
 */
function LoadedPost({ post, compact, linkTimestamp, linkAuthor }) {
  return (
    <div className='post-loaded-content' onClick={() => {
      console.log('post clicked ', post);
    }}>
      <div className='post-top-line'>
        <AccountLabel
          className='post-author'
          account={post.shortDID}
          withDisplayName={!compact}
          linkToTimeline={linkAuthor}
        />
        <PostTimestamp post={post} linkTimestamp={linkTimestamp} />
      </div>
      <PreFormatted className='post-content' text={post.text} />
      <PostEmbedsSection post={post} compact={compact} />
      <div className='post-likes'>
        <FavoriteBorder />
        {
          !post?.likeCount ? '' :
            post.likeCount.toLocaleString()
        }
      </div>
    </div>
  );
}

/**
 * @param {{
 *  post: MatchCompactPost,
 *  linkTimestamp?: boolean
 * }} _
 */
function PostTimestamp({ post, linkTimestamp }) {
  if (!post.asOf) return null;

  if (!linkTimestamp) return <FormatTime className='post-date' time={post.asOf} />;

  const db = useDB();
  const profile = forAwait(post.shortDID, () => db.getProfileIncrementally(post.shortDID));

  const parsedURI = breakFeedUri(post.uri);

  return (
    <Link
      className='post-date'
      to={
        '/' + (profile?.handle || parsedURI?.shortDID) +
        '/' + parsedURI?.postID}>
      <FormatTime time={post.asOf} />
    </Link>
  );
}
