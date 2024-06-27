// @ts-check

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

/** @type {Parameters<typeof esbuild.build>[0]} */
const baseOptions = {
  //entryPoints: ['lib/index.js'],
  bundle: true,
  sourcemap: true,
  target: 'es6',
  loader: { '.js': 'jsx' },
  format: 'iife',
  //logLevel: 'info',
  external: [
    'fs', 'path', 'os',
    'crypto', 'tty', 'tls',
    'events', 'stream',
    'zlib',
    'assert',
    'net', 'http', 'https', 'http2',
    'child_process',
    'module', 'url', 'worker_threads', 'util',
    'node:constants', 'node:buffer', 'node:querystring', 'node:events', 'node:fs', 'node:path', 'node:os',
    'node:crypto', 'node:util', 'node:stream', 'node:assert', 'node:tty', 'node:net', 'node:tls', 'node:http',
    'node:https', 'node:zlib', 'node:http2', 'node:perf_hooks', 'node:child_process', 'node:worker_threads',

    'ws'
  ],
  //outfile: 'libs.js'
};

let lastPrinted = 0;
function printBanner(text) {
  const dt = new Date();
  let bannerText =
    dt.getHours() + ':' + (100 + dt.getMinutes()).toString().slice(1) + ':' + (100 + dt.getSeconds()).toString().slice(1) + ' ' +
    text + ' ';
  while (bannerText.length < 30)
    bannerText += '=';

  if (Date.now() - lastPrinted > 3000) bannerText = '\n' + bannerText;
  if (Date.now() - lastPrinted > 10000) bannerText = '\n' + bannerText;

  console.log(bannerText);
  lastPrinted = dt.getTime();
}

async function buildSite(mode) {

  const options = {
    ...baseOptions,
    entryPoints: ['src/index.js'],
    outfile: 'index.js',
    plugins: [
      {
        name: 'post-export',
        /** @param {esbuild.PluginBuild} build */
        setup(build) {
          build.onStart(result => {
            printBanner('SITE');
          });
        }
      }]
  };

  if (mode === 'serve') {
    const ctx = await esbuild.context(options);
    const server = await ctx.serve({
      servedir: __dirname,
      fallback: 'index.html'
    });
    await ctx.watch();
    console.log('SERVING SITE http://' + (server.host === '0.0.0.0' ? 'localhost' : server.host) + ':' + server.port + '/');
  } else if (mode === 'watch') {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('WATCHING SITE...');
  } else {
    await esbuild.build(options);
  }
}

const mode = process.argv.some(arg => /^\-*serve$/i.test(arg)) ? 'serve' :
  process.argv.some(arg => /^\-*watch$/i.test(arg)) ? 'watch' :
    undefined;

buildSite(mode);
