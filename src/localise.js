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
 * @param {string} word
 * @param {number} num
 */
export function localiseNumberSuffix(word, num) {
  return localise(localiseNumberSuffixEnglish(word, num), {
    uk: localiseNumberSuffixUkrainian(word, num)
  });
}

/**
 * @param {string} word
 * @param {number} num
 */
function localiseNumberSuffixEnglish(word, num) {
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
 * @param {string} word
 * @param {number} num
 */
function localiseNumberSuffixUkrainian(word, num) {
  if (num % 10 === 1 && ! (num %100 === 11)) return word;
  if (ukWordPluralisations[word]) return ukWordPluralisations[word];
  if (word.endsWith('а') || word.endsWith('я')) return word.slice(0, -1) + 'і';
  return word + 'и';
}

const ukWordPluralisations = {
  'списку': 'списків',
};
