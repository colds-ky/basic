// @ts-check

import { applyModifier } from './apply-modifier';
import { runParseRanges } from './run-parse-ranges';

/**
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @returns {{
 *  text: string;
 *  start: number;
 *  end: number;
 *  parsed: ReturnType<typeof runParseRanges>;
 * } | undefined};
 */
export function getModifiersTextSection(text, start, end) {
  var modText = text;
  if (start !== end) {
    modText = modText.slice(start, end);
    return { text: modText, start: start, end: end, parsed: runParseRanges(modText, void 0) };
  }

  var consequentMatch = /\S+\s*$/.exec(text.slice(0, start));
  var consequentEntryStart = start - (consequentMatch ? consequentMatch[0].length : 0);

  if (!consequentMatch || !consequentMatch[0]) {
    // if cannot find consequent BEFORE, try consequent AFTER
    consequentMatch = /^\s*\S+/.exec(text.slice(start));
    if (!consequentMatch) return { text: '', start: start, end: start, parsed: runParseRanges('', void 0) };
    var parsed = runParseRanges(consequentMatch[0], void 0);
    var consequentEntry = parsed[0];
  } else {
    var parsed = runParseRanges(consequentMatch[0], void 0);
    var consequentEntry = parsed[parsed.length - 1];
  }

  if (!parsed.length) return { text: '', start: start, end: start, parsed: parsed };

  // pick previous if this is punctuation or whitespace after formatted word
  if (typeof consequentEntry === 'string' && parsed && parsed.length > 1) {
    var prevConsequentEntry = parsed[parsed.length - 2];
    if (consequentEntry.indexOf('\n') < 0 &&
      typeof prevConsequentEntry !== 'string' &&
      consequentEntry == applyModifier(consequentEntry, prevConsequentEntry.fullModifiers)) {
      consequentEntry = prevConsequentEntry;
    }
  }


  if (consequentMatch && consequentMatch[0]) {
    if (consequentEntry) {
      parsed.length = 1;
      parsed.modifiers = typeof consequentEntry === 'string' ? [] : consequentEntry.modifiers;
      parsed.fullModifiers = typeof consequentEntry === 'string' ? '' : consequentEntry.fullModifiers;
      parsed[0] = consequentEntry;
    } else {
      parsed.length = 0;
      parsed.modifiers = [];
      parsed.fullModifiers = '';
    }

    return {
      text: typeof consequentEntry === 'string' ? consequentEntry : consequentEntry.formatted,
      start: consequentEntryStart,
      end: consequentEntryStart + consequentEntry.length,
      parsed: parsed
    };
  }

  return { text: '', start: start, end: start, parsed: runParseRanges('', void 0) };
}