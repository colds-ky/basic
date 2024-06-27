// @ts-check

import { FavoriteBorder } from '@mui/icons-material';
import React from 'react';

import { localise } from '../../localise';
import { AccountLabel } from '../account';
import { PreFormatted } from '../preformatted';

import './post.css';
import { FormatTime } from '../format-time';
import { breakFeedUri } from '../../../coldsky/lib';
import { useDB } from '../..';
import { forAwait } from '../../../coldsky/src/api/forAwait';
import { Link } from 'react-router-dom';

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
      {
        !post.embeds?.length ? undefined :
          <div className='post-embeds'>
            {
              post.embeds.map((embed, idx) => (
                <PostEmbed key={idx} embed={embed} />
              ))
            }
          </div>
      }
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
 *  className?: string,
 *  embed: import('../../../coldsky/lib').CompactEmbed
 * }} _
 */
function PostEmbed({ className, embed, ...rest }) {
  const parsedPostURL = breakFeedUri(embed.url);

  return (
    <div className={'post-embed ' + (className || '')} {...rest}>
      {
        parsedPostURL ?
          <PostEmbeddedIntoAnother
            uri={embed.url} /> :
          <div className='post-embed-container'>
            {
              !embed.imgSrc ? undefined :
                <img
                  className='post-embed-image'
                  src={embed.imgSrc} alt={embed.title || embed.description} />
            }
            {
              !embed.title ? undefined :
                <div className='post-embed-title'>
                  {embed.title}
                </div>
            }
            {
              !embed.description ? undefined :
                <div className='post-embed-description'>
                  {embed.description}
                </div>
            }
            <div className='post-embed-border'>
            </div>
          </div>
      }
    </div>
  );
}

function PostEmbeddedIntoAnother({ uri }) {
  const parsedURI = breakFeedUri(uri);
  const db = useDB();
  const resolveToHandle = forAwait(uri, async function*() {
    for await (const profile of db.getProfileIncrementally(parsedURI?.shortDID)) {
      if (profile.handle) {
        yield profile.handle;
        break;
      }
    }
  });

  const postURL =
    '/' + (resolveToHandle || parsedURI?.shortDID) + '/' + parsedURI?.postID;

  return (
    <Link
      className='post-embed-url'
      to={postURL}>
      <Post post={uri} />
    </Link>
  );
}
