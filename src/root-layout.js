// @ts-check

import React from 'react';

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
                  placeholder={inputPlaceholderText ?? 'Demo search text'} />
                {autocompleteArea}
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}