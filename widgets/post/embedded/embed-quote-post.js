// @ts-check

import React from 'react';

import { Post } from '../post';

/**
 * @param {{
 *  className?: string,
 *  parentPost: import('../../../package').CompactPost,
 *  post: import('../../../package').CompactPost | string,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean,
 *  compact?: boolean,
 *  allowEmbedDepth?: number
 * }} _
 */
export function EmbedQuotePost({ className, parentPost, post, ...rest }) {
  return (
    <Post
      className={className}
      post={post}
      indicateEmbedding
      indicateLeadsFromThread
      indicateTrailsFromThread
      {...rest}
    />
  );
}

/**
 * @param {{
 *  className?: string,
 *  parentPost: import('../../../package').CompactPost,
 *  posts: (import('../../../package').CompactPost | string)[],
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean,
 *  compact?: boolean,
 *  allowEmbedDepth?: number
 * }} _
 */
export function EmbedQuotePostMultiple({ className, parentPost, posts, compact, allowEmbedDepth, ...rest }) {
  if (posts.length === 0) return null;

  if (posts.length === 1) return (
    <EmbedQuotePost
      className={className}
      parentPost={parentPost}
      post={posts[0]}
      compact={compact}
      allowEmbedDepth={allowEmbedDepth}
      {...rest}
    />
  );

  return (
    <div className={'embed-quote-post embed-quote-post-' + posts.length + ' ' + (className || '')} {...rest}>
      {posts.map((post, index) => (
        <Post
          key={typeof post === 'string' ? post : post.uri}
          post={post}
          compact={compact}
          allowEmbedDepth={allowEmbedDepth}
          indicateEmbedding
          indicateLeadsFromThread
          indicateTrailsFromThread
        />
      ))}
    </div>
  );
}
