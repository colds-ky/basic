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
  logLevel: 'info',
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

async function buildLib(mode) {

  let debounceWrite;

  const options = {
    ...baseOptions,
    entryPoints: ['lib/index.js'],
    plugins: [
      {
        name: 'post-export',
        setup(build) {
          build.onEnd(result => {
            clearTimeout(debounceWrite);
            debounceWrite = setTimeout(() => {
              const libsGenerated = fs.readFileSync(path.join(__dirname, 'libs.js'), 'utf8');
              const libsTransformed = libsGenerated.replace(
                /(\n\s*)require_lib\(\);(\s*\n)/g,
                `$1var req=require_lib();$1` +
                `if (typeof module!=='undefined' && module && module.exports) module.exports=req;$2`);

              if (libsTransformed !== libsGenerated) {
                fs.writeFileSync(path.join(__dirname, 'libs.js'), libsTransformed, 'utf8');
              }
            }, 10);
          });
        }
      }
    ],
    outfile: 'libs.js'
  };

  if (mode === 'serve' || mode === 'watch') {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('WATCHING LIB...');
  } else {
    await esbuild.build(options);
  }
}

async function buildSite(mode) {

  const options = {
    ...baseOptions,
    entryPoints: ['src/index.js'],
    outfile: 'index.js'
  };

  if (mode === 'serve') {
    const ctx = await esbuild.context(options);
    const server = await ctx.serve({
      servedir: __dirname,
      fallback: 'index.html'
    });
    console.log('SERVE http://' + (server.host === '0.0.0.0' ? 'localhost' : server.host) + ':' + server.port + '/');
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

buildLib(mode);
buildSite(mode);
