// @ts-check

import React from 'react';
import { Link } from 'react-router-dom';

import { FormatTime } from '../format-time';
import { useDB } from '../..';
import { forAwait } from '../../../coldsky/src/api/forAwait';
import { breakFeedUri } from '../../../coldsky/lib';

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

 const db = useDB();
 const profile = forAwait(post.shortDID, () => db.getProfileIncrementally(post.shortDID));

 const parsedURI = breakFeedUri(post.uri);

 return (
   <Link
     className={className ? 'post-date ' + className : 'post-date'}
     to={
       '/' + (profile?.handle || parsedURI?.shortDID) +
       '/' + parsedURI?.postID}>
     <FormatTime since={since} time={post.asOf} />
   </Link>
 );
}
