// @ts-check

import React from 'react';
import { createRoot } from 'react-dom/client';

import { RootLayout } from './root-layout';


class App extends React.Component {
  render() {
    return <RootLayout />;
  }
}

function bootBrowser() {
  const preloadedTable = document.querySelector('body>table');

  const reactRoot = document.createElement('div');
  reactRoot.id = 'reactRoot';
  document.body.appendChild(reactRoot);

  preloadedTable?.remove();

  const root = createRoot(reactRoot);
  root.render(<App />);
}

if (typeof window !== 'undefined' && window)
  bootBrowser();
