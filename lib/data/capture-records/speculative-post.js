// @ts-check

/**
 * @param {string} shortDID
 * @param {string} rev
 */
export function createSpeculativePost(shortDID, rev) {
  /** @type {import('../..').CompactPost} */
  const speculativePost = {
    shortDID,
    rev,
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