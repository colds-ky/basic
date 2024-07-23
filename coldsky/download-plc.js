// @ts-check

const fs = require('fs');
const path = require('path');
const globalStartTime = Date.now();

downloadPlcDirectory();

async function downloadPlcDirectory() {

  const dirPath = path.resolve(__dirname, 'data/plc');
  if (!fs.existsSync(dirPath))
    fs.mkdirSync(dirPath, { recursive: true });

  let timestamp = fs.readdirSync(dirPath)
    .filter(x => x.endsWith('.json'))
    .sort()
    .slice(0, 1)
    .map(jsonPath => getLastTimestamp(fs.readFileSync(path.resolve(dirPath, jsonPath), 'utf8')))[0];

  console.log('Downloading BlueSki accounts via plc.directory/export' + (timestamp ? '@' + timestamp : '') + ' [' + new Date(globalStartTime).toLocaleString() + ']');

  let nextUpdate = Date.now() + 1000;
  let newText = '';
  let newAddCount = 0;
  let totalAddCount = 0;

  while (true) {
    const fetchURL = 'https://plc.directory/export?count=1000' + (!timestamp ? '' : '&after=' + timestamp);
    const jsonLines = await fetchRetryText(fetchURL);
    if (!jsonLines?.length) break;

    const add = jsonLines.trim().replace(
      /\n/g,
      () => {
        newAddCount++;
        totalAddCount++;
        return ',\n';
      });
    // number of delimiters + 1
    newAddCount++;
    totalAddCount++;

    newText = !newText ? add : newText + ',\n' + add;
    timestamp = getLastTimestamp(jsonLines);

    if (newText && Date.now() >= nextUpdate) {
      const accountPerSecond = Math.round(newAddCount / ((Date.now() - nextUpdate) / 1000));
      const totalAccountPerSecond = Math.round(totalAddCount / ((Date.now() - globalStartTime) / 1000));
      if (newText.length < 20e6) {
        console.log(
          '   plc.directory@' + timestamp + ' ' +
          Math.round(newText.length / 1000) / 1000 + 'M ' +
          accountPerSecond + ':' + totalAccountPerSecond + '/sec...');
      } else {
        process.stdout.write(
          '  plc.directory@' + timestamp + ' ' +
          Math.round(newText.length / 1000) / 1000 + 'M ' +
          accountPerSecond + ':' + totalAccountPerSecond + '/sec saving...');

        writeNow(dirPath, newText, timestamp).then(() =>
          console.log(' OK.     ' + new Date().toLocaleTimeString()));
        newText = '';
      }
      newAddCount = 0;
      nextUpdate = Date.now() + Math.random() * 10000 + 10000;
    }
  }

  if (newText) {
    process.stdout.write('  plc.directory COMPLETE ' + timestamp + ' saving...');
    await writeNow(dirPath, newText, timestamp);
    console.log(' OK.     ' + new Date().toLocaleTimeString());
  } else {
    console.log('  plc.directory COMPLETE ' + timestamp + ' OK.       ' + new Date().toLocaleTimeString());
  }
}

/**
 * @param {string} dirPath
 * @param {string} reposText
 * @param {string} timestamp
 */
async function writeNow(dirPath, reposText, timestamp) {
  const abbreviatedTimestamp = timestamp.replace(/\:/g, '-');
  const started = Date.now();
  const filePath = path.resolve(dirPath, abbreviatedTimestamp + '.json');
  await new Promise((resolve, reject) => {
    fs.writeFile(filePath, '[\n' + reposText + '\n]', err => err ? reject(err) : resolve(undefined));
  });
  process.stdout.write(' ' + ((Date.now() - started) / 1000) + 's ');
}

function getLastTimestamp(txtJson) {
  let posCreatedAt = '';
  txtJson.replace(/"createdAt":\s*"([^"]+)"/g, (whole, match) => {
    posCreatedAt = match;
    return whole;
  });

  return posCreatedAt;
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
