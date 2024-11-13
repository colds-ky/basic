// @ts-check

import React from "react";

import { forAwait } from '../app-shared/forAwait';
import { streamEvery } from '../package/akpa';
import AtpAgent from '@atproto/api';
import { BSKY_SOCIAL_URL } from '../package';

export function Bot() {
  return 'bot';
}

export function BotMore() {
  const Render = forAwait(undefined, proceed)
  return Render ? <Render /> : 'Loading...';
}

async function* proceed() {
  let onCredentials;
  const confirmCredentials = new Promise(resolve => onCredentials = resolve);

  yield () => <CredentialsDialog onConfirmed={onCredentials} />;

  const { atClient, username, token } = await onCredentials;

  // TODO: cache username/token

  yield () => (
    <div>
      <h1>Bot {username}</h1>
      <p>Retrieving the latest stop...</p>
    </div>
  );

  // TODO: fetch the last stop

  yield () => (
    <div>
      <h1>Bot {username}</h1>
      <p>Retrieved the last stop.</p>
      <p>Searching for keywords...</p>
    </div>
  );

  // TODO: search for keywords
  // (while )

  yield () => {

  };
  

}

function searchAndAct() {
  return streamEvery(async streaming => {
    // TODO: pump search results page by page
    // TODO: for any interesting matches, queue actions
    // TODO: regularly report results: found interesting tweets, actions...
  });
}

/**
 * @param {{
 *  onConfirmed: (credentials: { atClient: import('@atproto/api').AtpAgent, username: string, token: string }) => void
 * }} _
 */
function CredentialsDialog({ onConfirmed }) {
  const [usernamePasswordToken, setUsernamePasswordToken] = React.useState(
    /** @type {{ username: string, password: string, token: string | undefined } | undefined} */
    (undefined));
  
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState(undefined);

  return (
    <div className='credentials-dialog'>
      <span className='credentials-dialog-prompt'>&gt;</span>

      <input
        type="text"
        id="username" name="username"
        autoComplete="username"
        value={usernamePasswordToken?.username || ''}
        onChange={e => {
          const value = e.target.value;
          setUsernamePasswordToken({ username: value, password: usernamePasswordToken?.password || '', token: undefined });
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (usernamePasswordToken?.username.trim()) {
              const password = /** @type {HTMLInputElement} */(document.getElementById('password'));
              password?.focus();
              password?.select();
            }
          }
        }}
      />

      <input
        type="password"
        id="password" name="password"
        autoComplete="current-password"
        value={usernamePasswordToken?.password || ''}
        onChange={e => {
          const value = e.target.value;
          setUsernamePasswordToken({ username: usernamePasswordToken?.username || '', password: value, token: undefined });
        }}
      />

      <button
        onClick={() => {

        }}>
        Login
      </button>
    </div>
  );

  async function onTryLogin() {
    if (!usernamePasswordToken) return;

    setIsLoggingIn(true);
    try {
      // onConfirmed({ atClient, username, token });
    } catch (error) {
      setLoginError(error);
    } finally {
      setIsLoggingIn(false);
    }
  }
}

async function tryLoginCore({ username, password, token }) {
  const atClient = new AtpAgent({
    service: BSKY_SOCIAL_URL,
    persistSession: (e, sessionData) => {
      // save token?
    }
  });
  if (token) {
    await atClient.resumeSession(JSON.parse(token));
  } else {
    await atClient.login(
      {
      identifier: username,
      password: password,
    })
  }

}