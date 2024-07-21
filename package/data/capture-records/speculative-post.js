// @ts-check

/**
 * @param {string} shortDID
 * @param {string} uri
 */
export function createSpeculativePost(shortDID, uri) {
  /** @type {import('../..').CompactPost} */
  const speculativePost = {
    uri,
    shortDID,
    text: undefined,
    facets: undefined,
    embeds: undefined,
    threadStart: undefined,
    replyTo: undefined,
    words: undefined,
    repostCount: undefined,
    quoting: undefined,
    likeCount: undefined,
    placeholder: true,
    asOf: undefined
  };

  return speculativePost;
}