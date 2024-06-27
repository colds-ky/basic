// @ts-check

import React from 'react';
import { PreFormatted } from '../preformatted';
import { localise } from '../../localise';
import { AccountLabel } from '../account';
import { FavoriteBorder } from '@mui/icons-material';

/**
 * @typedef {import('../../../coldsky/lib').MatchCompactPost} MatchCompactPost
 */

/**
 * @param {{
 *  post: string | MatchCompactPost
 * }} _
 */
export function Post({ post }) {
  return (
    <PostFrame>
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
 *  children?: import('react').ReactNode
 * }} _
 */
function PostFrame({ children }) {
  return (
    <div className='post-frame-outer'>
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