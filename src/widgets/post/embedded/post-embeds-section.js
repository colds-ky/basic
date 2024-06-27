// @ts-check

import React from 'react';
import { breakFeedUri, breakPostURL } from '../../../../coldsky/lib';
import { EmbedQuotePostMultiple } from './embed-quote-post';
import { EmbedLinks } from './embed-links';
import { EmbedImages } from './embed-images';
import { PostFrame } from '../post';

/**
 * @param {{
 *  post: import('../../../../coldsky/lib').CompactPost,
 *  compact?: boolean,
 *  allowEmbedDepth?: number
 * }} _
 */
export function PostEmbedsSection({ compact, post, allowEmbedDepth }) {
  if (!post.embeds?.length) return null;

  const posts = [];
  const links = [];
  const images = [];
  const dummies = [];

  for (const embed of post.embeds) {
    const parsedURL = breakFeedUri(embed.url) || breakPostURL(embed.url);
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
        allowEmbedDepth === 0 ?
          <PostFrame>
            <span className='embed-too-many'>😵</span>
          </PostFrame> :
        !posts?.length ? null :
          <EmbedQuotePostMultiple
            compact={compact}
            parentPost={post}
            posts={/** @type {string[]} */(posts.map(entry => entry.embed?.url).filter(Boolean))}
            allowEmbedDepth={allowEmbedDepth}
          />
      }
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
    </div>
  );
}