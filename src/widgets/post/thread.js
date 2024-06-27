// @ts-check

import React from 'react';

import { useDB } from '../..';
import { forAwait } from '../../../coldsky/src/api/forAwait';
import { localise } from '../../localise';
import { AccountChip } from '../account/account-chip';
import { Post } from './post';

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
export function Thread({ className, uri, ...rest }) {
  const db = useDB();

  const thread = forAwait(uri, () => db.getPostThreadIncrementally(uri));

  return (
    !thread ?
      <div className='thread-loading-placeholder' {...rest}>
        {localise('Loading thread...', { uk: 'Завантаження дискусії...' })}
      </div> :
    <ThreadView
      className={'thread ' + (className || '')}
      thread={thread}
      {...rest}
    />
  );
}

/**
 * @param {{
 *  className?: string,
 *  significantPost?: (post: import('./post-text-content').MatchCompactPost) => boolean | null | undefined,
 *  thread: import('../../../coldsky/lib').CompactThreadPostSet,
 *  underPrevious?: boolean,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean
 * }} _
 */
export function ThreadView({ className, significantPost, thread, underPrevious, linkTimestamp, linkAuthor, ...rest }) {
  const root = layoutThread(thread, significantPost);

  return (
    <SubThread
      className={'thread-view ' + (className || '')}
      significantPost={significantPost || (post => post.shortDID === thread.current.shortDID)}
      node={root}
      underPrevious={underPrevious}
      linkTimestamp={linkTimestamp}
      linkAuthor={linkAuthor}
      {...rest}
    />
  );
}

/**
 * @typedef {{
 *  post: import('../../../coldsky/lib').CompactPost,
 *  children: PostNode[]
 * }} PostNode
 */

/**
 * @param {{
 *  className?: string,
 *  significantPost?: (post: import('./post-text-content').MatchCompactPost) => boolean | null | undefined,
 *  node: PostNode,
 *  underPrevious?: boolean,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean
 * }} _
 */
function SubThread({
  className,
  significantPost,
  node,
  underPrevious,
  linkTimestamp,
  linkAuthor,
  ...rest
}) {
  return (
    <div
      className={'sub-thread ' + (className || '')}
      {...rest}>
      <Post
        className={underPrevious ? 'thread-reply-post' : undefined}
        post={node.post}
        linkTimestamp={linkTimestamp}
        linkAuthor={linkAuthor}
      />
      {
        node.children.map((child, i) => (
          <CollapsedOrExpandedSubThread
            key={i}
            significantPost={significantPost}
            node={child}
            underPrevious={!i}
            linkTimestamp={linkTimestamp}
            linkAuthor={linkAuthor}
          />
        ))
      }
    </div>
  );
}

/**
 * @param {{
 *  significantPost?: (post: import('./post-text-content').MatchCompactPost) => boolean | null | undefined,
 *  node: PostNode,
 *  underPrevious?: boolean,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean
 * }} _
 */
function CollapsedOrExpandedSubThread({ significantPost, node, underPrevious, linkTimestamp, linkAuthor }) {
  let collapsedChunk = [];
  let nextNode = node;
  while (true) {
    if (significantPost?.(nextNode.post) || nextNode.children.length != 1) break;
    collapsedChunk.push(nextNode.post);
    nextNode = nextNode.children[0];
  }

  if (collapsedChunk.length === 0) {
    return (
      <SubThread
        significantPost={significantPost}
        node={node}
        underPrevious={underPrevious}
        linkTimestamp={linkTimestamp}
        linkAuthor={linkAuthor}
      />
    );
  } else {
    return (
      <>
        <CollapsedThreadPart
          children={collapsedChunk}
        />
        <SubThread
          significantPost={significantPost}
          node={nextNode}
          linkTimestamp={linkTimestamp}
          linkAuthor={linkAuthor}
        />
      </>
    );
  }
}

/**
 * @param {{
 *  children: import('../../../coldsky/lib').CompactPost[]
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
 *  post: import('../../../coldsky/lib').CompactPost
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
 *  posts: import('../../../coldsky/lib').CompactPost[]
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
 *  posts: import('../../../coldsky/lib').CompactPost[]
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
 * @param {import('../../../coldsky/lib').CompactThreadPostSet} thread
 * @param {(post: import('./post-text-content').MatchCompactPost) => boolean | null | undefined} [significantPost]
 */
function layoutThread(thread, significantPost) {
  /** @type {Map<string, import('../../../coldsky/lib').CompactPost>} */
  const allPosts = new Map();

  /** @type {Map<string, import('../../../coldsky/lib').CompactPost>} */
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
