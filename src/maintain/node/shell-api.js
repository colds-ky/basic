/**
 * @returns {{
 *  readFile: Parameters<typeof import('../updateDIDs').updateDIDs>[0]['readFile']
 * }}
 */
export function createShellAPIs() {
  const fs = require('fs');
  const path = require('path');
  const child_process = require('child_process');

  return { readFile };

  async function readFile(filePath) {
    if (filePath.lastIndexOf('/dids/', 0) !== 0)
      throw new Error('Only files within /dids can be read: ' + JSON.stringify(filePath));

    return readRepoFile('dids', filePath.slice('/dids/'.length));
  }

  function readRepoFile(repo, localPath) {
    const fullPath = path.resolve(
      __dirname,
      repo,
      localPath
    );
    const content = fs.readFileSync(fullPath);
    const commitHash = child_process.execSync(
      'git rev-parse HEAD',
      {
        cwd: path.dirname(fullPath)
      }).toString().trim();
    const commitDate = child_process.execSync(
      'git show -s --format=%ci HEAD',
      {
        cwd: path.dirname(fullPath)
      }).toString().trim();
    
    return {
      content,
      commit: commitHash,
      timestamp: new Date(commitDate).getTime()
    };
  }
}
