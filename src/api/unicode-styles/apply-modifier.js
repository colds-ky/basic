// @ts-check

import { runParseRanges } from './run-parse-ranges';
import { variants } from './variants';

/**
* @param {string} input
* @param {string | keyof variants} modifier
* @param {boolean=} remove
**/
export function applyModifier(input, modifier, remove) {
  const parsed = runParseRanges(input, { disableCoalescing: true });
  let text = '';

  for (const range of parsed) {
    if (typeof range === 'string') {
      if (remove) {
        text += range;
      } else {
        const rangeMap = variants[modifier];
        if (!rangeMap && modifier !== 'underlined') {
          // strange modifier???
          text += range;
        } else {
          // range is an ASCII string, iterate for each character
          for (const ch of range) {
            const formattedCh = applyModifierToPlainCh(ch, [modifier]);
            text += formattedCh;
          }
        }
      }
    } else {
      /** @type {string} */
      let applyFullModifiers;
      if (remove) {
        if (range.modifiers.indexOf(modifier) < 0) {
          // formatted, but not with this modifier — not removing anything
          text += range.formatted;
          continue;
        } else if (range.modifiers.length === 1) {
          // last modifier to be removed, simply reduce back to ASCII unformatted
          text += range.plain;
          continue;
        } else {
          applyFullModifiers = range.modifiers.filter(function (mod) { return mod !== modifier; }).join('');
        }
      } else {
        applyFullModifiers = range.modifiers.indexOf(modifier) < 0 ?
          range.modifiers.concat([modifier]).sort().join('') :
          range.fullModifiers;
      }

      const formattedCh = applyModifierToPlainCh(
        range.plain,
        applyFullModifiers === modifier ? [modifier] : [applyFullModifiers, modifier]);
      text += formattedCh;
    }
  }

  return text;
}

const regex_underlined = /underlined/g;

/**
 * @param plainCh {string}
 * @param modifierAndFallbacks {string[]}
 **/
export function applyModifierToPlainCh(plainCh, modifierAndFallbacks) {
  // underlined is handled separately
  if (modifierAndFallbacks.length === 1 && modifierAndFallbacks[0] === 'underlined') return plainCh + '\u0332';

  for (let mod of modifierAndFallbacks) {
    // again, underlined is handled separately
    const underlined = regex_underlined.test(mod);
    if (underlined) mod = mod.replace(regex_underlined, '');
    if (!mod && underlined) {
      return plainCh + '\u0332';
    }

    const rangeMap = variants[mod];
    if (!rangeMap) continue;

    const formattedRange = rangeMap[plainCh];
    if (formattedRange) return formattedRange;

    for (const asciiRange in rangeMap) {
      const formattedRange = rangeMap[asciiRange];
      if (typeof formattedRange === 'string' && plainCh.charCodeAt(0) >= asciiRange.charCodeAt(0) && plainCh.charCodeAt(0) <= asciiRange.charCodeAt(1)) {
        // found respective range in modifier entry, pick corresponding formatted character
        const formattedIndex = plainCh.charCodeAt(0) - asciiRange.charCodeAt(0);
        const formattedUnit = formattedRange.length / (asciiRange.charCodeAt(1) - asciiRange.charCodeAt(0) + 1);
        let formattedChar = formattedRange.slice(formattedIndex * formattedUnit, (formattedIndex + 1) * formattedUnit);
        if (underlined) formattedChar += '\u0332';
        return formattedChar;
      }
    }
  }

  return plainCh;
}
