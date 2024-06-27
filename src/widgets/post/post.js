// @ts-check

import { FavoriteBorder } from '@mui/icons-material';
import React from 'react';

import { localise } from '../../localise';
import { AccountLabel } from '../account';
import { PreFormatted } from '../preformatted';

import './post.css';

/**
 * @typedef {import('../../../coldsky/lib').MatchCompactPost} MatchCompactPost
 */

/**
 * @param {{
 *  className?: string,
 *  post: string | MatchCompactPost
 * }} _
 */
export function Post({ className, post }) {
  return (
    <PostFrame className={className}>
      {
        typeof post === 'string' ?
          <LoadingPostInProgress post={post} /> :
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
function PostFrame({ className, children }) {
  return (
    <div className={className ? 'post-frame-outer ' + className : 'post-frame-outer'}>
      {children}
    </div>
  );
}

/**
 * @param {{
 *  post: string
 * }} _
 */
function LoadingPostInProgress({ post }) {
  return (
    <div className='post-loading-in-progress'>
      {
        localise('Post is loading...', { uk: 'Зачекайте...' })}
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
    <div className='post-loaded-content'>
      <AccountLabel className='post-author' account={post.shortDID} />
      <PreFormatted className='post-content' text={post.text} />
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