// @ts-check

/**
 * @param {string} shortDID
 * @param {string} cid
 */
export function createSpeculativePost(shortDID, cid) {
  /** @type {import('../..').CompactPost} */
  const speculativePost = {
    shortDID,
    cid,
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