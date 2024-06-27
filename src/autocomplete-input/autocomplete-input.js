// @ts-check

import React, { useEffect, useState } from 'react';

import { forAwait } from '../api/forAwait';
import { searchHandle, unwrapShortHandle } from '../api';

import './autocomplete-input.css';

export function AutocompleteInput({
  inputClassName,
  inputPlaceholderText,
  executeCommand}) {
  const [text, setText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [withTimeout] = useState(/** @type {{ timeout: ReturnType<typeof setTimeout> }} */({})); 
  useEffect(() => {
    return () => {
      clearTimeout(withTimeout.timeout);
    }
  }, [withTimeout]);

  const matches = forAwait(
    searchText,
    async (text) => ({ result: await searchHandle(text) }),
    (error, text) => ({ result: [{ shortDID: text, shortHandle: text, rank: 1, error }] }))?.result || [];

  return (
    <>
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
          clearTimeout(withTimeout.timeout);
          withTimeout.timeout = setTimeout(() => {
            setSearchText(e.target.value);
          }, 400);
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
    </>
  );
}