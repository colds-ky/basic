// @ts-check

import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
  useNavigate,
  useParams,
} from "react-router-dom";

import { createTheme, ThemeProvider } from '@mui/material';
import { Landing } from './landing';
import { History } from './history';
import { breakFeedURIPostOnly, breakPostURL, defineCachedStore, detectProfileURL } from '../lib';

/** @typedef {ReturnType<typeof defineCachedStore>} DBAccess */
var db;
const DB_NAME = 'gisting-cache';

const DBContext = React.createContext(/** @type {DBAccess} */(/** @type {*} */(null)));

export const useDB = () => React.useContext(DBContext);

export function getGlobalCachedStore() {
  return db || (db = defineCachedStore({ dbName: DB_NAME }));
}

function runApp() {

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

  const router = useRouter(
    [
      { path: '/', element: <Landing /> },
      { path: '/index.html', element: <Landing /> },
      { path: '/profile/:handle/post/:post', element: <History /> },
      { path: '/profile/:handle', element: <History /> },
      { path: '/:handle', element: <History /> },
      { path: '/:handle/:post', element: <History /> },
      { path: '*', element: <ParseLink /> },
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
runApp();