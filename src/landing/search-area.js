// @ts-check

import { TextField } from '@mui/material';
import React from 'react';
import { localise } from '../localise';
import { Link, useSearchParams } from 'react-router-dom';
import { useDB } from '..';
import { AccountLabel } from '../widgets/account';
import { forAwait } from '../../coldsky/src/api/forAwait';
import { breakFeedUri } from '../../coldsky/lib';

/**
 * @param {{
 *  handleBandClassName?: string,
 *  autoCompletionAreaClassName?: string
 * }} _
 */
export function SearchArea({ handleBandClassName, autoCompletionAreaClassName }) {

  const db = useDB();
  const [timeout] = React.useState({ timeout: 0, searchText: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = React.useState(searchParams.get('q') || '');
  const [searchProfileResults, setSearchProfileResults] = React.useState(
    /** @type {{complete?: boolean} & import('../../coldsky/lib').MatchCompactProfile[]} */([]));

  const [searchPostResults, setSearchPostResults] = React.useState(
    /** @type {{complete?: boolean} & import('../../coldsky/lib').MatchCompactPost[]} */([]));

  if (searchText !== timeout.searchText) {
    clearTimeout(timeout.timeout);
    timeout.searchText = searchText;
    if (!/\S/.test(searchText)) {
      setSearchParams({});
      setSearchProfileResults([]);
      return;
    }

    timeout.timeout = /** @type {*} */(setTimeout(async () => {
      setSearchParams({ q: searchText });
      startSearchProfiles();
      startSearchPosts();
    }, 400));
  }

  return (
    <>
      <div className={handleBandClassName}>
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
        !searchProfileResults.length ? undefined :
          <div className={autoCompletionAreaClassName}>
            {(searchProfileResults.length < 10 ? searchProfileResults : searchProfileResults.slice(0, 10)).map(profile => (
              <AccountCompletionLink key={profile.shortDID} account={profile} />
            ))}
            {
              !searchPostResults.length ? undefined :
                searchPostResults.map(post => (
                  <PostCompletionLink key={post.uri} post={post} />
                ))
            }
            {
              searchProfileResults.complete && searchPostResults.complete ? undefined :
                <div className={
                  'landing-auto-completion-progress' +
                  (searchProfileResults.complete ? '' : ' landing-auto-completion-progress-profile') +
                  (searchPostResults.complete ? '' : ' landing-auto-completion-progress-post')}>
                </div>
            }
          </div>
      }
    </>
  );

  async function startSearchProfiles() {
    for await (const searchResults of db.searchProfilesIncrementally(searchText)) {
      if (timeout.searchText !== searchText) return;
      setSearchProfileResults(searchResults);
    }
    if (timeout.searchText === searchText) {
      setSearchProfileResults(r => {
        r = r.slice();
        r.complete = true;
        return r;
      });
    }
  }

  async function startSearchPosts() {
    setSearchPostResults([]);
    for await (const searchResults of db.searchPostsIncrementally(undefined, searchText)) {
      if (timeout.searchText !== searchText) return;
      const topMatches = [];
      const MAX_POST_MATCHES = 3;
      const MAX_SCORE = 0.81;
      for (const post of searchResults) {
        if (topMatches.length >= MAX_POST_MATCHES ||
          (post.score ?? MAX_SCORE + 1) > MAX_SCORE) break;
        topMatches.push(post);
      }
      setSearchPostResults(topMatches);
      console.log('post search ', searchText, topMatches, searchResults);
    }
    if (timeout.searchText === searchText) {
      setSearchPostResults(r => {
        r = r.slice();
        r.complete = true;
        return r;
      });
    }
  }
}

function AccountCompletionLink({ account }) {
  return (
    <Link
      to={`/${account.handle}`}
      className='landing-auto-complete-entry'>
      <AccountLabel account={account} Component='div' withDisplayName />
    </Link>
  );
}

/**
 * @param {{
 *  post: import('../../coldsky/lib').MatchCompactPost
 * }} _
 */
function PostCompletionLink({ post }) {
  const db = useDB();
  const profile = forAwait(post.shortDID, () => db.getProfileIncrementally(post.shortDID));
  const parsedURL = breakFeedUri(post.uri);
  return (
    <Link
      to={`/${profile?.handle || post.shortDID}/${parsedURL?.postID}`}
      className='landing-auto-complete-entry landing-auto-complete-entry-post'>
      <AccountLabel
        account={post.shortDID}
        Component='span' className='auto-complete-post-account' />
      <span className='post-entry-first-line'>
        {(post.text || '').trim().split('\n')[0]}
      </span>
    </Link>
  );
}

