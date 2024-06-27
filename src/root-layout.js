// @ts-check

import React, { useState } from 'react';
import { forAwait } from './api/forAwait';
import { isPromise, searchHandle, unwrapShortHandle } from './api';
import * as wholeAPI from './api';

import atproto from '@atproto/api';
import * as octokit from "octokit";

import './root-layout.css';

window['atproto'] = atproto;
window['octokit'] = octokit;
window['require'] = /** @type {*} */(emulateRequire);

function emulateRequire(moduleName) {
  switch (moduleName) {
    case '@atproto/api': return atproto;
    case 'octokit': return octokit;
    case '../api': return wholeAPI;
  }
}


/**
 * @param {{
 *  title?: string,
 *  subtitle?: string,
 *  inputClassName?: string,
 *  inputPlaceholderText?: string,
 *  autocompleteArea?: React.ReactNode
 * }} _
 */
export function RootLayout({
  title,
  subtitle,
  inputClassName,
  inputPlaceholderText,
  autocompleteArea }) {
  const [text, setText] = useState('');

  const matches = forAwait(
    text,
    async (text) => ({ result: await searchHandle(text) }),
    (error, text) => ({ result: [{ shortDID: text, shortHandle: text, rank: 1, error }] }))?.result || [];

  return (
    <table className="top-table">
      <tbody>
        <tr>
          <td valign="middle" className="td-main">
            <div className="div-outer">
              <div className="div-inner">
                <h1 className="title">{title ?? 'Cold Sky'}</h1>
                <div className="subtitle">{subtitle ?? 'social media up there'}</div>
                <input id="searchINPUT" className={inputClassName}
                  autoComplete="off"
                  placeholder={inputPlaceholderText ?? 'Demo search text'}
                  value={text}
                  onKeyDown={e => {
                    if (e.keyCode !== 13) return;
                    e.preventDefault();
                    const commandText = (text || '').trim();
                    if (commandText.lastIndexOf('/', 0) === 0) {
                      executeCommand(commandText.slice(1));
                    }
                  }}
                  onChange={e => {
                    setText(e.target.value);
                  }}
                />
                {
                  !matches?.length ? undefined :
                    <div className='autocomplete-list'>
                      {
                        matches.map((m, index) =>
                          <div key={index} className='autocomplete-entry'>
                            {
                              unwrapShortHandle(m.shortHandle)
                            }
                            {
                              m.postID ? <span className='autocomplete-post'>post#{m.postID}</span> : undefined
                            }
                          </div>
                        )
                      }
                    </div>
                }
                {autocompleteArea}
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

async function executeCommand(commandName) {
  const commandJS = await fetch('./src/maintain/' + commandName + '.js').then(r => r.text());
  let result = eval(commandJS);
  if (typeof window[commandName] === 'function')
    result = /** @type {*} */(window)[commandName]();
  if (isPromise(result))
    result = await result;

  alert(
    typeof result === 'undefined' ? commandName + ' OK' :
      commandName + ' ' + JSON.stringify(result, null, 2)
  );
}
