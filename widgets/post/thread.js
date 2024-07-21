// @ts-check

import React, { useMemo } from 'react';
import { useMatches } from 'react-router-dom';

import { forAwait } from '../../app-shared/forAwait';
import { useDB } from '../../app';
import { localise } from '../../app-shared/localise';
import { AccountChip } from '../account/account-chip';
import { CompletePostContent, Post, PostFrame } from './post';
import { ThreadConversationView } from './thread-coversation-view';
import { ThreadForumView } from './thread-forum-view';
import { threadStructure } from './thread-structure';

import './thread.css';

/**
 * @param {{
 *  className?: string,
 *  significantPost?: (post: import('./post-text-content').MatchCompactPost) => boolean | null | undefined,
 *  uri: string,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean
 * }} _
 */
export function Thread({ className, significantPost, uri, linkTimestamp, linkAuthor, ...rest }) {
  const db = useDB();

  const thread = forAwait(uri, () => db.getPostThreadIncrementally(uri));

  return (
    !thread ?
      <div className='thread-loading-placeholder' {...rest}>
        {localise('Loading thread...', { uk: 'Завантаження дискусії...' })}
      </div> :
      <ThreadView
        className={'thread ' + (className || '')}
        significantPost={significantPost}
        thread={thread}
        unrollMainConversation
        linkTimestamp={linkTimestamp}
        linkAuthor={linkAuthor}
        {...rest}
      />
  );
}

/**
 * @param {{
 *  className?: string,
 *  significantPost?: (post: import('./post-text-content').MatchCompactPost) => boolean | null | undefined,
 *  thread: import('../../package').CompactThreadPostSet,
 *  unrollMainConversation?: boolean,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean
 * }} _
 */
export function ThreadView({
  className,
  significantPost,
  unrollMainConversation,
  thread,
  linkTimestamp,
  linkAuthor,
  ...rest
}) {

  const matches = useMatches();
  console.log('thread ', significantPost, thread, matches);


  const threadBranch = useMemo(() =>
    thread && threadStructure(thread, significantPost),
    [thread, significantPost]);

  if (!threadBranch.significantPostCount) {
    return (
      <PostFrame className={className}>
        <CompletePostContent
          post={thread.root}
          linkTimestamp={linkTimestamp}
          linkAuthor={linkAuthor}
          replies={threadBranch.insignificants}
        />
      </PostFrame>
    );
  } else if (threadBranch.conversationDirection) {
    return (
      <ThreadConversationView
        className={className}
        conversationDirection={threadBranch}
        unrollMainConversation={unrollMainConversation}
        linkTimestamp={linkTimestamp}
        linkAuthor={linkAuthor}
      />
    );
  } else {
    return (
      <ThreadForumView
        className={className}
        parent={threadBranch}
        linkTimestamp={linkTimestamp}
        linkAuthor={linkAuthor}
      />
    );
  }
}

/**
 * @param {{
 *  branches: import('./thread-structure').ThreadBranch[]
 * }} _
 */
export function InsignificantMarkers({ branches }) {
  const replyAvatars = useMemo(() => collectReplyAvatars(branches), [branches]);
  if (!replyAvatars?.length) return null;
  return (
    <div className='insignificant-expandable-markers'>
      {replyAvatars.map(shortDID => (
        <AccountChip
          key={'insignificant-avatar-' + shortDID}
          className='insignificant-expandable-avatar-marker'
          account={shortDID} />
      ))}
    </div>
  );
}

/**
 * @param {import('./thread-structure').ThreadBranch[] | undefined} branches
 * @param {string[]} [shortDIDs]
 */
function collectReplyAvatars(branches, shortDIDs) {
  const MAX_AVATAR_DISPLAY = 3;

  if (!branches) return shortDIDs;
  if (!shortDIDs) shortDIDs = [];
  for (const br of branches) {
    if (shortDIDs.indexOf(br.post.shortDID) < 0)
      shortDIDs.push(br.post.shortDID);
    if (shortDIDs.length > MAX_AVATAR_DISPLAY)
      break;
  }
  for (const br of branches) {
    if (shortDIDs.length > MAX_AVATAR_DISPLAY) break;
    collectReplyAvatars(br.children, shortDIDs);
  }
  return shortDIDs;
}

/**
 * @template T
 * @param {T[] | undefined} array1
 * @param {T[] | undefined} array1
 * }
 */
function concatArraysSlim(array1, array2) {
  return !array1 ? array2 : !array2 ? array1 : array1.concat(array2);
}

