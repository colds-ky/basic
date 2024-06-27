// @ts-check

const NOT_WORD_CHARACTERS_REGEX = /[^\w\p{L}\d]+/gu;

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
      const wordStart = stripToBasic(word.slice(0, 3).toLowerCase());



      if (!result) result = [wordStart];
      if (result.indexOf(wordStart) < 0) result.push(wordStart);
    }
  }

  return result;
}

const normMap = {
  'á': 'a',
  'é': 'e',
  'í': 'i',
  'ó': 'o',
  'ú': 'u',
  'ü': 'u',
  'ñ': 'n',
  'ç': 'c',
  'à': 'a',
  'è': 'e',
  'ì': 'i',
  'ị': 'i',
  'ò': 'o',
  'ù': 'u',
  'ṅ': 'n',
  'ọ': 'o',
  'ụ': 'u',
  'а': 'a',
  'б': 'b',
  'в': 'v',
  'г': 'g',
  'ґ': 'g',
  'д': 'd',
  'е': 'e',
  'є': 'ye',
  'ж': 'zh',
  'з': 'z',
  'и': 'y',
  'і': 'i',
  'ї': 'i',
  'й': 'j',
  'к': 'k',
  'л': 'l',
  'м': 'm',
  'н': 'n',
  'о': 'o',
  'п': 'p',
  'р': 'r',
  'с': 's',
  'т': 't',
  'у': 'u',
  'ф': 'f',
  'х': 'h',
  'ц': 'c',
  'ч': 'ch',
  'ш': 'sh',
  'щ': 'shch',
  'ь': 'y',
  'ю': 'yu',
  'я': 'ya'
};

function substitute(ch) {
  return normMap[ch] || ch;
}

function createSubstituteRegExp() {
  const keys = Object.keys(normMap);
  keys.sort((k1, k2) => k2.length - k1.length);
  return new RegExp(`[${keys.join('|')}]`, 'g');
}

var substituteRegExp;

function stripToBasic(text) {
  if (!substituteRegExp) substituteRegExp = createSubstituteRegExp();
  return text.replace(substituteRegExp, substitute);
}