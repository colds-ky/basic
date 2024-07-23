// @ts-check

const fs = require('fs');
const path = require('path');
const globalStartTime = Date.now();

downloadListRepos();

async function downloadListRepos() {

  const dirPath = path.resolve(__dirname, 'data/listRepos');
  if (!fs.existsSync(dirPath))
    fs.mkdirSync(dirPath, { recursive: true });

  /** @type {string | number} */
  let cursor = fs.readdirSync(dirPath)
    .filter(x => x.endsWith('.json'))
    .map(x => Number(x.replace(/\.json$/, '')))
    .sort((a, b) => b - a)[0];

  console.log('Downloading BlueSki accounts via listRepos' + (cursor ? '@' + cursor : '') + ' [' + new Date(globalStartTime).toLocaleString() + ']');

  let nextUpdate = Date.now() + 1000;
  let newText = '';
  let newAddCount = 0;
  let totalAddCount = 0;

  while (true) {
    const fetchURL = 'https://bsky.network/xrpc/com.atproto.sync.listRepos' + (!cursor ? '' : '?cursor=' + cursor);

    const chunk = await fetchRetryText(fetchURL);
    const nextCursor = getCursor(chunk);

    // extract the data only (cursor already taken)
    const firstSqBracket = chunk.indexOf('[');
    const lastSqBracket = chunk.lastIndexOf(']');
    if (firstSqBracket > 0 && lastSqBracket > 0) {
      const add = chunk.slice(firstSqBracket + 1, lastSqBracket)
        .trim()
        .replace(
          /\},\{"did"\:"did\:plc/g,
          () => {
            newAddCount++;
            totalAddCount++;
            return '},\n{"did":"did:plc';
          });

      // number of delimiters + 1
      newAddCount++;
      totalAddCount++;

      newText = !newText ? add : newText + ',\n' + add;
    }

    if (nextCursor) {
      cursor = nextCursor;
    } else {
      console.log('  listRepos: no cursor ', chunk, ' ', fetchURL);
      break;
    }

    if (newText && Date.now() >= nextUpdate) {
      const accountPerSecond = Math.round(newAddCount / ((Date.now() - nextUpdate) / 1000));
      const totalAccountPerSecond = Math.round(totalAddCount / ((Date.now() - globalStartTime) / 1000));
      if (newText.length < 20e6) {
        console.log(
          '   listRepos@' + cursor + ' ' +
          Math.round(newText.length / 1000) / 1000 + 'M ' +
          accountPerSecond + ':' + totalAccountPerSecond + '/sec...');
      } else {
        process.stdout.write(
          '  listRepos@' + cursor + ' ' +
          Math.round(newText.length / 1000) / 1000 + 'M ' +
          accountPerSecond + ':' + totalAccountPerSecond + '/sec saving...');

        writeNow(dirPath, newText, nextCursor).then(() =>
          console.log(' OK.     ' + new Date().toLocaleTimeString()));
        newText = '';
      }
      newAddCount = 0;
      nextUpdate = Date.now() + Math.random() * 10000 + 10000;
    }
  }

  if (newText) {
    process.stdout.write('  listRepos COMPLETE ' + cursor + ' saving...');
    await writeNow(dirPath, newText, cursor);
    console.log(' OK.     ' + new Date().toLocaleTimeString());
  } else {
    console.log('  listRepos COMPLETE ' + cursor + ' OK.       ' + new Date().toLocaleTimeString());
  }
}

/**
 * @param {string} dirPath
 * @param {string} reposText
 * @param {string | number} cursor
 */
async function writeNow(dirPath, reposText, cursor) {
  const started = Date.now();
  const filePath = path.resolve(dirPath, cursor + '.json');
  await new Promise((resolve, reject) => {
    fs.writeFile(filePath, '[\n' + reposText + '\n]', err => err ? reject(err) : resolve(undefined));
  });
  process.stdout.write(' ' + ((Date.now() - started) / 1000) + 's ');
}

/**
 * @param {string} txtJson
 */
function getCursor(txtJson) {
  const match = /"cursor":\s*"([^"]+)"/.exec(txtJson);
  return match?.[1];
}

/**
 * @param {string} url
 */
async function fetchRetryText(url) {
  for (let i = 0; i < 10; i++) {
    try {
      const text = await fetch(url).then(x => x.text());
      return text;
    } catch (error) {
      process.stdout.write(' (?)');
      await new Promise(resolve => setTimeout(resolve, 200 * i));
    }
  }

  await new Promise(resolve => setTimeout(resolve, 15000));
  return fetch(url).then(x => x.text());
}
