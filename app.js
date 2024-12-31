// @ts-check

import { createTheme, ThemeProvider } from '@mui/material';
import Dexie from 'dexie';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
  useNavigate,
  useParams,
} from "react-router-dom";

import { AtlasComponent } from './atlas';
import { Bot } from './bot';
import { History } from './history';
import { Landing } from './landing';
import { version as dexiePkgVersion } from './node_modules/dexie/package.json';
import { breakFeedURIPostOnly, breakPostURL, defineCachedStore, detectProfileURL } from './package';
import { StatsComponent } from './stats';
import { ShowReadme } from './widgets/show-readme/show-readme';
import { bootWorker } from './worker';

import { version } from './package.json';

/** @typedef {ReturnType<typeof defineCachedStore>} DBAccess */
/** @type {DBAccess} */
var db;
export const DB_NAME = 'gisting-cache';

const DBContext = React.createContext(/** @type {DBAccess} */(/** @type {*} */(null)));

export const useDB = () => React.useContext(DBContext);

export function getGlobalCachedStore() {
  return db || (db = defineCachedStore({ dbName: DB_NAME }));
}

function initiateWebWorker() {
  if (typeof Worker !== 'undefined') {
    const indexJSPath = [...document.scripts].reverse().find(scr => scr.src)?.src;
    if (indexJSPath) {
      const worker = new Worker(indexJSPath);
      worker.onmessage = (event) => {
        console.log('Message from worker:', event.data);
      };
      worker.onerror = (error) => {
        console.error('Worker error:', error);
      };
      console.log('Worker created:', worker, indexJSPath);

      return worker;
    }
  }
}

function runApp() {

  const workerRef = initiateWebWorker();

  getGlobalCachedStore();

  const basename =
    /file/i.test(location.protocol) ? undefined :
      /oyin\.bo|mihailik/i.test(location.hostname) ? '/receipts' : '/'

  const useRouter =
    /file/i.test(location.protocol) ?
      createHashRouter : createBrowserRouter;

  const ParseLink = () => {
    let path = useParams()['*'];
    const navigate = useNavigate();
    const exit = (url) => {
      useEffect(() => {
        navigate(url);
      });
      return '';
    };

    if (!path) return exit('/');
    path = path.replace(/^\/+/g, '').replace(/\/+$/g, '');
    if (!path) return exit('/');

    const pathWithQuery = location.search ? path + location.search : path;

    const postURL =
      breakFeedURIPostOnly(path) || breakPostURL(path) ||
      breakFeedURIPostOnly(pathWithQuery) || breakPostURL(pathWithQuery);
    if (postURL) return exit(`/${postURL.shortDID}/${postURL.postID}`);

    const profileURL =
      detectProfileURL(path) ||
      detectProfileURL(pathWithQuery);

    if (profileURL) return exit(`/${profileURL}`);
    if (path.indexOf('/') < 0) return exit('/' + path);
    else return exit('/?q=' + path);
  };

  const useBot = [location.host, location.hash].some(h =>
    /rekun/i.test([...h].reverse().join('')));

  const router = useRouter(
    useBot ?
      [
        { path: '/', Component: Bot },
        {
          path: '*', Component: () => {
            const navigate = useNavigate();
            useEffect(() => {
              navigate('/');
            });
            return '';
          }
        }
      ] :
      [
        { path: '/', Component: Landing },
        { path: '/index.html', Component: Landing },
        { path: '/atlas', Component: AtlasComponent },
        { path: '/stats', Component: StatsComponent },
        {
          path: '/db', Component: () => {
            const [result, setResult] = useState(/** @type {*} */({ app: 'initialising...' }));
            useEffect(() => {
              (async () => {
                const start = Date.now();
                try {
                  const deps = Dexie.dependencies;
                  const maxKey = Dexie.maxKey;
                  setResult({
                    app: 'v' + version + ' getDatabaseNames()...',
                    deps,
                    maxKey,
                    dexiePkgVersion,
                    version: Dexie.version
                  });
                  const dbNames = await Dexie.getDatabaseNames();

                  setResult({
                    app: 'v' + version + ' new Dexie()...',
                    dbNames,
                    deps,
                    maxKey
                  });

                  const dx = new Dexie('gisting-cache');

                  setResult({
                    app: 'v' + version + ' dexie.open()...',
                    dbNames,
                    deps,
                    maxKey,
                    dexiePkgVersion,
                    version: Dexie.version
                  });

                  await dx.open();
                  setResult({
                    app: 'v' + version + ' collecting properties...',
                    dbNames,
                    deps,
                    maxKey,
                    dexiePkgVersion,
                    version: Dexie.version
                  });

                  const coreSchema = dx.core?.schema;
                  const hasFailed = dx.hasFailed();
                  const verno = dx.verno;

                  setResult({
                    app: 'v' + version + ' complete in ' + (Date.now() - start) + 'ms.',
                    dbNames,
                    deps,
                    maxKey,
                    coreSchema,
                    hasFailed,
                    verno,
                    dexiePkgVersion,
                    version: Dexie.version
                  });
                } catch (error) {
                  setResult({
                    app: 'v' + version + ' failed in ' + (Date.now() - start) + 'ms.',
                    error: error.message,
                    stack: error.stack,
                    dexiePkgVersion,
                    version: Dexie.version
                  });
                }
              })();
            }, []);

            return (
              <>
                <h2>IndexedDB Dexie interface</h2>
                <pre>
                  {JSON.stringify(result, null, 2)};
                </pre>
              </>
            );
          }
        },
        { path: '/coldsky', Component: ShowReadme },
        { path: '/profile/:handle/post/:post', Component: History },
        { path: '/profile/:handle', Component: History },
        { path: '/:handle', Component: History },
        { path: '/:handle/:post', Component: History },
        { path: '*', Component: ParseLink },
      ], {
    basename
  });

  const root = document.createElement('div');
  root.id = 'root';
  root.style.cssText = `
    min-height: 100%;
    display: grid;
  `;
  document.body.appendChild(root);

  const theme = createTheme({
    components: {
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: 'white',
            color: 'black',
            border: 'solid 1px #e8e8e8',
            boxShadow: '3px 3px 8px rgba(0, 0, 0, 12%)',
            fontSize: '90%',
            // maxWidth: '40em',
            padding: '0.7em',
            paddingRight: '0.2em'
          },
        },
      },
    },
  });

  createRoot(root).render(
    <ThemeProvider theme={theme}>
      <DBContext.Provider value={db}>
        <RouterProvider router={router} />
      </DBContext.Provider>
    </ThemeProvider>
  );
}

if (typeof window !== 'undefined')
  runApp();
else if (typeof self !== 'undefined')
  bootWorker();
else
  throw new Error('Cannot run in this environment: neither browser nor worker.');