// @ts-check

import { Input, TextField } from '@mui/material';
import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useDB } from '..';
import { replaceIcon } from '../icon-inject';
import { localise } from '../localise';
import { AccountLabel } from '../widgets/account';
import { FunBackground } from './fun-background';

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
    <LandingCore />
  );
}

export function LandingCore() {
  const db = useDB();
  const [timeout] = React.useState({ timeout: 0, searchText: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = React.useState(searchParams.get('q') || '');
  const [searchResults, setSearchResults] = React.useState(
    /** @type {{complete?: boolean} & import('../../coldsky/lib').MatchCompactProfile[]} */([]));
  
  if (searchText !== timeout.searchText) {
    clearTimeout(timeout.timeout);
    timeout.searchText = searchText;
    if (!/\S/.test(searchText)) {
      setSearchParams({});
      setSearchResults([]);
      return;
    }

    timeout.timeout = /** @type {*} */(setTimeout(async () => {
      setSearchParams({ q: searchText });
      for await (const searchResults of db.searchProfilesIncrementally(searchText)) {
        if (timeout.searchText !== searchText) return;
        setSearchResults(searchResults);
      }
      if (timeout.searchText === searchText) {
        setSearchResults(r => {
          r = r.slice();
          r.complete = true;
          return r;
        });
      }
    }, 400));
  }

  return (
    <div className='landing'>
      <div className='landing-top-bar'>
        <a href="https://bsky.app/profile/gist.ing">Gist</a>
      </div>

      <div className='landing-handle-band'>
        <TextField
          id="handle" name="handle"
          autoComplete="nickname"
          label={localise(
            'Searching for anything?',
            { uk: 'Шукаємо щось, чи шо?' })}
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
            {(searchResults.length < 10 ? searchResults : searchResults.slice(0,10)).map(profile => (
              <Link key={profile.shortDID} to={`/${profile.handle}`} className='landing-auto-complete-entry'>
                <AccountLabel account={profile} Component='div' withDisplayName />
              </Link>
            ))}
            {
              searchResults.complete ? undefined :
                <div className='landing-auto-completion-progress'>
                  ...
                </div>
            }
          </div>
      }
      <div className='landing-bottom-bar'>
        v{version}
      </div>

      <FunBackground />
    </div>
  );
}