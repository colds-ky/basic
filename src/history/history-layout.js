// @ts-check

import SearchIcon from '@mui/icons-material/Search';
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { FullHandle } from '../widgets/account/full-handle';
import { PreFormatted } from '../widgets/preformatted';

import './history-layout.css';

/**
 * @param {{
 *  className?: string,
 *  profile: import('../../coldsky/lib').CompactProfile & { placeholder?: boolean },
 *  children?: React.ReactNode,
 * }} Props
 */
export function HistoryLayout({ className, profile, children }) {
  const [forceShowSearch, setForceShowSearch] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');

  const showSearch = forceShowSearch || !!searchText;

  const [timeout] = React.useState({ timeout: 0, searchText: '' });

  if (searchText !== timeout.searchText) {
    clearTimeout(timeout.timeout);
    timeout.searchText = searchText;
    if (!/\S/.test(searchText)) {
      setSearchParams({});
      //setSearchProfileResults([]);
      return;
    }

    timeout.timeout = /** @type {*} */(setTimeout(async () => {
      setSearchParams({ q: searchText });
      //startSearchProfiles();
      //startSearchPosts();
    }, 400));
  }


  return (
    <div className={className ? 'history-layout ' + className : 'history-layout'}>

      <div
        className={suffixClassWhenEmpty('history-account-banner-bg', profile.banner, profile)}
        style={!profile.banner ? undefined : { backgroundImage: `url(${profile.banner})` }}>
      </div>

      <div
        className='history-account-avatar-bg' />
      <div
        className={suffixClassWhenEmpty('history-account-avatar', profile.avatar, profile)}
        style={!profile.avatar ? undefined : { backgroundImage: `url(${profile.avatar})` }}>
      </div>


      <div className={suffixClassWhenEmpty('history-account-displayName-and-handle', profile.displayName, profile)}>
        <span className={suffixClassWhenEmpty('history-account-displayName', profile.displayName, profile)}>
          <span className='history-account-displayName-stroke'>
            {profile.displayName}
          </span>
          <span className='history-account-displayName-inner'>
            {profile.displayName}
          </span>
        </span>

        <div className='history-account-handle'>
          <span className='at-sign'>@</span><FullHandle shortHandle={profile.handle} />
        </div>
      </div>

      <div className='sticky-header-background'></div>
      <div className='sticky-header-background-cover'></div>

      {
        <div className={
          showSearch ?
            'history-search-bar history-search-bar-expanded' :
            'history-search-bar history-search-bar-collapsed'}>
          {
            !showSearch ? undefined :
              <input
                id='history-search-input'
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
          }
          <SearchIcon className='history-search-icon' onClick={() => {
            setForceShowSearch(true);
            setTimeout(() => {
              const input = /** @type {HTMLInputElement} */(document.getElementById('history-search-input'));
              input?.focus();
              if (input) {
                input.select();
                input.onblur = () => {
                  setForceShowSearch(false);
                };
              }
            }, 1);
          }} />
        </div>
      }

      <PreFormatted
        text={profile.description}
        className={suffixClassWhenEmpty('history-account-description', profile.description, profile)} />

      <div className='timeline-container'>
        {
          children
        }
      </div>

    </div>
  );
}

/**
 * @param {string} className
 * @param {any} value
 * @param {{ placeholder?: boolean } | undefined} hasPlaceholder
 */
function suffixClassWhenEmpty(className, value, hasPlaceholder) {
  const withEmpty = value ? className : className + ' ' + className + '-empty';
  return hasPlaceholder?.placeholder ? withEmpty + ' ' + className + '-placeholder' : withEmpty;
}
