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
