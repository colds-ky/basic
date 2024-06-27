// @ts-check

/**
 * @typedef {{
 *  owner: string,
 *  repo: string,
 *  branch?: string,
 *  fetch?: typeof fetch,
 *  auth?: string,
 *  octokit?: import("@octokit/rest").Octokit
 * }} PrepareParams
 */

/**
 * @typedef {{
 *  head: CommitData,
 *  put(file: string, content: string | ArrayBuffer | Uint8Array, mode?: string | number): Promise<TreeItem>,
 *  remove(file: string): Promise<TreeItem>,
 *  commit(message: string): Promise<CommitData>
 * }} Committer
 */

/** @typedef {NonNullable<Parameters<import('@octokit/rest').Octokit['rest']['git']['createTree']>[0]>['tree'][0]} TreeItem */

/** @typedef {Awaited<ReturnType<import('@octokit/rest').Octokit['rest']['git']['getCommit']>>['data']} CommitData */

/**
 * @param {PrepareParams} params
 * @returns {Promise<Committer>}
 */
export async function webcommit({
  owner, repo, branch,
  fetch = defaultFetch(),
  auth,
  octokit }) {

  const headers = {
    ...(auth && { Authorization: `token ${auth}` }),
    Accept: "application/vnd.github.v3+json"
  };

  /** @type {Awaited<ReturnType<import('@octokit/rest').Octokit['rest']['git']['getRef']>>['data']} */
  const ref = await (octokit ?
    octokit.rest.git.getRef({ owner, repo, ref: `heads/${branch}` }).then(res => res.data) :
    fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, { headers }).then(x => x.json()));

  /** @type {CommitData} */
  const headCommit = await (octokit ?
    octokit.rest.git.getCommit({ owner, repo, commit_sha: ref.object.sha }).then(res => res.data) :
    fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${ref.object.sha}`, { headers }).then(x => x.json()));

  /**
   * @type {TreeItem[]}
   */
  const tree = [];

  return {
    head: headCommit,
    put, remove,
    commit
  };

  /**
   * @param {string} file
   * @param {string | ArrayBuffer | Uint8Array} content
   * @param {string | number} mode
   */
  async function put(file, content, mode) {
    const encodedBlob = toBase64(content);
    /** @type {Awaited<ReturnType<import('@octokit/rest').Octokit['rest']['git']['createBlob']>>['data']} */
    const blob = await (octokit ?
      octokit.rest.git.createBlob({ owner, repo, content: encodedBlob, encoding: 'base64' }).then(x => x.data) :
      fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: encodedBlob, encoding: 'base64' })
      }).then(x => x.json()));

    /** @type {typeof tree[0]} */
    const treeItem = {
      path: file,
      mode: /** @type {*} */(deriveMode(file, mode)),
      type: 'blob',
      sha: blob.sha
    };

    tree.push(treeItem);
    return treeItem;
  }

  /**
   * @param {string} file
   */
  async function remove(file) {

    /** @type {typeof tree[0]} */
    const treeItem = {
      path: file,
      mode: '100644',
      type: 'commit',
      sha: null
    };

    tree.push(treeItem);

    return treeItem;
  }

  /**
   * @param {string} message
   */
  async function commit(message) {
    /** @type {Awaited<ReturnType<import('@octokit/rest').Octokit['rest']['git']['createTree']>>['data']} */
    const treeObj = await (octokit ?
      octokit.rest.git.createTree({ owner, repo, tree, base_tree: headCommit.tree.sha }).then(x => x.data) :
      fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tree, base_tree: headCommit.tree.sha })
      }).then(x => x.json()));

    /** @type {Awaited<ReturnType<import('@octokit/rest').Octokit['rest']['git']['createCommit']>>['data']} */
    const commitObj = await (octokit ?
      octokit.rest.git.createCommit({ owner, repo, message, tree: treeObj.sha, parents: [headCommit.sha] }).then(x => x.data) :
      fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message, tree: treeObj.sha, parents: [headCommit.sha] })
      }).then(x => x.json()));

    /** @type {Awaited<ReturnType<import('@octokit/rest').Octokit['rest']['git']['updateRef']>>['data']} */
    const updatedRef = await (octokit ?
      octokit.rest.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commitObj.sha }) :
      fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ sha: commitObj.sha })
      }).then(x => x.json()));

    return commitObj;
  }

}

/**
 * @param {string} file
 * @param {string | number} mode
 */
function deriveMode(file, mode) {
  if (!mode) return '100644';
  else if (typeof mode === 'number') return mode.toString(8);
  else return mode; // TODO: handle 'r', 'w', 'x' and 'x+' modes
}

/**
 * @param {string | ArrayBuffer | Uint8Array} content
 */
export function toBase64(content) {
  if (typeof content === 'string') return btoa(content);

  const arr = content instanceof Uint8Array ? content : new Uint8Array(content);
  let result = '';
  for (let i = 0; i < arr.length; i++) {
    result += String.fromCharCode(arr[i]);
  }
  return btoa(result);
}

function defaultFetch() {
  // can put a polyfill here
  return fetch;
}