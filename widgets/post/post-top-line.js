// @ts-check

import React from 'react';

import { localise } from '../../app-shared/localise';
import { AccountLabel } from '../account';
import { PostTimestamp } from './post-timestamp';


/**
 * @param {{
 *  className?: string,
 *  post: import("../../../coldsky/lib").MatchCompactPost,
 *  since?: number,
 *  compact?: boolean,
 *  allowLinks?: boolean,
 *  indicateEmbedding?: boolean
 * }} _
 */
export function PostTopLine({
  className,
  post,
  since,
  compact,
  allowLinks,
  indicateEmbedding
}) {
  return (
    <div className={className ? 'post-top-line ' + className : 'post-top-line'}>
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
      linkToTimeline={allowLinks}
    />
    <span className='post-author-right-overlay'></span>
    <PostTimestamp post={post} since={since} linkTimestamp={allowLinks} />
  </div>
  );
}
