// @ts-check

const regex_escapeableRegexChars = /[#-.]|[[-^]|[?|{}]/g;

/** @param str {string} */
export function sanitizeForRegex(str) {
  const sanitized = str.replace(regex_escapeableRegexChars, '\\$&');
  return sanitized;
}
