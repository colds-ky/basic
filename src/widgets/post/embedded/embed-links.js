// @ts-check

import React from 'react';

import { EmbedFrame } from './embed-frame';
import { PreFormatted } from '../../preformatted';

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
                  <LinkURL url={link.url} />
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
                      <div className='post-embed-link-description'>
                        <PreFormatted text={link.description} />
                      </div> :
                      <div className={alternateSideNext ?
                        'post-embed-link-image-and-description post-embed-link-image-and-description-alternate' :
                        'post-embed-link-image-and-description'}>
                        <span className='post-embed-link-description-wrapper'>
                          <span className='post-embed-link-description'>
                            <PreFormatted text={link.description} />
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

/**
 * @param {{
 *  url: string
 * }} _
 */
function LinkURL({ url }) {
  const parsed = new URL(url);
  const hostnamePos = url.indexOf(parsed.hostname);
  if (!hostnamePos) return <span>{url}</span>;
  const lead = url.slice(0, hostnamePos);
  const trail = url.slice(hostnamePos + parsed.hostname.length);
  return (
    <>
      {!lead ? undefined : <span className='post-embed-link-url-lead'>{lead}</span>}
      <span className='post-embed-link-url-hostname'>{parsed.hostname}</span>
      {!trail ? undefined : <span className='post-embed-link-url-trail'>{trail}</span>}
    </>
  );
}
