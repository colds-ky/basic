// @ts-check

import React from 'react';

import { EmbedFrame } from './embed-frame';
import { PreFormatted } from '../../preformatted';

/**
 * @param {{
 *  className?: string,
 *  post: import('../../../../coldsky/lib').CompactPost,
 *  images: import('../../../../coldsky/lib').CompactEmbed[]
 * }} _
 */
export function EmbedImages({ className, post, images, ...rest }) {
  return (
    <EmbedFrame className={className} {...rest}>
      <div className={'post-embed-images post-embed-images-' + images.length + 
        (images.length > 1 ? ' post-embed-images-multiple' : '')
      }>
        {images.map((image, index) => {
          const imageElem = (
            !image.description ?
              <span key={'image-' + index} className='post-embed-image-wrapper post-embed-image-nodescr-wrapper'>
                <img className='post-embed-image' src={image.imgSrc} />
              </span> :
              <div key={'image-' + index} className='post-embed-image-and-description'>
                <span className='post-embed-image-description-wrapper'>
                  <span className='post-embed-image-description'>
                    <PreFormatted text={image.description} />
                    </span>
                </span>
                <span className='post-embed-image-wrapper'>
                  <img className='post-embed-image' src={image.imgSrc} />
                </span>
              </div>
          );

          return imageElem;
        })}
      </div>
    </EmbedFrame>
  );
}