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

    await downloadAccount(dirPath, account).catch(err => {
      if (/Known faulty/i.test(err?.message || '')) {
        console.log(' ', err.message);
      } else {
        console.log(' ', err);
        console.log();
      }
    });
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

var knownFaultyDomains;

/**
 * @param {string} url
 * @param {boolean} arrayBuffer
 */
async function fetchRetryCore(url, arrayBuffer) {
  const { host } = new URL(url);
  const faulty = knownFaultyDomains?.get(host);
  if (faulty > 10) throw new Error('Known faulty ' + host + ' failed ' + faulty + ' times.');

  for (let i = 0; i < (faulty ? 1 : 4); i++) {
    try {
      const buf = await fetch(url).then(x => arrayBuffer ? x.arrayBuffer() : /** @type {*} */(x.text()));
      if (faulty) knownFaultyDomains.delete(host);
      
      return buf;
    } catch (error) {
      if (!knownFaultyDomains) knownFaultyDomains = new Map();
      knownFaultyDomains.set(host, (knownFaultyDomains.get(host) || 0) + 1);
      process.stdout.write(' (' + (faulty||'?') + ')');
      await new Promise(resolve => setTimeout(resolve, 200 * i));
    }
  }

  await new Promise(resolve => setTimeout(resolve, faulty ? 300 : 1000));

  return fetch(url).then(x => arrayBuffer ? x.arrayBuffer() : /** @type {*} */(x.text()));
}


/**
 * @param {string} url
 */
function fetchRetryBuffer(url) {
  return fetchRetryCore(url, /* arrayBuffer */true);
}

/**
 * @param {string} url
 */
function fetchRetryText(url) {
  return fetchRetryCore(url, /* arrayBuffer */false);
}
