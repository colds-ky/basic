// @ts-check

import { shortenDID, shortenHandle, shortenPDC } from '../shorten';
import { detectWordStartsNormalized } from './capture-records/compact-post-words';
import { createRepoData } from './repo-data';

/**
 * @param {(import('./define-store').PLCDirectoryEntry | import('./define-store').PlcDirectoryAuditLogEntry)[]} recs
 * @param {Map<string, import('./store-data').RepositoryData>} store
 * @param {import('./define-store').Intercepts} [intercepts]
 */
export function capturePLCDirectoryEntriesForStore(recs, store, intercepts) {
  /** @type {Map<string, typeof recs>} */
  const affectedRepos = new Map();
  for (const rec of recs) {
    const shortDID = shortenDID(rec.did);
    const existing = affectedRepos.get(shortDID);
    if (existing) existing.push(rec);
    else affectedRepos.set(shortDID, [rec]);
  }

  const updatedRepos = [];

  for (const [shortDID, recs] of affectedRepos) {
    const repoData = store.get(shortDID);
    const history = recs.map(entry => {
      const pds = shortenPDC(
        entry.operation.services?.atproto_pds?.endpoint ||
        /** @type {*} */(entry.operation).service);
      
      const shortHandle = shortenHandle(
        entry.operation.alsoKnownAs?.[0] ||
        /** @type {*} */(entry.operation).handle);
      
      const time = Date.parse(entry.createdAt);
      
      return {
        pds,
        shortHandle,
        time
      };
    });

    if (repoData) {
      if (repoData.profile?.history?.length) {
        for (const entry of repoData.profile.history) {
          history.push(entry);
        }
        history.sort((a, b) => b.time - a.time);
        let anyChange = false;
        repoData.profile.history = history.filter((entry, i) => {
          if (i &&
            entry.time === history[i - 1].time &&
            entry.pds === history[i - 1].pds &&
            entry.shortHandle === history[i - 1].shortHandle) {
            anyChange = true;
            return false;
          }
          return true;
        });

        if (anyChange) {
          intercepts?.profile?.(repoData.profile);
          updatedRepos.push(repoData.profile);
        }
      } else {
        history.sort((a, b) => b.time - a.time);
        const lastHistoryEntry = history[0];

        if (!repoData.profile) {
          repoData.profile = {
            shortDID,
            handle: lastHistoryEntry?.shortHandle,
            displayName: undefined,
            description: undefined,
            avatar: undefined,
            banner: undefined,
            words: detectWordStartsNormalized(lastHistoryEntry?.shortHandle, undefined),
            followersCount: undefined,
            followsCount: undefined,
            postsCount: undefined,
            history,
            asOf: history[0]?.time
          };
        } else {
          repoData.profile.history = history;
        }
      }
    } else {
      history.sort((a, b) => b.time - a.time);
      const lastHistoryEntry = history[0];
      const repo = createRepoData(shortDID);
      repo.profile = {
        shortDID,
        handle: lastHistoryEntry?.shortHandle,
        displayName: undefined,
        description: undefined,
        avatar: undefined,
        banner: undefined,
        words: detectWordStartsNormalized(lastHistoryEntry?.shortHandle, undefined),
        followersCount: undefined,
        followsCount: undefined,
        postsCount: undefined,
        history,
        asOf: history[0]?.time
      };
      store.set(shortDID, repo);

      intercepts?.profile?.(repo.profile);
      updatedRepos.push(repo.profile);
    }
  }

  return updatedRepos;
}
