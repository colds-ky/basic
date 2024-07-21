// @ts-check

import React from 'react';

import { breakFeedURIPostOnly, breakPostURL } from '../../../../lib';
import { localise } from '../../../localise';
import { PostFrame } from '../post';
import { EmbedImages } from './embed-images';
import { EmbedLinks } from './embed-links';
import { EmbedQuotePostMultiple } from './embed-quote-post';

/**
 * @param {{
 *  post: import('../../../../lib').CompactPost,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean,
 *  compact?: boolean,
 *  matches?: import('../post').MatchCompactPost['matches'],
 *  allowEmbedDepth?: number
 * }} _
 */
export function PostEmbedsSection({ compact, post, linkTimestamp, linkAuthor, allowEmbedDepth }) {
  if (!post.embeds?.length) return null;

  const posts = [];
  const links = [];
  const images = [];
  const dummies = [];

  for (const embed of post.embeds) {
    const parsedURL = breakFeedURIPostOnly(embed.url) || breakPostURL(embed.url);
    if (parsedURL) {
      posts.push({ parsedURL, embed });
    } else if (embed.url) {
      links.push(embed);
    } else if (embed.imgSrc) {
      images.push(embed);
    } else {
      dummies.push(embed);
    }
  }

  return (
    <div className={
      compact ? 'post-embeds-section post-embeds-section-compact' :
        'post-embeds-section'}>
      {
        !links?.length ? null :
          <EmbedLinks post={post} links={links} />
      }
      {
        !images?.length ? null :
          <EmbedImages post={post} images={images} />
      }
      {
        !dummies?.length ? null :
          <EmbedLinks post={post} links={dummies} />
      }
      {
        allowEmbedDepth === 0 ?
          <PostFrame>
            <span className='embed-too-many'>
              <span className='tiny-text-for-copy-paste'>
                {localise(
                  '(more embedded posts omitted)',
                  { uk: '(немає місця для решти повідомлень)' })}
              </span>
              😵
            </span>
          </PostFrame> :
          !posts?.length ? null :
            <EmbedQuotePostMultiple
              compact={compact}
              parentPost={post}
              posts={/** @type {string[]} */(posts.map(entry => entry.embed?.url).filter(Boolean))}
              linkTimestamp={linkTimestamp}
              linkAuthor={linkAuthor}
              allowEmbedDepth={allowEmbedDepth}
            />
      }
    </div>
  );
}
