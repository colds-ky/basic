// @ts-check

import React from 'react';

/**
 * @param {{
 *  text: string| null | undefined,
 *  className?: string,
 *  Component?: any,
 *  ParagraphComponent?: any,
 *  BreakComponent?: any,
 *  charClass?: (offset: number, wholeString: string, ch: string) => string | null | undefined
 * }} _
 */
export function PreFormatted({ text, className, Component, ParagraphComponent, BreakComponent, charClass}) {
  if (!text) return null;

  const UseComponent = Component || 'div';
  const UseParagraphComponent = ParagraphComponent || 'p';
  const UseBreakComponent = BreakComponent || 'br';

  const entries = [];
  const codePoints = [...text];
  let spanStart = 0;
  /** @type {string} */
  let spanClassName = '';
  let offset = 0;
  /** @type {string[] | undefined} */
  let trailingBreaks;
  for (let iCp = 0; iCp < codePoints.length; iCp++) {
    const cp = codePoints[iCp];

    if (NEWLINE_REGEX.test(cp)) {
      if (trailingBreaks) trailingBreaks.push(cp);
      else {
        if (spanStart < offset) {
          entries.push(
            <UseParagraphComponent key={entries.length} className={spanClassName}>
              {text.slice(spanStart, offset).replace('  ', '\u00A0 ')}
            </UseParagraphComponent>);
        }
        trailingBreaks = [cp];
      }
      spanStart = offset;
    } else if (trailingBreaks?.length) {
      appendLineBreak(trailingBreaks, entries, UseBreakComponent);
      spanStart = offset;
      spanClassName = typeof charClass === 'function' ? charClass(offset, text, cp) || '' : '';
    } else {
      trailingBreaks = undefined;
      const currentClassName = typeof charClass === 'function' ? charClass(offset, text, cp) || '' : '';
      if (currentClassName !== spanClassName) {
        if (spanStart < offset) {
          entries.push(
            <UseParagraphComponent key={entries.length} className={spanClassName}>
              {text.slice(spanStart, offset).replace('  ', '\u00A0 ')}
            </UseParagraphComponent>);
        }
        spanStart = offset;
        spanClassName = currentClassName;
      }
    }

    offset += cp.length;
  }

  if (trailingBreaks?.length) {
    appendLineBreak(trailingBreaks, entries, UseBreakComponent);
  } else if (spanStart < offset) {
    if (spanStart < text.length) {
      entries.push(
        <UseParagraphComponent key={entries.length} className={spanClassName}>
          {text.slice(spanStart).replace('  ', '\u00A0 ')}
        </UseParagraphComponent>);
    }
  }

  return (
    <UseComponent className={className}>
      {entries}
    </UseComponent>
  );
}

const NEWLINE_REGEX = /\n|\r/g;

/**
 * @param {string[]} trailingBreaks
 * @param {JSX.Element[]} entries
 * @param {any} BreakComponent
 */
function appendLineBreak(trailingBreaks, entries, BreakComponent) {
  trailingBreaks.shift();
  while (true) {
    const breakCodePoint = trailingBreaks.shift();
    if (!breakCodePoint) break;
    entries.push(
      <BreakComponent key={entries.length}>
        {breakCodePoint}
      </BreakComponent>);
  }
}