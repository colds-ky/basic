// @ts-check

import React, { useEffect } from 'react';

import { replaceIcon } from '../icon-inject';
import { localise } from '../localise';
import { FunBackground } from './fun-background';
import { SearchArea } from './search-area';

import { version } from '../../package.json';

import './landing.css';

export const uppercase_GIST = localise('𝓖𝓘𝓢𝓣', { uk: '𝓷𝓮𝓹𝓮𝓬𝔂𝓰' });

export function Landing() {
  useEffect(() => {
    document.documentElement.classList.remove('account');
    document.title = uppercase_GIST;
    replaceIcon(null);
  });
  
  return (
    <div className='landing'>
      <div className='landing-top-bar'>
        <a href="https://bsky.app/profile/gist.ing">Gist</a>
      </div>

      <SearchArea
        handleBandClassName='landing-handle-band'
        autoCompletionAreaClassName='landing-auto-completion-area'
      />

      <div className='landing-bottom-bar'>
        v{version}
      </div>

      <FunBackground />
    </div>
  );
}