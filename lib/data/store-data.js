// @ts-check

/**
 * @typedef {{
 *  shortDID: string,
 *  profile: import('.').CompactProfile | undefined,
 *  posts: Map<string, import('.').CompactPost>,
 *  postLastAccesses: Map<string, number[]>,
 *  lastAccesses: number[]
 * }} RepositoryData
 */

export function storeData() {
  /**
   * @type {Map<string, RepositoryData>}
   */
  const repos = new Map();

  return {
    repos
  };

}