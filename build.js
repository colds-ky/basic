// @ts-check

const fs = require('fs');
const path = require('path');

const esbuild = require('esbuild');
const rollup = require('rollup');

const mode = process.argv.some(arg => /^\-*serve$/i.test(arg)) ? 'serve' :
  process.argv.some(arg => /^\-*watch$/i.test(arg)) ? 'watch' :
    undefined;

rollupBuilder();
esbuildBuilder();

async function rollupBuilder() {
  const { nodeResolve } = require('@rollup/plugin-node-resolve');
  const json = /** @type {(options?: import('@rollup/plugin-json').RollupJsonOptions) => import('rollup').Plugin} */(/** @type {*} */(
    require('@rollup/plugin-json')));
  const commonjs = /** @type {(options?: import('@rollup/plugin-commonjs').RollupCommonJSOptions) => import('rollup').Plugin} */(/** @type {*} */(
    require('@rollup/plugin-commonjs')));
  const { babel } = require('@rollup/plugin-babel');

  const watcher = (mode === 'serve' || mode === 'watch' ? rollup.watch : rollup.rollup)({
    input: 'package/index.js',
    plugins: [
      nodeResolve({
        // @ts-ignore
        jsnext: true,
        browser: true
      }),
      json(),
      commonjs({ exclude: ['**/*three*/**'] }),
      babel({
      })
    ],
    external: ['crypto'],
    output: {
      sourcemap: true,
      format: 'umd',
      exports: 'named',
      file: 'libs.js',
      globals: { crypto: 'crypto' },
      name: 'coldsky'
    }
  });

  if (/** @type {rollup.RollupWatcher} */(watcher).on) {
    /** @type {rollup.RollupWatcher} */(watcher).on('event', event => {
      console.log('rollup:' + event.code);
      if (event.code === 'BUNDLE_END') {
        event.result.write({
          file: 'libs.js',
          sourcemap: true,
          format: 'umd',
          globals: { crypto: 'crypto' },
          name: 'coldsky'
        });
      } else if (event.code === 'ERROR') {
        console.error(event.error);
      }
    });
  } else {
    const bundle = /** @type {rollup.RollupBuild} */(await watcher);
    await bundle.write({
      file: 'libs.js',
      sourcemap: true,
      format: 'umd',
      globals: { crypto: 'crypto' },
      name: 'coldsky'
    });
  }
}

function esbuildBuilder() {

  /** @type {Parameters<typeof esbuild.build>[0]} */
  const baseOptions = {
    //entryPoints: ['lib/index.js'],
    bundle: true,
    sourcemap: true,
    target: 'es6',
    loader: {
      '.js': 'jsx',
      '.md': 'text'
    },
    format: 'iife',
    resolveExtensions: ['.js'],
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

  async function buildLib(mode) {

    /** @type {esbuild.BuildOptions} */
    const options = {
      ...baseOptions,
      format: 'esm',
      entryPoints: ['lib/index.js'],
      plugins: [
        {
          name: 'post-export',
          /** @param {esbuild.PluginBuild} build */
          setup(build) {
            build.onStart(() => {
              printBanner('LIBS.JS');
            }),
              build.onEnd(result => {
                const libsJSEntry = result.outputFiles?.find(file => file.path.endsWith('libs.js'));
                if (libsJSEntry) {
                  const libsGenerated = libsJSEntry.text;
                  const libsTransformed = libsGenerated.replace(
                    /(\n\s*)require_lib\(\);(\s*\n)/g,
                    `$1var req=require_lib();$1` +
                    `if (typeof module!=='undefined' && module && module.exports) module.exports=req;$2`);

                  if (libsTransformed !== libsGenerated) {
                    libsJSEntry.contents = Buffer.from(libsTransformed, 'utf8');
                  }
                }
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
      console.log('ESBUILD complete.');
    }
  }

  async function buildSites(mode) {

    const webOptions = {
      ...baseOptions,
      entryPoints: ['app.js'],
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
      const webCtx = await esbuild.context(webOptions);
      const webServer = await webCtx.serve({
        servedir: path.resolve(__dirname),
        fallback: 'index.html'
      });
      await webCtx.watch();
      console.log('SERVING SITE http://' + (webServer.host === '0.0.0.0' ? 'localhost' : webServer.host) + ':' + webServer.port + '/');

    } else if (mode === 'watch') {
      const webCtx = await esbuild.context(webOptions);
      await webCtx.watch();
      console.log('WATCHING SITE...');
    } else {
      await esbuild.build(webOptions);
    }
  }

  //buildLib(mode);
  buildSites(mode);
}