// @ts-check

/**
 * @param {string} english
 * @param {{ [lang: string]: string}} languageMap
 */
export function localise(english, languageMap) {
  if (!langs?.length) return english;

  for (const lang of langs) {
    if (languageMap[lang]) return languageMap[lang];
  }

  for (const lang of langs) {
    if (languageMap[lang]) return languageMap[lang];
  }

  return english;
}

const langSubstitutes = {
  ru: 'uk', be: 'uk'
}

const langs = extendDashLeads(
  !navigator ? undefined :
    navigator.languages?.length ? navigator.languages.map(lang => lang.toLowerCase()) :
      navigator.language ? [navigator.language.toLowerCase()] :
        undefined);

function extendDashLeads(langs) {
  if (!langs) return langs;

  const result = [];
  for (const lang of langs) {
    result.push(langSubstitutes[lang] || lang);
  }

  for (const lang of langs) {
    const dashLead = lang.split('-')[0];
    if (dashLead !== lang) result.push(langSubstitutes[dashLead] || dashLead);
  }

  return result;
}


/**
 * @param {number} num
 * @param {string} word
 */
export function localiseNumberSuffixEnglish(num, word) {
  if (num === 1) return word;
  if (enWordPluralisations[word]) return enWordPluralisations[word];
  if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
  if (word.endsWith('s') || word.endsWith('x')) return word + 'es';
  return word + 's';
}

const enWordPluralisations = {
  fish: 'fish',
  sheep: 'sheep',
  child: 'children'
};

/**
 * @param {number} num
 * @param {{ 1: string, 2: string, 5: string }} wordForms
 */
export function localiseNumberSuffixUkrainian(num, wordForms) {
  if (num % 10 === 1 && !(num % 100 === 11)) return wordForms[1];
  if (num % 10 >= 2 && num % 10 <= 4 && !(num % 100 >= 12 && num % 100 <= 14)) return wordForms[2];
  return wordForms[5];
}
