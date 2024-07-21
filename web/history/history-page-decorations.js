// @ts-check

import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { applyModifier } from '../api/unicode-styles/apply-modifier';
import { uppercase_TITLE } from '../icon-inject';
import { breakHandleParts } from '../widgets/account/full-handle';

const middledot = '\u00B7';

/**
 * @param {{ children?: import('react').ReactNode }} _
 */
export function HistoryPageDecorations({ children }) {
  let { handle } = useParams();

  useEffect(() => {
    document.documentElement.classList.add('account');

    if (!handle) {
      document.title = uppercase_TITLE;
    } else {
      const { mainText, tldSuffix, bskySocialSuffix, didPrefix, didBody } = breakHandleParts(handle);

      let title;
      if (didBody) {
        title = applyModifier(didPrefix || '', 'typewriter') + applyModifier(didBody, 'bold');
      } else {
        title =
          applyModifier(mainText.replace(/\./g, middledot), 'boldcursive') +
          (
            tldSuffix ? applyModifier(
              tldSuffix.replace(/^\./, ' ' + middledot + ' ').replace(/\./g, middledot),
              'cursive') : ''
          ) +
          (
            bskySocialSuffix ? applyModifier(
              bskySocialSuffix.replace(/^\./, ' ' + middledot + ' ').replace(/\./g, middledot),
              'super') : ''
          );
      }

      document.title = title;
    }
  });

  return children;
}