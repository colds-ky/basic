// @ts-check

// @ts-check

import React, { useMemo } from 'react';

import { Link } from 'react-router-dom';
import { AccountChip } from '../account/account-chip';
import { PreFormatted } from '../preformatted';

import './post-text-content.css';

/**
 * @typedef {import('../../../coldsky/lib').MatchCompactPost} MatchCompactPost
 */

/**
 * @param {{
 *  post: MatchCompactPost
 * }} _ 
 */
export function PostTextContent({ post }) {
  const wordsNormalized = post.searchWords?.map(w => w.toLowerCase());
  const wholeStringNormalized = post.text?.toLowerCase() || '';
  const cacheCharClasses = useMemo(() => [], [post]);

  return (
    <PreFormatted
      className='post-content'
      text={post.text}
      InlineComponent={PostTextSpan}
      charClass={(offset, wholeString, ch) => {
        const fromCache = cacheCharClasses[offset];
        if (fromCache || fromCache === null) return fromCache;

        let match = undefined;
        let iMatch = 0;
        let matchHighlyRelevant = false;
        let matchRelevant = false;
        if (post.matches?.length) {
          for (const m of post.matches) {
            if (m.indices?.length) {
              for (let [start, end] of m.indices) {
                if ((wordsNormalized?.length || 0) > 1) {
                  start++; end++;
                }
                iMatch++;
                if (offset >= start && offset < end) {
                  match = m;
                  if (wordsNormalized?.length) {
                  const matchLength = end - start;
                    const str = wholeStringNormalized.slice(start, end);
                    for (const w of wordsNormalized) {
                      if (w.length === matchLength && str.toLowerCase() === w.toLowerCase()) {
                        matchHighlyRelevant = true;
                        break;
                      } else if (matchLength > 3) {
                        const subMatch = w.indexOf(str) >= 0 || str.indexOf(w) >= 0;
                        const lengthRatio = Math.min(w.length, matchLength) / Math.max(w.length, matchLength);
                        if (lengthRatio > 0.9 && subMatch) {
                          matchHighlyRelevant = true;
                          break;
                        } else if (lengthRatio > 0.5 && subMatch) {
                          matchRelevant = true;
                          break;
                        }
                      }
                    }
                  }
                  break;
                }
              }
            }
            if (match) break;
          }
        }
        const matchClassName =
          !match ? undefined :
            'search-match-n' + (iMatch + 1) +
            ' search-match ' +
            (matchHighlyRelevant ? 'search-match-highly-relevant ' :
              matchRelevant ? 'search-match-relevant ' :
                '');

        if (post.facets?.length) {
          for (let iFacet = 0; iFacet < post.facets.length; iFacet++) {
            const facet = post.facets[iFacet];
            if (offset >= facet.start && offset < facet.start + facet.length) {
              const facetClassName = 'facet-n' + (iFacet + 1) + ' facet-' + (
                facet.tag ? 'tag-' + facet.tag :
                  facet.mention ? 'mention' :
                    facet.url ? 'url' :
                      'other'
              );

              const fullClassName = !matchClassName ? facetClassName :
                matchClassName + facetClassName;

              return cacheCharClasses[offset] = {
                toString: () => fullClassName,
                match,
                facet,
                post
              };
            }
          }
        }

        if (match) {
          return cacheCharClasses[offset] = {
            toString: () => /** @type {string} */(matchClassName),
            match,
            facet: undefined,
            post
          };
        }

        return cacheCharClasses[offset] = null;
      }}
    />
  );
}

/**
 * @param {{
 *  children: import('react').ReactNode,
 *  className?: {
 *    match?: NonNullable<MatchCompactPost['matches']>[0],
 *    facet?: import('../../../coldsky/lib').CompactFacet,
 *    post: MatchCompactPost
 *  } | string | null | undefined,
 * }} _
 * */
function PostTextSpan({ children, className, ...rest }) {
  if (!className || typeof className === 'string')
    return (
      <span className={className || undefined} {...rest}>
        {children}
      </span>
    );

  const { post, match, facet } = className;
  const baseClassName = className.toString();

  if (facet?.mention) {
    return (
      <Link
        className={baseClassName}
        to={'/' + facet.mention}
        {...rest}>
        <AccountChip account={facet.mention} />
        {children}
      </Link>
    );
  } else if (facet?.url) {
    return (
      <a
        className={baseClassName}
        href={facet.url}
        target='_blank'
        rel='noopener noreferrer'
        {...rest}>
        {children}
      </a>
    );
  } else if (match) {
    return (
      <span className={baseClassName} {...rest}>
        {children}
      </span>
    );
  } else {
    return (
      <span className={baseClassName} {...rest}>
        {children}
      </span>
    );
  }
}
