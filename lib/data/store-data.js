// @ts-check

/**
 * @typedef {{
 *  shortDID: string,
 *  profile: import('.').CompactProfile | undefined,
 *  posts: Map<string, import('.').CompactPost>,
 * }} RepositoryData
 */

// TODO: may need lastAccesses in RepositoryData?
//  *  postLastAccesses: Map<string, number[]>,
//  * lastAccesses: number[]


export function storeData() {
  /**
   * @type {Map<string, RepositoryData>}
   */
  const repos = new Map();

  return {
    repos
  };

}