/**
 * @typedef {{
 *  post: import('../../package').CompactPost,
 *  children: PostNode[]
 * }} PostNode
 */

/**
 * @param {{
 *  children: import('../../package').CompactPost[]
 * }} _
 */
function CollapsedThreadPart({ children }) {
  return (
    <div className='collapsed-thread-part'>
      {
        children.length === 1 ? <CollapsedSinglePost post={children[0]} /> :
          children.length <= 4 ? <CollapsedFewPosts posts={children} /> :
            <CollapsedManyPosts posts={children} />
      }
    </div>
  );
}

/**
 * @param {{
 *  post: import('../../package').CompactPost
 * }} _
 */
function CollapsedSinglePost({ post }) {
  return (
    <div className='collapsed-single-post'>
      <AccountChip account={post.shortDID} />
    </div>
  );
}

/**
 * @param {{
 *  posts: import('../../package').CompactPost[]
 * }} _
 */
function CollapsedFewPosts({ posts }) {
  return (
    <div className='collapsed-few-posts'>
      {
        posts.map(post => (
          <span key={post.uri} className='collapsed-few-post-one'>
            <AccountChip account={post.shortDID} />
          </span>
        ))
      }
    </div>
  );
}

/**
 * @param {{
 *  posts: import('../../package').CompactPost[]
 * }} _
 */
function CollapsedManyPosts({ posts }) {
  const firstAccount = posts[0].shortDID;
  /** @type {Map<string, number>} */
  const accountFrequencies = new Map();
  for (const post of posts) {
    const shortDID = post.shortDID;
    accountFrequencies.set(
      shortDID,
      (accountFrequencies.get(shortDID) || 0) + 1);
  }

  const frequentAccounts = [...accountFrequencies.keys()].sort((a1, a2) =>
    (accountFrequencies.get(a2) || 0) - (accountFrequencies.get(a1) || 0));

  if (frequentAccounts.length > 3) {
    frequentAccounts.splice(frequentAccounts.indexOf(firstAccount), 1);
    frequentAccounts.length = 3;
  }

  return (
    <div className='collapsed-many-posts'>
      <div className='collapsed-many-posts-first'>
        <AccountChip account={firstAccount} />
      </div>
      <div className='collapsed-many-posts-rest'>
        {
          frequentAccounts.map(account => (
            <span key={account} className='collapsed-many-posts-rest-one'>
              <AccountChip account={account} />
            </span>
          ))
        }
        <span className='collapsed-many-posts-counter'>
          {posts.length.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/**
 * @param {import('../../package').CompactThreadPostSet} thread
 * @param {(post: import('./post-text-content').MatchCompactPost) => boolean | null | undefined} [significantPost]
 */
function layoutThread(thread, significantPost) {
  /** @type {Map<string, import('../../package').CompactPost>} */
  const allPosts = new Map();

  /** @type {Map<string, import('../../package').CompactPost>} */
  const significantPosts = new Map();
  for (const post of thread.all) {
    allPosts.set(post.uri, post);
    if (significantPost?.(post)) {
      significantPosts.set(post.uri, post);
    }
  }

  if (significantPost?.(thread.root)) {
    significantPosts.set(thread.root.uri, thread.root);
    allPosts.set(thread.root.uri, thread.root);
  }

  if (significantPost?.(thread.current)) {
    significantPosts.set(thread.current.uri, thread.current);
    allPosts.set(thread.current.uri, thread.current);
  }

  const ownEearlyFirst = [...significantPosts.values()].sort((p1, p2) => (p2.asOf || 0) - (p1.asOf || 0));

  /** @type {PostNode} */
  let root = {
    post: thread.root,
    children: []
  };
  /** @type {Map<string, PostNode>} */
  const nodeByUri = new Map();

  significantPosts.delete(thread.root.uri);
  nodeByUri.set(thread.root.uri, root);

  while (true) {
    // find first not placed
    let notPlaced = ownEearlyFirst.find(post => !nodeByUri.has(post.uri));
    if (!notPlaced) break;

    /** @type {PostNode} */
    let node = {
      post: notPlaced,
      children: []
    };
    nodeByUri.set(notPlaced.uri, node);

    while (true) {
      const parentNode = nodeByUri.get(node.post.replyTo || '');
      if (parentNode) {
        parentNode.children.push(node);
        break;
      }

      const parentPost = allPosts.get(node.post.replyTo || '');
      if (!parentPost) break;
      node = {
        post: parentPost,
        children: [node]
      };
      nodeByUri.set(node.post.uri, node);
    }
  }

  return root;
}
