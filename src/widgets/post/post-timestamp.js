// @ts-check

import React from 'react';
import { Link, useNavigate, useMatch, useMatches } from 'react-router-dom';

import { FormatTime } from '../format-time';
import { useDB } from '../..';
import { forAwait } from '../../../coldsky/src/api/forAwait';
import { breakFeedURIPostOnly, breakPostURL, makeBskyPostURL, unwrapShortHandle } from '../../../coldsky/lib';

/**
 * @param {{
 *  className?: string,
 *  post: import('../../../coldsky/lib').MatchCompactPost,
 *  since?: number,
 *  linkTimestamp?: boolean
 * }} _
 */
export function PostTimestamp({ className, post, since, linkTimestamp }) {
 if (!post.asOf) return null;

 if (!linkTimestamp) return <FormatTime className='post-date' time={post.asOf} />;

  let combinedClassName = className ? 'post-date ' + className : 'post-date';
  if (post.asOf && since && post.asOf - since >= 0 && post.asOf - since < 1000 * 60 * 20)
    combinedClassName += ' post-date-new';

 return (
   <PostLink
     className={combinedClassName}
     postURI={post.uri}>
     <FormatTime since={since} time={post.asOf} />
   </PostLink>
 );
}

/**
 * @param {{
 *  className?: string,
 *  postURI: string | { postID: string, shortDID: string } | null | undefined,
 *  children?: React.ReactNode
 * }} _
 */
export function PostLink({ className, postURI, children, ...rest }) {
  const navigate = useNavigate();
  const parsedURI =
    typeof postURI === 'string' ?
      breakFeedURIPostOnly(postURI) || breakPostURL(postURI) :
      postURI;

  const db = useDB();
  const profile = forAwait(parsedURI?.shortDID, () => parsedURI && db.getProfileIncrementally(parsedURI?.shortDID));

  let localURL;
  let bskyURL;

  if (parsedURI) {
    // const matches = useMatches();
    // matches[0].
    localURL = '/' + (unwrapShortHandle(profile?.handle) || parsedURI.shortDID) + '/' + parsedURI.postID;
    bskyURL = makeBskyPostURL(parsedURI.shortDID, parsedURI.postID);
  } else {
    localURL = '';
    bskyURL = String(postURI);
  }

  const combinedClassName = className ?
    'post-link ' + className :
    'post-link';

  return (
    <a
      {...rest}
      className={combinedClassName}
      href={bskyURL}
      onClick={handleClick}>
      {children}
    </a>
  );

  /** @param {React.MouseEvent} event */
  function handleClick(event) {
    if (localURL) {
      event.preventDefault();
      navigate(localURL);
    }
  }

}
