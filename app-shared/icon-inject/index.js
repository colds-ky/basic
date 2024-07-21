// @ts-check

import { getGlobalCachedStore } from '../../app';
import { localise } from '../localise';

import { overlayAvatar } from './overlay-avatar';
import { replaceIcon } from './replace-icon';

/**
 * @type {Parameters<typeof setGlobalAppView>[0]}
 */
var currentView;

export const uppercase_TITLE = localise('𝓒𝒐𝓵𝓭 𝓢𝓴𝔂', { uk: '𝓷𝓮𝓹𝓮𝓬𝔂𝓰' });

/**
 * @param {{ account: string } | 'coldsky' | undefined} view
 */
export function setGlobalAppView(view) {
  if (currentView === view) return;
  currentView = view;

  if (view === 'coldsky') {
    document.documentElement.classList.remove('account');
    document.documentElement.classList.add('coldsky');
    document.title = 'ColdSky';
    replaceIcon(null);
  } else if (view?.account) {
    document.documentElement.classList.add('account');
    document.documentElement.classList.remove('coldsky');

    (async () => {
      const db = getGlobalCachedStore();
      let appliedAvatar = '';
      for await (const profile of db.getProfileIncrementally(view.account)) {
        if (/** @type {*} */(currentView)?.account !== view.account) return;

        if (profile.avatar && profile.avatar !== appliedAvatar) {
          appliedAvatar = profile.avatar;
          const avatarIcon = await overlayAvatar(profile.avatar).catch(() => { });
          if (/** @type {*} */(currentView)?.account !== view.account) return;
          replaceIcon(avatarIcon || null);
          return;
        }
      }

      replaceIcon(null);
    })();

  } else {
    document.documentElement.classList.remove('account');
    document.documentElement.classList.remove('coldsky');
    document.title = uppercase_TITLE;
    replaceIcon(null);
  }
}