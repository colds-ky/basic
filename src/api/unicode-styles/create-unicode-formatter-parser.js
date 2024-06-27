// @ts-check

import { sanitizeForRegex } from './sanitize-for-regex';
import { variants } from './variants';

export function createUnicodeFormattedParser() {

  /** @typedef {{ formatted: string, plain: string, modifiers: string[], fullModifiers: string }} LookupEntry */

  /** @type {{ [formatted: string]: (LookupEntry & {underlinedModifiers: string[], underlinedFullModifiers: string}) }} */
  var lookup = {};

  /** @type {RegExp} */
  var formattedRegex;

  var regex_underlinedChar = /[^\r\n]\u0332/g;

  function buildLookups() {
    /** @type {LookupEntry[]} */
    var lookupList = [];

    for (var modKind in variants) {
      var rangeMap = variants[modKind];
      if (!rangeMap || typeof rangeMap !== 'object') continue;

      var modifiers = modKind === 'bold' || modKind.indexOf('bold') ? [modKind] : ['bold', modKind.slice(4)];
      var underlinedModifiers = modifiers.concat(['underlined']);
      var underlinedFullModifiers = modKind + 'underlined';

      for (var rangeDesc in rangeMap) {
        var rangeChars = rangeMap[rangeDesc];
        if (!rangeChars || typeof rangeChars !== 'string') continue;

        var rangeCount = rangeDesc.length === 1 ? 1 : rangeDesc.charCodeAt(1) - rangeDesc.charCodeAt(0) + 1;
        var formattedWidth = rangeChars.length / rangeCount;
        for (var i = 0; i < rangeCount; i++) {
          var ascii = String.fromCharCode(rangeDesc.charCodeAt(0) + i);
          var rangeCh = rangeChars.slice(i * formattedWidth, (i + 1) * formattedWidth);
          var entry = {
            formatted: rangeCh,
            plain: ascii,
            modifiers: modifiers,
            underlinedModifiers: underlinedModifiers,
            fullModifiers: modKind,
            underlinedFullModifiers: underlinedFullModifiers
          };
          lookupList.push(entry);
          lookup[entry.formatted] = entry;
        }
      }
    }

    lookupList.sort(function (entry1, entry2) {
      return -(entry1.formatted.length - entry2.formatted.length);
    });

    formattedRegex = new RegExp(lookupList.map(function (entry) {
      var sanitizedEntry = sanitizeForRegex(entry.formatted);
      var underlineEntry = sanitizedEntry + '\u0332';
      return underlineEntry + '|' + sanitizedEntry;
    }).join('|'), 'g');
  }

  /** @typedef {(string | (LookupEntry & { length: number }))[] & { modifiers: string[], fullModifiers: string }} ParsedList */

  /**
   * @param {string} text
   * @param {{ disableCoalescing?: boolean }=} options
   **/
  function parser(text, options) {

    /**
     * @param start {number}
     * @param end {number}
     **/
    function addUnderlinedsAndPlainTextBetween(start, end) {
      while (start < end) {
        regex_underlinedChar.lastIndex = start;
        var matchUnderlined = regex_underlinedChar.exec(text);
        if (!matchUnderlined || matchUnderlined.index >= end) {
          addFormattedToResult(text.slice(start, end));
          break;
        }

        if (matchUnderlined.index > start) addFormattedToResult(text.slice(start, matchUnderlined.index));

        var underlinedText = matchUnderlined[0];
        var plain = underlinedText.slice(0, underlinedText.length - 1);

        var added = false;
        if (!disableCoalescing) {
          var prevEntry = result.length && result[result.length - 1];
          if (prevEntry && typeof prevEntry !== 'string' && prevEntry.fullModifiers === 'underlined') {
            added = true;
            prevEntry.formatted += underlinedText;
            prevEntry.plain += plain;
            prevEntry.length += underlinedText.length;
          }
        }

        if (!added) {
          addFormattedToResult({
            formatted: underlinedText,
            plain: plain,
            modifiers: ['underlined'],
            fullModifiers: 'underlined',
            length: underlinedText.length
          });
        }

        if (result.modifiers.indexOf('underlined') < 0) result.modifiers.push('underlined');

        start = matchUnderlined.index + underlinedText.length;
      }
    }

    var regex_formattableCharacters = /[a-z0-9]/;

    /** @param {typeof result[0]} entry */
    function addFormattedToResult(entry) {
      var prev = result.length && result[result.length - 1];

      if (!disableCoalescing) {
        if (typeof entry === 'string') {
          if (typeof prev === 'string') {
            result[result.length - 1] = prev + entry;
            return;
          }
        } else if (prev) {
          if (typeof prev === 'string') {
            var nextPrev = result.length > 1 && result[result.length - 2];
            if (nextPrev && typeof nextPrev !== 'string' &&
              nextPrev.fullModifiers === entry.fullModifiers &&
              !regex_formattableCharacters.test(prev) && prev.indexOf('\n') < 0) {
              nextPrev.formatted += prev + entry.formatted;
              nextPrev.plain += prev + entry.plain;
              nextPrev.length += prev.length + entry.length;
              result.pop(); // plain text in the middle eliminated
              return;
            }
          }
          else if (prev.fullModifiers === entry.fullModifiers) {
            prev.formatted += entry.formatted;
            prev.plain += entry.plain;
            prev.length += entry.length;
            return;
          }
        }
      }

      if (typeof entry !== 'string' && (!prev || typeof prev === 'string' || prev.fullModifiers !== entry.fullModifiers))
        for (var i = 0; i < entry.modifiers.length; i++) {
          var mod = entry.modifiers[i];
          if (!modifierDict[mod]) {
            modifierDict[mod] = true;
            result.modifiers.push(mod);
          }
        }

      result.push(entry);
    }

    /** @type {ParsedList} */
    var result = /** @type{*} */([]);
    result.modifiers = [];
    result.fullModifiers = '';
    if (!text) return result;

    var disableCoalescing = options && options.disableCoalescing;

    var modifierDict = {};

    formattedRegex.lastIndex = 0;
    var index = 0;
    while (true) {
      formattedRegex.lastIndex = index;
      var match = formattedRegex.exec(text);
      if (!match) break;

      if (match.index > index) {
        addUnderlinedsAndPlainTextBetween(index, match.index);
        // result.push(text.slice(index, match.index));
      }

      var underlined = false;

      var entryKey = match[0];
      if (entryKey.charCodeAt(entryKey.length - 1) === ('\u0332').charCodeAt(0)) {
        entryKey = entryKey.slice(0, entryKey.length - 1);
        underlined = true;
      }

      var entry = lookup[entryKey];
      var prev = result.length && result[result.length - 1];

      var modifiers = !underlined ? entry.modifiers : entry.underlinedModifiers;
      var fullModifiers = !underlined ? entry.fullModifiers : entry.underlinedFullModifiers;

      addFormattedToResult({
        formatted: match[0],
        plain: entry.plain,
        modifiers: modifiers,
        fullModifiers: fullModifiers,
        length: match[0].length
      });

      index = match.index + match[0].length;
    }

    if (index < text.length) {
      addUnderlinedsAndPlainTextBetween(index, text.length);
    }

    result.modifiers.sort();
    result.fullModifiers = result.modifiers.join('');

    return result;
  }

  buildLookups();

  return parser;
}