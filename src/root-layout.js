// @ts-check

import React, { useState } from 'react';
import { useDerived } from './api/derive';
import { searchHandle } from './api';

import atproto from '@atproto/api';
import * as octokit from "octokit";

window['atproto'] = atproto;
window['octokit'] = octokit;


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
  const matches = useDerived(
    text,
    (text) => searchHandle(text),
    (error, text) => [{ shortDID: text, shortHandle: text, rank: 1, error }]);
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
                      const commandFn = window[commandText.slice(1)];
                      if (typeof commandFn === 'function')
                        commandFn();
                    }
                  }}
                  onChange={e => {
                    setText(e.target.value);
                  }}
                />
                {
                  !matches ? undefined :
                    matches.map((m, index) =>
                      <div key={index}>{m.shortHandle}</div>
                    )
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