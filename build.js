// @ts-check

const esbuild = require('esbuild');
const path = require('path');

async function build(mode) {

  /** @type {Parameters<typeof esbuild.build>[0]} */
  const options = {
    entryPoints: ['lib/index.js'],
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
      'node:node:constants', 'node:node:buffer', 'node:node:querystring', 'node:node:events', 'node:node:fs',
      'node:node:path', 'node:node:os', 'node:node:crypto', 'node:node:util', 'node:node:stream',
      'node:node:assert', 'node:node:tty', 'node:node:net', 'node:node:tls', 'node:node:http', 'node:node:https',
      'node:node:zlib', 'node:node:http2', 'node:node:perf_hooks', 'node:node:child_process',
      'node:node:worker_threads',

      'ws'
    ],
    outfile: 'libs.js'
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
    console.log('WATCHING...');
  } else {
    await esbuild.build(options);
  }
}

build(
  process.argv.some(arg => /^\-*serve$/i.test(arg)) ? 'serve' :
    process.argv.some(arg => /^\-*watch$/i.test(arg)) ? 'watch' :
      undefined);