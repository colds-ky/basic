// @ts-check

import { Octokit } from 'octokit';
import { throttledAsyncCache } from '../../api/throttled-async-cache';

/**
 * @returns {Parameters<typeof import('../updateDIDs').updateDIDs>[0]}
 */
export function createShellAPIs() {
  /** @type {Octokit} */
  let authOctokit = /** @type {*} */(undefined);

  const fetchContentCache = throttledAsyncCache(
    (repo, path) =>
      fetch(
        (repo === 'dids' ? '../' : '../index/') + repo + '/' + path)
        .then(x => x.text()));

  return {
    readFile,
    provideAuthToken,
    commitChanges
  };

  async function provideAuthToken(authToken) {
    authOctokit = new Octokit({
      auth: authToken
    });
    await authOctokit.rest.users.getAuthenticated();

    const commitResponse = await authOctokit.rest.repos.getCommit({
      ref: 'main',
      owner: 'colds-ky',
      repo: 'dids'
    });
    const commit = Array.isArray(commitResponse.data) ?
      commitResponse.data[0] :
      commitResponse;

    const timestamp = commit.data.commit.author?.date ?
      new Date(commit.data.commit.author?.date).getTime() :
      0;

    return {
      commit: commit.data.sha,
      timestamp
    };
  }

  async function commitChanges(files) {
    // const commitResponse = await authOctokit.rest.repos.getCommit({
    //   ref: baseCommitHash,
    //   owner: 'colds-ky',
    //   repo: 'dids'
    // });

    throw new Error('TODO: perform commit');
  }

  async function readFile(filePath) {
    if (filePath.lastIndexOf('/dids/', 0) !== 0)
      throw new Error('Only files within /dids can be read: ' + JSON.stringify(filePath));

    return readRepoFile('dids', filePath.slice('/dids/'.length));
  }

  /**
   * @param {string} repo
   * @param {string} path
   */
  async function readRepoFile(repo, path) {
    const content = await fetchContentCache(repo, path);
    return content;
  }
}