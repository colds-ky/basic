// @ts-check

import { createUnicodeFormattedParser } from './create-unicode-formatter-parser';

/** @type {ReturnType<typeof createUnicodeFormattedParser>} */
let _parseRanges;

/** @type {ReturnType<typeof createUnicodeFormattedParser>} */
export function runParseRanges(text, options) {
  if (!_parseRanges)
    if (!_parseRanges) _parseRanges = createUnicodeFormattedParser();
  const parsed = _parseRanges(text, options);
  return parsed;
}
