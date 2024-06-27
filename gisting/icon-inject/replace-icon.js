// @ts-check

/**
 * @param {string | null | undefined} icon
 */
export function replaceIcon(icon) {
  const allLinks = [...document.getElementsByTagName('link')];
  for (const lnk of allLinks) {
    if (/icon/i.test(lnk.rel || '')) {
      lnk.href = icon || 'gist-icon.png';
    }
  }
}