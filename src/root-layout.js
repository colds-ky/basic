// @ts-check

import React from 'react';
import atproto from '@atproto/api';
import * as octokit from "octokit";

import * as wholeAPI from './api';
import * as maintain from './maintain';
import { AutocompleteInput } from './autocomplete-input';
import { MaintainPanel } from './maintain/ui';

if (typeof window !== 'undefined') {
  window['atproto'] = atproto;
  window['octokit'] = octokit;
  window['coldsky'] = wholeAPI;
  Object.assign(window['coldsky'], maintain);
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
  inputPlaceholderText }) {
  
  const [showUpdateDIDs, setShowUpdateDIDs] = React.useState(false);

  return (
    <table className="top-table">
      <tbody>
        <tr>
          <td valign="middle" className="td-main">
            <div className="div-outer">
              <div className="div-inner">
                <h1 className="title">{title ?? 'Cold Sky'}</h1>
                <div className="subtitle">{subtitle ?? 'social media up there'}</div>
                <AutocompleteInput
                  inputClassName={inputClassName}
                  inputPlaceholderText={inputPlaceholderText}
                  executeCommand={executeCommand} />
                {
                  !showUpdateDIDs ? undefined :
                    <MaintainPanel />
                }
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );


  async function executeCommand(commandName) {
    if (commandName === 'updateDIDs') {
      setShowUpdateDIDs(true);
      return;
    }
  
    const command = window['coldsky'][commandName];
    let result = await /** @type {*} */(command)();

    alert(
      typeof result === 'undefined' ? commandName + ' OK' :
        commandName + ' ' + JSON.stringify(result, null, 2)
    );
  }
}
