// @ts-check

import React from 'react';
import ReactDOM from 'react-dom';

import { RootLayout } from './root-layout';


class App extends React.Component {
  render() {
    return <RootLayout />;
  }
}


const preloadedTable = document.querySelector('body>table');

const reactRoot = document.createElement('div');
reactRoot.id = 'reactRoot';
document.body.appendChild(reactRoot);

preloadedTable?.remove();

ReactDOM.render(
  <App />,
  reactRoot);
