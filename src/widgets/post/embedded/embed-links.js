// @ts-check

import React from 'react';

import { EmbedFrame } from './embed-frame';

/**
 * @param {{
 *  className?: string,
 *  post: import('../../../../coldsky/lib').CompactPost,
 *  links: import('../../../../coldsky/lib').CompactEmbed[]
 * }} _
 */
export function EmbedLinks({ className, post, links, ...rest }) {
  let alternateSideNext = false;
  return (
    <EmbedFrame className={className} {...rest}>
      <div className='post-embed-links'>
        {links.map((link, index) => {
          const linkElem = (
            <div key={index} className='post-embed-link'>
              {
                !link.title ? undefined :
                  <div className='post-embed-link-title'>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.title}
                    </a>
                  </div>
              }
              <div className='post-embed-link-url'>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.url}
                </a>
              </div>
              {
                !link.description && !link.imgSrc ? undefined :
                  !link.description ?
                    <span className='post-embed-link-image-wrapper post-embed-link-image-nodescr-wrapper'>
                      <span className='post-embed-link-gif-overlay'
                        style={{ backgroundImage: 'url(' + link.url + ')' }} />
                      <img className='post-embed-link-image' src={link.imgSrc} />
                    </span> :
                    !link.imgSrc ?
                      <span className='post-embed-link-description'>
                        {link.description}
                      </span> :
                      <div className={alternateSideNext ?
                        'post-embed-link-image-and-description post-embed-link-image-and-description-alternate' :
                        'post-embed-link-image-and-description'}>
                        <span className='post-embed-link-description-wrapper'>
                          <span className='post-embed-link-description'>
                            {link.description}
                          </span>
                        </span>
                        <span className='post-embed-link-image-wrapper'>
                          <span className='post-embed-link-gif-overlay'
                            style={{ backgroundImage: 'url(' + link.url + ')' }} />
                          <img className='post-embed-link-image' src={link.imgSrc} />
                        </span>
                      </div>
              }
            </div>
          );

          if (link.imgSrc && link.description) alternateSideNext = !alternateSideNext;
          else alternateSideNext = false;

          return linkElem;
        })}
      </div>
    </EmbedFrame>
  );
}
