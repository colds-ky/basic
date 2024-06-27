// @ts-check

import { Octokit } from 'octokit';

/**
 * @returns {{
 *  readFile: Parameters<typeof import('../updateDIDs').updateDIDs>[0]['readFile']
 * }}
 */
export function createShellAPIs() {
  const octokit = new Octokit();
  return { readFile };

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
    const commitResponse = await octokit.rest.repos.getCommit({
      ref: 'main',
      owner: 'colds-ky',
      repo
    });
    const commit = Array.isArray(commitResponse.data) ?
      commitResponse.data[0] :
      commitResponse;


    const result = await octokit.rest.repos.getContent({
      owner: 'colds-ky',
      repo,
      path,
      ref: commit.data.sha
    });

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