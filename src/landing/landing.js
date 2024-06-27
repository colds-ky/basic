// @ts-check

import { Input, TextField } from '@mui/material';
import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';

import { FunBackground } from './fun-background';
import { version } from '../../package.json';

import './landing.css';
import { searchAccounts } from '../api';
import { localise } from '../localise';
import { AccountLabel } from '../widgets/account';

export function Landing() {
  const [timeout] = React.useState({ timeout: 0, searchText: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = React.useState(searchParams.get('q') || '');
  const [searchResults, setSearchResults] = React.useState(
    /** @type {import('@atproto/api/dist/client/types/app/bsky/actor/defs').ProfileViewBasic[]} */([]));
  
  if (searchText !== timeout.searchText) {
    clearTimeout(timeout.timeout);
    timeout.searchText = searchText;
    if (!/\S/.test(searchText)) {
      setSearchParams({});
      setSearchResults([]);
      return;
    }

    timeout.timeout = setTimeout(async () => {
      setSearchParams({ q: searchText });
      const searchResults = await searchAccounts(searchText);
      if (timeout.searchText !== searchText) return;
      setSearchResults(searchResults);
    }, 500);
  }

  return (
    <div className='landing'>
      <div className='landing-top-bar'>
        <a href="https://bsky.app/profile/gist.ing">𝕲𝖎𝖘𝖙</a>
      </div>

      <div className='landing-handle-band'>
        <TextField
          id="handle" name="handle"
          autoComplete="nickname"
          label={localise(
            'Searching for someone?',
            { uk: 'Кого шукаємо?' })}
          variant='standard'
          value={searchText}
          onChange={(e) => {
            const searchText = e.target.value;
            setSearchText(searchText);
          }}
        />
      </div>
      {
        !searchResults.length ? undefined :
          <div className='landing-auto-completion-area'>
            {searchResults.map(profile => (
              <Link key={profile.did} to={`/${profile.handle}`} className='landing-auto-complete-entry'>
                <AccountLabel account={profile} Component='div' withDisplayName />
              </Link>
            ))}
          </div>
      }
      <div className='landing-bottom-bar'>
        v{version}
      </div>

      <FunBackground />
    </div>
  );
}