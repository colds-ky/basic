// @ts-check

import { marked } from 'marked';
import React from 'react';

// @ts-ignore
import README from '../../README.md';

import './show-readme.css';
import { setGlobalAppView } from '../../app-shared/icon-inject';

export function ShowReadme() {

  const readmeHTML = marked(README);

  setGlobalAppView('coldsky');

  return (
    <div className='show-readme' dangerouslySetInnerHTML={{ __html: readmeHTML }} />
  );
}