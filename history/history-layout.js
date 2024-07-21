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
 *  profile: import('../package').CompactProfile & { placeholder?: boolean },
 *  hideSearch?: boolean,
 *  onSearchQueryChanged?: (searchText: string) => void,
 *  children?: React.ReactNode,
 * }} Props
 */
export function HistoryLayout({
  className,
  profile,
  hideSearch,
  onSearchQueryChanged,
  children,
}) {
  const [forceShowSearch, setForceShowSearch] = useState(false);

  const [timeout] = React.useState({ timeout: 0, searchText: '' });

  const [searchParams, setSearchParams] = useSearchParams();
  const searchText = searchParams.get('q') || '';

  const showSearch = forceShowSearch || !!searchText;

  if (searchText !== timeout.searchText) {
    clearTimeout(timeout.timeout);
    timeout.searchText = searchText;
    if (!/\S/.test(searchText)) {
      console.log('setSearchParams', searchText, { replace: !searchText });
      setSearchParams({}, { replace: !searchText });
      onSearchQueryChanged?.('');
      return;
    }

    timeout.timeout = /** @type {*} */(setTimeout(async () => {
      timeout.timeout = 0;
      console.log('setSearchParams', searchText, { replace: !!searchText });
      setSearchParams({ q: searchText }, { replace: !!searchText });
      onSearchQueryChanged?.(searchText);
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
        hideSearch ? undefined :
        <div className={
          showSearch ?
            'history-search-bar history-search-bar-expanded' :
            'history-search-bar history-search-bar-collapsed'}>
          {
            !showSearch ? undefined :
              <input
                id='history-search-input'
                value={searchText}
                  onChange={e => {
                    const newSearchText = e.target.value; 
                    setSearchParams({ q: newSearchText }, { replace: !!searchText === !!newSearchText });
                  }}
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
