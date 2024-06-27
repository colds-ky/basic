// @ts-check

import React from 'react';
import { createRoot } from 'react-dom/client';

import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from "react-router-dom";

import { createTheme, ThemeProvider } from '@mui/material';
import { Landing } from './landing';
import { History } from './history';

function runApp() {

  const basename =
    /file/i.test(location.protocol) ? undefined :
      /oyin\.bo|mihailik/i.test(location.hostname) ? '/receipts' : '/'

  const useRouter =
    /file/i.test(location.protocol) ?
      createHashRouter : createBrowserRouter;

  const router = useRouter(
    [
      { path: '/', element: <Landing /> },
      { path: '/index.html', element: <Landing /> },
      { path: '/:handle', element: <History /> }
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
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <>
          <RouterProvider router={router} />
        </>
      </ThemeProvider>
    </React.StrictMode>
  );
}
runApp();