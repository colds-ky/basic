// @ts-check

import React from 'react';
import { forAwait, useForAwait } from '../../coldsky/src/api/forAwait';
import { Visible } from '../widgets/visible';
import { useDB } from '..';
import { Post } from '../widgets/post';
import { makeFeedUri } from '../../coldsky/lib';

import './timeline.css';

/**
 * @param {{
 *  shortDID: string
 * }} _
 */
export function Timeline({ shortDID }) {
  const db = useDB();

  const [retrieved, next] = useForAwait(shortDID, getTimeline);

  return (
    <>
      {
        !retrieved?.timeline ? undefined :
        
          retrieved.timeline.map((thread, i) => (
            <ThreadView key={i} thread={thread} shortDID={shortDID} />
          ))
      }
      <Visible
        onVisible={() =>
          next()
        }>
        <button onClick={() =>
          next()
        }>
          Search more...
        </button>
      </Visible>
    </>
  );


  async function* getTimeline(didOrHandle) {
    try {
      let shortDID;
      for await (const profile of db.getProfileIncrementally(didOrHandle)) {
        if (profile.shortDID) {
          shortDID = profile.shortDID;
          break;
        }
      }

      /**
       * @type {import('../../coldsky/lib').CompactThreadPostSet[]}
       */
      let historicalPostThreads = [];
      /** @type {Set<string>} */
      const seenPosts = new Set();

      for await (const entries of db.searchPostsIncrementally(shortDID, undefined)) {
        if (!entries?.length) continue;

        for (const post of entries) {
          if (seenPosts.has(post.threadStart || post.uri)) continue;
          seenPosts.add(post.threadStart || post.uri);

          let postThreadRetrieved;
          for await (const postThread of db.getPostThreadIncrementally(post.uri)) {
            postThreadRetrieved = postThread;
          }

          if (!postThreadRetrieved) continue;

          historicalPostThreads.push(postThreadRetrieved);
          yield { timeline: historicalPostThreads };
        }
      }
      console.log('timeline to end...');
    } finally {
      console.log('timeline finally');
    }
  }
}

/**
 * @param {{
 *  shortDID: string,
 *  thread: import('../../coldsky/lib').CompactThreadPostSet,
 * }} _
 */
export function ThreadView({ shortDID, thread }) {
  const root = layoutThread(shortDID, thread);

  return (
    <SubThread shortDID={shortDID} node={root} />
  );
}

/**
 * @typedef {{
 *  post: import('../../coldsky/lib').CompactPost,
 *  children: PostNode[]
 * }} PostNode
 */

/**
 * @param {{
 *  shortDID: string,
 *  node: PostNode
 * }} _
 */
function SubThread({ shortDID, node }) {
  return (
    <div className='sub-thread'>
      <Post post={node.post} />
      {
        node.children.map((child, i) => (
          <CollapsedOrExpandedSubThread key={i} shortDID={shortDID} node={child} />
        ))
      }
    </div>
  );
}

/**
 * @param {{
 *  shortDID: string,
 *  node: PostNode
 * }} _
 */
function CollapsedOrExpandedSubThread({ shortDID, node }) {
  let collapsedChunk = [];
  let nextNode = node;
  while (true) {
    if (nextNode.post.shortDID === shortDID || nextNode.children.length != 1) break;
    collapsedChunk.push(nextNode.post);
    nextNode = nextNode.children[0];
  }

  if (collapsedChunk.length === 0) {
    return (
      <SubThread shortDID={shortDID} node={node} />
    );
  } else {
    return (
      <>
        <CollapsedThreadPart children={collapsedChunk} />
        <SubThread shortDID={shortDID} node={nextNode} />
      </>
    );
  }
}

/**
 * @param {{
 *  children: import('../../coldsky/lib').CompactPost[]
 * }} _
 */
function CollapsedThreadPart({ children }) {
  return (
    <div className='collapsed-thread-paret'>
      {children.length === 1 ? '...' : children.length + '...'}
    </div>
  );
}



/**
 * @param {string} shortDID
 * @param {import('../../coldsky/lib').CompactThreadPostSet} thread
 */
function layoutThread(shortDID, thread) {
  /** @type {Map<string, import('../../coldsky/lib').CompactPost>} */
  const allPosts = new Map();

  /** @type {Map<string, import('../../coldsky/lib').CompactPost>} */
  const ownPosts = new Map();
  for (const post of thread.all) {
    allPosts.set(post.uri, post);
    if (post.shortDID === shortDID) {
      ownPosts.set(post.uri, post);
    }
  }

  if (thread.root.shortDID === shortDID) {
    ownPosts.set(thread.root.uri, thread.root);
    allPosts.set(thread.root.uri, thread.root);
  }

  if (thread.current.shortDID === shortDID) {
    ownPosts.set(thread.current.uri, thread.current);
    allPosts.set(thread.current.uri, thread.current);
  }

  const ownEearlyFirst = [...ownPosts.values()].sort((p1, p2) => (p2.asOf || 0) - (p1.asOf || 0));

  /** @type {PostNode} */
  let root = {
    post: thread.root,
    children: []
  };
  /** @type {Map<string, PostNode>} */
  const nodeByUri = new Map();

  ownPosts.delete(thread.root.uri);
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