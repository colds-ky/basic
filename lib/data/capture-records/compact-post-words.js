// @ts-check

const NOT_WORD_CHARACTERS_REGEX = /[^\w\d]+/g;

/**
 * @param {string} text
 */
export function breakIntoWords(text) {
  const words = text.split(NOT_WORD_CHARACTERS_REGEX);
  const result = [];
  for (const word of words) {
    if (word.length >= 3 && word !== text) {
      if (result.indexOf(word) < 0) result.push(word);
    }
  }
  return result;
}

/**
 * @param {string | null | undefined} text
 * @param {string[] | undefined} result
 */
export function detectWordStartsNormalized(text, result) {
  if (!text) return result;
  const words = text.split(NOT_WORD_CHARACTERS_REGEX);
  for (const word of words) {
    if (word.length >= 3) {
      // TODO: normalize - remove accent marks etc.
      const wordStart = word.slice(0, 3).toLowerCase();
      if (!result) result = [wordStart];
      if (result.indexOf(wordStart) < 0) result.push(wordStart);
    }
  }

  return result;
}
