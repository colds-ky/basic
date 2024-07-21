// @ts-check

import React, { useEffect } from 'react';

import { setGlobalAppView } from '../icon-inject';
import { FunBackground } from './fun-background';
import { SearchArea } from './search-area';

import { version } from '../../package.json';

import './landing.css';
import { AtlasComponent } from '../atlas';
import { Link } from 'react-router-dom';

export function Landing() {
  const [showAtlas, setShowAtlas] = React.useState(false);

  useEffect(() => {
    setGlobalAppView(undefined);
  }, []);
  
  return (
    <div className='landing'>
      <div className='landing-top-bar'>
        <Link className='coldsky-link' to='coldsky'>
          Cold Sky
        </Link>
      </div>

      <SearchArea
        handleBandClassName='landing-handle-band'
        autoCompletionAreaClassName='landing-auto-completion-area'
      />

      <div className='landing-bottom-bar' onClick={() => setShowAtlas(!showAtlas)}>
        v{version}
      </div>

      {
        showAtlas ?
          <AtlasComponent /> :
          <FunBackground />
      }
    </div>
  );
}