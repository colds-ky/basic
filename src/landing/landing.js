// @ts-check

import { Input, TextField } from '@mui/material';
import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { FunBackground } from './fun-background';
import { version } from '../../package.json';

import './landing.css';

export function Landing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = React.useState(searchParams.get('q') || '');

  return (
    <div className='landing'>
      <div className='landing-top-bar'>
        <a href="https://bsky.app/profile/oyin.bo">oyin.bo</a>
      </div>

      <div className='landing-handle-band'>
        <TextField
          id="handle" name="handle"
          autoComplete="nickname"
          label="Searching for someone?"
          variant='standard'
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setSearchParams({ q: e.target.value });
          }}
        />
      </div>
      <div className='landing-auto-completion-area'>
      </div>
      <div className='landing-bottom-bar'>
        v{version}
      </div>

      <FunBackground />
    </div>
  );
}