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
 *  post: string | MatchCompactPost
 * }} _
 */
export function Post({ className, post, ...rest }) {
  return (
    <PostFrame className={className} {...rest}>
      {
        typeof post === 'string' ?
          <LoadingPostInProgress uri={post} /> :
          <LoadedPost post={post} />
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
 *  post: MatchCompactPost
 * }} _
 */
function LoadedPost({ post }) {
  return (
    <div className='post-loaded-content' onClick={() => {
      console.log('post clicked ', post);
    }}>
      <div className='post-top-line'>
        <AccountLabel className='post-author' account={post.shortDID} />
        {post.asOf ?
          <FormatTime className='post-date' time={post.asOf} />
          : undefined
        }
      </div>
      <PreFormatted className='post-content' text={post.text} />
      <PostEmbedsSection post={post} />
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
