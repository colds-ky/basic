// @ts-check

import React from 'react';

/**
 * @param {{
 *  text: string| null | undefined,
 *  className?: string,
 *  Component?: any,
 *  ParagraphComponent?: any,
 *  InlineComponent?: any,
 *  BreakComponent?: any,
 *  charClass?: (offset: number, wholeString: string, ch: string) => string | { toString(): string } | null | undefined
 * }} _
 */
export function PreFormatted({
  text,
  className,
  Component,
  ParagraphComponent,
  InlineComponent,
  BreakComponent,
  charClass }) {
  if (!text) return null;

  const UseComponent = Component || 'div';
  const UseParagraphComponent = ParagraphComponent || 'p';
  const UseInlineComponent = InlineComponent || 'span';
  const UseBreakComponent = BreakComponent || 'br';

  const codePoints = [...text];
  let spanStart = 0;
  /** @type {{ toString(): string }} */
  let spanClassName = '';
  let lineBreakCount = 0;
  let offset = 0;

  let paragraphs = [];
  let spans = [];

  for (let iCp = 0; iCp < codePoints.length; iCp++) {
    const cp = codePoints[iCp];

    if (NEWLINE_REGEX.test(cp)) {
      if (!lineBreakCount) {
        if (spanStart < offset) {
          let spanText = text.slice(spanStart, offset).replace('  ', '\u00A0 ');
          if (!paragraphs.length && !spans.length) spanText = spanText.trimStart();
          spans.push(
            <UseInlineComponent key={spans.length} className={spanClassName}>
              {spanText}
            </UseInlineComponent>);
        }
        if (spans.length) {
          paragraphs.push(
            <UseParagraphComponent key={paragraphs.length}>
              {spans}
            </UseParagraphComponent>);
          spans = [];
        }
      }

      offset += cp.length;
      spanStart = offset;

      lineBreakCount++;
    } else {
      while (lineBreakCount > 1) {
        lineBreakCount--;
        paragraphs.push(<UseBreakComponent key={paragraphs.length} />);
      }

      const currentClassName = typeof charClass === 'function' ? charClass(offset, text, cp) || '' : '';
      if (String(currentClassName) !== String(spanClassName)) {
        if (spanStart < offset) {
          let spanText = text.slice(spanStart, offset).replace('  ', '\u00A0 ');
          if (!paragraphs.length && !spans.length) spanText = spanText.trimStart();

          spans.push(
            <UseInlineComponent key={spans.length} className={spanClassName}>
              {spanText}
            </UseInlineComponent>);
        }

        spanStart = offset;
        spanClassName = currentClassName;
      }

      offset += cp.length;
    }
  }

  if (spanStart < offset) {
    let spanText = text.slice(spanStart, offset).replace('  ', '\u00A0 ');
    if (!paragraphs.length && !spans.length) spanText = spanText.trimStart();

    spans.push(
      <UseInlineComponent key={spans.length} className={spanClassName}>
        {spanText}
      </UseInlineComponent>);
  }

  if (spans.length) {
    paragraphs.push(
      <UseParagraphComponent key={paragraphs.length}>
        {spans}
      </UseParagraphComponent>);
  }

  return (
    <UseComponent className={className}>
      {paragraphs}
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