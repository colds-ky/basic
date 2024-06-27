// @ts-check

/**
 * @param {string} shortDID
 * @returns {import('./store-data').RepositoryData}
 */
export function createRepoData(shortDID) {
  const repoData = {
    shortDID,
    profile: undefined,
    posts: new Map(),
    postLastAccesses: new Map(),
    lastAccesses: []
  };
  return repoData;
}
