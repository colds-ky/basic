// @ts-check

const fs = require('fs');
const path = require('path');
const globalStartTime = Date.now();

const _shortenDID_Regex = /^did\:plc\:/;

let skipRandom = 0;

downloadCARs();

async function downloadCARs() {
  const plcDirPath = path.resolve(__dirname, 'data/plc');
  const dirPath = path.resolve(__dirname, 'data/car');
  if (!fs.existsSync(dirPath))
    fs.mkdirSync(dirPath, { recursive: true });

  for (const account of iterateDIDs(plcDirPath)) {
    if (skipRandom) {
      skipRandom--;
      continue;
    }

    await downloadAccount(dirPath, account);
  }
}

async function downloadAccount(dirPath, account) {
  const did = account.did;
  const handle = account.operation?.handle || account.operation?.alsoKnownAs?.[0].replace(/^at\:\/\//, '');

  const strictDID = shortenDID(did).replace(/[^a-z0-9]/g, '');
  const carDir = path.resolve(dirPath, strictDID.slice(0, 2), strictDID.slice(2, 4));
  const carPath = path.resolve(carDir, strictDID + '.car');
  if (fs.existsSync(carPath)) return;

  process.stdout.write(' ' + (handle || did) + '...');
  const plcLog = JSON.parse(await fetchRetryText(`https://plc.directory/${did}/log/audit`));
  const pds = plcLog
    .slice()
    .reverse()
    .map(entry => entry.operation?.services?.atproto_pds?.endpoint)
    .find(Boolean);

  if (!pds) {
    console.log(' no PDS.');
    return;
  }

  process.stdout.write(' ' + pds);
  const car = await fetchRetryBuffer(pds + '/xrpc/com.atproto.sync.getRepo?did=' + did);

  process.stdout.write(' ' + Math.round(car.byteLength / 1000).toLocaleString() + 'K...');
  if (fs.existsSync(carPath)) {
    skipRandom = Math.floor(Math.random() * 100 + 20);
    console.log(' already populated, skipping ' + skipRandom + '.');
    return;
  }

  if (!fs.existsSync(carDir))
    fs.mkdirSync(carDir, { recursive: true });

  fs.writeFileSync(carPath, Buffer.from(car));
  console.log(' OK.');

}

function* iterateDIDs(plcDirPath) {
  let plcJsonFiles = fs.readdirSync(plcDirPath)
    .filter(x => x.endsWith('.json'))
    .sort();

  for (const jsonPath of plcJsonFiles) {
    const json = JSON.parse(fs.readFileSync(path.resolve(plcDirPath, jsonPath), 'utf8'));

    for (const account of json) {
      yield account;
    }
  }
}

/**
 * @param {T} did
 * @returns {T}
 * @template {string | undefined | null} T
 */
function shortenDID(did) {
  return did && /** @type {T} */(did.replace(_shortenDID_Regex, '').toLowerCase() || undefined);
}

/**
 * @param {string} url
 */
async function fetchRetryBuffer(url) {
  for (let i = 0; i < 10; i++) {
    try {
      const buf = await fetch(url).then(x => x.arrayBuffer());
      return buf;
    } catch (error) {
      process.stdout.write(' (?)');
      await new Promise(resolve => setTimeout(resolve, 200 * i));
    }
  }

  await new Promise(resolve => setTimeout(resolve, 15000));
  return fetch(url).then(x => x.arrayBuffer());
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
