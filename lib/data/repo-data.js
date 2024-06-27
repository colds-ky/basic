// @ts-check

/** @param {string} shortDID */
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
