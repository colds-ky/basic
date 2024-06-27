// @ts-check

import { Input, TextField } from '@mui/material';
import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { FunBackground } from './fun-background';
import { version } from '../../package.json';

import './landing.css';
import { searchAccounts } from '../api';

export function Landing() {
  const [timeout] = React.useState({ timeout: 0, searchText: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = React.useState(searchParams.get('q') || '');
  const [searchResults, setSearchResults] = React.useState(
    /** @type {import('@atproto/api/dist/client/types/app/bsky/actor/defs').ProfileViewBasic[]} */([]));

  return (
    <div className='landing'>
      <div className='landing-top-bar'>
        <a href="https://bsky.app/profile/gist.ing">𝕲𝖎𝖘𝖙</a>
      </div>

      <div className='landing-handle-band'>
        <TextField
          id="handle" name="handle"
          autoComplete="nickname"
          label="Searching for someone?"
          variant='standard'
          value={searchText}
          onChange={(e) => {
            const searchText = e.target.value;
            setSearchText(searchText);
            clearTimeout(timeout.timeout);
            timeout.searchText = searchText;
            timeout.timeout = setTimeout(async () => {
              setSearchParams({ q: searchText });
              const searchResults = await searchAccounts(searchText);
              if (timeout.searchText !== searchText) return;
              setSearchResults(searchResults);
            }, 500);
          }}
        />
      </div>
      <div className='landing-auto-completion-area'>
        {
          !searchResults.length ? undefined :
            searchResults.map(profile => (
              <div key={profile.did} className='landing-auto-completion-item'>
                <a href={`/${profile.handle}`}>{profile.displayName}</a>
              </div>
            
            ))
        }
      </div>
      <div className='landing-bottom-bar'>
        v{version}
      </div>

      <FunBackground />
    </div>
  );
}