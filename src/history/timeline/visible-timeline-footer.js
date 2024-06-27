// @ts-check

import SettingsIcon from '@mui/icons-material/Settings';
import React from 'react';

import { localise, localiseNumberSuffixEnglish, localiseNumberSuffixUkrainian } from '../../localise';

/**
 * @param {{
 *  cachedOnly?: boolean,
 *  complete?: boolean,
 *  searchQuery?: any,
 *  filteredCount?: number,
 *  processedAllCount?: number,
 *  next?: () => void
 * }} _
 */
export function VisibleTimelineFooter({
  cachedOnly,
  complete,
  searchQuery,
  filteredCount,
  processedAllCount,
  next }) {
  let footerText = '';
  let footerClass = 'bottom-more';

  if (complete) {
    if (searchQuery) {
      footerText =
        !processedAllCount ? localise('No posts ever.', { uk: 'Нема жодного контенту.' }) :
          !filteredCount ? localise(
            'Nothing matches across ' + processedAllCount.toLocaleString() + '.',
            { uk: 'Нічого не підходить поміж ' + processedAllCount.toLocaleString() + '.' }) :
            localise(
              filteredCount.toLocaleString() + ' found out of ' + processedAllCount.toLocaleString() + '.',
              { uk: filteredCount.toLocaleString() + ' знайдено з ' + processedAllCount.toLocaleString() + '.' });
      footerClass = 'timeline-footer timeline-footer-search timeline-footer-search-complete';
    } else {
      footerText =
        !processedAllCount ? localise('No posts ever.', { uk: 'Нема жодного контенту.' }) :
          localise(
            processedAllCount.toLocaleString() + localiseNumberSuffixEnglish(processedAllCount, ' tweet') + '. Timeline end.',
            { uk: processedAllCount.toLocaleString() + localiseNumberSuffixUkrainian(processedAllCount, { 1: ' твіт', 2: ' твіта', 5: ' твітів' }) + '. Край стрічки.' });
      footerClass = 'timeline-footer timeline-footer-complete';
    }
  }
  else if (searchQuery) {
    if (cachedOnly) {
      footerText =
        !processedAllCount ? localise('Searchштп for tweets...', { uk: 'Пошук твітів...' }) :
          !filteredCount ? localise(
            'Searching for tweets (' + processedAllCount.toLocaleString() + ' processed)...',
            { uk: 'Пошук твітів (' + processedAllCount.toLocaleString() + ' переглянуто)...' }) :
            localise(
              'Searching for tweets: ' + filteredCount.toLocaleString() + ' found out of ' + processedAllCount.toLocaleString() + '...',
              { uk: 'Пошук твітів: ' + filteredCount.toLocaleString() + ' знайдено поміж ' + processedAllCount.toLocaleString() + '...' }
            );
      footerClass = 'timeline-footer timeline-footer-search timeline-footer-search-cached';
    } else {
      footerText =
        !processedAllCount ? localise('Searching...', { uk: 'Пошук...' }) :
          !filteredCount ? localise(
            'Searching (' + processedAllCount.toLocaleString() + ' processed)...',
            { uk: 'Пошук (' + processedAllCount.toLocaleString() + ' переглянуто)...' }) :
            localise(
              'Searching: ' + filteredCount.toLocaleString() + ' found out of ' + processedAllCount.toLocaleString() + '...',
              { uk: 'Пошук: ' + filteredCount.toLocaleString() + ' знайдено поміж ' + processedAllCount.toLocaleString() + '...' }
            );
      footerClass = 'timeline-footer timeline-footer-search';
    }
  } else {
    if (cachedOnly) {
      footerText = localise('Loading...', { uk: 'Завантаження...' });
      footerClass = 'timeline-footer timeline-footer-cached';
    } else {
      footerText = localise('Loading more...', { uk: 'Ще...' });
      footerClass = 'timeline-footer';
    }
  }

  return (
    <div className={footerClass}>
      <button className='footer-button' onClick={() => {
        next?.();
      }}>
        {
          <SettingsIcon className='footer-cog-icon' />
        }
        {
          footerText
        }
      </button>
    </div>
  );
}