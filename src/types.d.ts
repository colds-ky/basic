/// <reference types="@atproto/api" />

type AccountInfo = {
  shortDID: string;
  shortHandle: string;
  displayName?: string;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}

type SearchMatch = {
  shortDID: string;
  shortHandle: string;
  displayName?: string;
  rank: number;
  matchShortDID?: boolean;
  matchHandle?: boolean;
  matchDisplayName?: boolean;
  postID?: string;
}

type CompactHandleOrHandleDisplayName =
  string |
  [shortHandle: string, displayName: string];

declare module '@octokit/rest' {
  interface Octokit {
    rest: {
      git: {
        getCommit: any;
        createTree(arg: any): any;
        getRef: any;
        createBlob: any;
        updateRef: any;
        createCommit: any;
      }
    }
  }
}
