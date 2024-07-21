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
    input: 'lib/index.js',
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

  async function buildSite(mode) {

    const gistingOptions = {
      ...baseOptions,
      entryPoints: ['gisting/index.js'],
      outfile: 'gisting/dist/index.js',
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

    const coldskyOptions = {
      ...baseOptions,
      entryPoints: ['coldsky/index.js'],
      outfile: 'coldsky/dist/index.js',
      plugins: [
        {
          name: 'post-export',
          /** @param {esbuild.PluginBuild} build */
          setup(build) {
            build.onStart(result => {
              printBanner('COLDSKY-SITE');
            });
          }
        }]
    };

    if (mode === 'serve') {
      (async () => {
        const gistingCtx = await esbuild.context(gistingOptions);
        const gistingServer = await gistingCtx.serve({
          servedir: path.resolve(__dirname, 'gisting/dist'),
          fallback: 'index.html'
        });
        await gistingCtx.watch();
        console.log('SERVING SITE http://' + (gistingServer.host === '0.0.0.0' ? 'localhost' : gistingServer.host) + ':' + gistingServer.port + '/');
      })();

      (async () => {
        const coldskyCtx = await esbuild.context(coldskyOptions);
        const coldskyServer = await coldskyCtx.serve({
          servedir: path.resolve(__dirname, 'coldsky/dist'),
          fallback: 'index.html',
          port: 8081
        });
        await coldskyCtx.watch();
        console.log('SERVING CODSKY SITE http://' + (coldskyServer.host === '0.0.0.0' ? 'localhost' : coldskyServer.host) + ':' + coldskyServer.port + '/');
      })();

    } else if (mode === 'watch') {
      (async () => {
        const gistingCtx = await esbuild.context(gistingOptions);
        await gistingCtx.watch();
        console.log('WATCHING SITE...');
      })();

      (async () => {
        const coldskyCtx = await esbuild.context(coldskyOptions);
        await coldskyCtx.watch();
        console.log('WATCHING COLDSKY SITE...');
      })();

    } else {
      await esbuild.build(coldskyOptions);
    }
  }

  buildLib(mode);
  buildSite(mode);
}