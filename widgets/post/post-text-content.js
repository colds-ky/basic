// @ts-check

// @ts-check

import React, { useMemo } from "react";

import { Link } from "react-router-dom";
import { AccountChip } from "../account/account-chip";
import { PreFormatted } from "../preformatted";

import "./post-text-content.css";

/**
 * @typedef {import('../../package').MatchCompactPost} MatchCompactPost
 */

/**
 * @param {{
 *  post: MatchCompactPost
 * }} _
 */
export function PostTextContent({ post }) {
  const wordsNormalized = post.searchWords?.map((w) => w.toLowerCase());
  const wholeStringNormalized = post.text?.toLowerCase() || "";
  const cacheCharClasses = useMemo(() => [], [post]);

  return (
    <PreFormatted
      className="post-text-content"
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
                  start++;
                  end++;
                } else {
                  end++;
                }
                iMatch++;
                if (offset >= start && offset < end) {
                  match = m;
                  if (wordsNormalized?.length) {
                    const matchLength = end - start;
                    const str = wholeStringNormalized.slice(start, end);
                    for (const w of wordsNormalized) {
                      if (
                        w.length === matchLength &&
                        str.toLowerCase() === w.toLowerCase()
                      ) {
                        matchHighlyRelevant = true;
                        break;
                      } else if (matchLength > 3) {
                        const subMatch =
                          w.indexOf(str) >= 0 || str.indexOf(w) >= 0;
                        if (subMatch) {
                          matchHighlyRelevant = true;
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
        const matchClassName = !match
          ? undefined
          : "search-match-n" +
            (iMatch + 1) +
            " search-match " +
            (matchHighlyRelevant
              ? "search-match-highly-relevant "
              : matchRelevant
                ? "search-match-relevant "
                : "");

        if (post.facets?.length) {
          for (let iFacet = 0; iFacet < post.facets.length; iFacet++) {
            const facet = post.facets[iFacet];
            if (offset >= facet.start && offset < facet.start + facet.length) {
              const facetClassName =
                "facet-n" +
                (iFacet + 1) +
                " facet-" +
                (facet.tag
                  ? "tag-" + facet.tag
                  : facet.mention
                    ? "mention"
                    : facet.url
                      ? "url"
                      : "other");

              const fullClassName = !matchClassName
                ? facetClassName
                : matchClassName + facetClassName;

              return (cacheCharClasses[offset] = {
                toString: () => fullClassName,
                match,
                facet,
                post,
              });
            }
          }
        }

        if (match) {
          return (cacheCharClasses[offset] = {
            toString: () => /** @type {string} */ (matchClassName),
            match,
            facet: undefined,
            post,
          });
        }

        return (cacheCharClasses[offset] = null);
      }}
    />
  );
}

/**
 * @param {{
 *  children: import('react').ReactNode,
 *  className?: {
 *    match?: NonNullable<MatchCompactPost['matches']>[0],
 *    facet?: import('../../package').CompactFacet,
 *    post: MatchCompactPost
 *  } | string | null | undefined,
 * }} _
 * */
function PostTextSpan({ children, className, ...rest }) {
  if (!className || typeof className === "string")
    return (
      <span className={className || undefined} {...rest}>
        {children}
      </span>
    );

  const { post, match, facet } = className;
  const baseClassName = className.toString();

  if (facet?.mention) {
    return (
      <MentionFacet
        className={baseClassName}
        mention={facet.mention}
        children={children}
        {...rest}
      />
    );
  } else if (facet?.url) {
    return (
      <LinkFacet
        className={baseClassName}
        link={facet}
        {...rest}
      >
        {children}
      </LinkFacet>
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

/**
 * @param {{
 *  className?: string,
 *  mention: string,
 *  children?: React.ReactNode
 * }} _
 */
function MentionFacet({ className, mention, children, ...rest }) {
  const skipLeadingAt =
    typeof children === "string" && children.startsWith("@")
      ? children.slice(1)
      : children;
  return (
    <Link className={className} to={"/" + mention} {...rest}>
      <AccountChip account={mention} />
      {skipLeadingAt}
    </Link>
  );
}

/**
 * @param {{
 *  className?: string,
 *  link: import("../../../coldsky/lib").CompactFacet,
 *  children?: React.ReactNode
 * }} _
 */
function LinkFacet({ className, link, children, ...rest }) {
  const url = !link.url ? undefined : new URL(link.url);
  const posHostName = !url?.hostname || typeof children !== "string" ? -1 :
    children.toLowerCase().indexOf(url.hostname.toLowerCase());

  let linkContent;
  if (posHostName < 0)  {
    const childrenAppearAsURL =
      typeof children === "string" &&
      /^https?:/i.test(children);

    linkContent = (
      <span className={childrenAppearAsURL ? 'unspecified-domain suspicious-link' : 'unspecified-domain'}>
        {children}
      </span>
    );
  } else {
    const lead = String(children).slice(0, posHostName);
    const trail = String(children).slice(posHostName + (url?.hostname.length || 0));

    linkContent = (
      <>
        {!lead ? undefined : <span className='link-text-before-domain'>{lead}</span>}
        <span className='link-text-domain'>{url?.hostname}</span>
        {!trail ? undefined : <span className='link-text-after-domain'>{trail}</span>}
      </>
    );
  }

  return (
    <a
      className={className}
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {linkContent}
    </a>
  );
}
