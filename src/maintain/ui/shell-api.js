// @ts-check

import { Octokit } from 'octokit';
import { throttledAsyncCache } from '../../api/throttled-async-cache';

/**
 * @returns {Parameters<typeof import('../updateDIDs').updateDIDs>[0]}
 */
export function createShellAPIs() {
  const octokit = new Octokit();
  /** @type {typeof octokit} */
  let authOctokit = /** @type {*} */(undefined);
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
  }

  async function commitChanges(baseCommitHash, files) {
    const commitResponse = await octokit.rest.repos.getCommit({
      ref: baseCommitHash,
      owner: 'colds-ky',
      repo: 'dids'
    });

    throw new Error('TODO: perform commit');
  }

  async function readFile(filePath) {
    if (filePath.lastIndexOf('/dids/', 0) !== 0)
      throw new Error('Only files within /dids can be read: ' + JSON.stringify(filePath));

    return readRepoFile('dids', filePath.slice('/dids/'.length));
  }

  /**
   * @type {{
   *  commit:Awaited<ReturnType<typeof octokit.rest.repos.getCommit>>;
   *  timestamp: number
   * }} */
  var lastCommit;

  const getContentCache = throttledAsyncCache(
    (owner, repo, path, ref) =>
      octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref
      }),
  );

  /**
   * @param {string} repo
   * @param {string} path
   */
  async function readRepoFile(repo, path) {
    let commit = lastCommit?.commit;
    if (!commit || Math.abs(lastCommit.timestamp - Date.now()) > 30000) {
      const commitResponse = await octokit.rest.repos.getCommit({
        ref: 'main',
        owner: 'colds-ky',
        repo
      });
      commit = Array.isArray(commitResponse.data) ?
        commitResponse.data[0] :
        commitResponse;
      lastCommit = {
        commit,
        timestamp: Date.now()
      };
    }

    const result = await getContentCache(
      'colds-ky',
      repo,
      path,
      commit.data.sha);

    if (Array.isArray(result.data)) throw new Error('Expected file, got directory: ' + JSON.stringify(path));
    if (result.data.type !== 'file') throw new Error('Expected file, got ' + JSON.stringify(result.data.type) + ': ' + JSON.stringify(path));
    let content = result.data.content;
    if (result.data.encoding === 'base64')
      content = atob(content);

    const timestamp = commit.data.commit.author?.date ?
      new Date(commit.data.commit.author?.date).getTime() :
      0;

    return {
      content,
      commit: commit.data.sha,
      timestamp
    };
  }
}