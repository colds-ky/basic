// @ts-check

import { shortenDID } from '../../shorten';

const encoder = new TextEncoder();

/**
 * @param {import('@atproto/api').AppBskyRichtextFacet.Main[] | undefined} facets
 * @param {string} text
 */
export function extractFacets(facets, text) {
  if (!facets) return undefined;
  const codePoints = [...text];
  const utf8Lengths = codePoints.map(c => encoder.encode(c).length);
  /**
   * @type {import('../..').CompactFacet[]}
   */
  const compactFacets = [];
  for (const facet of facets) {
    let start = text.length;
    let length = 0;

    if (facet.index) {
      let facetByteStart = facet.index.byteStart;
      let facetByteEnd = facet.index.byteEnd;
      if (facetByteEnd < facetByteStart) {
        facetByteStart = facet.index.byteEnd;
        facetByteEnd = facet.index.byteStart;
      }

      let bytePos = 0;
      let charPos = 0;
      for (let i = 0; i < codePoints.length; i++) {
        const nextBytePos = bytePos + utf8Lengths[i];
        const nextCharPos = charPos + codePoints[i].length;

        if (facetByteStart >= bytePos && facetByteStart < nextBytePos) {
          start = charPos;
          length = text.length - start;
        }

        if (facetByteEnd <= nextBytePos) {
          length = nextCharPos - start;
          break;
        }

        bytePos = nextBytePos;
        charPos = nextCharPos;
      }
    }

    if (!facet.features?.length) {
      compactFacets.push({ start, length });
      continue;
    }

    for (const feat of facet.features) {
      const facetMention = /** @type {import('@atproto/api/dist/client/types/app/bsky/richtext/facet').Mention} */(feat);
      if (facetMention.did) compactFacets.push({ start, length, mention: shortenDID(facetMention.did) });

      const facetLink = /** @type {import('@atproto/api/dist/client/types/app/bsky/richtext/facet').Link} */(feat);
      if (facetLink.uri) compactFacets.push({ start, length, url: facetLink.uri });

      const facetTag = /** @type {import('@atproto/api/dist/client/types/app/bsky/richtext/facet').Tag} */(feat);
      if (facetTag.tag) compactFacets.push({ start, length, tag: facetTag.tag });
    }

  }

  return compactFacets.length ? compactFacets : undefined;
}
