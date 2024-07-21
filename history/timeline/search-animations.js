// @ts-check

import React, { useEffect, useState } from 'react';

import { Post } from '../../widgets/post/post';

import './search-animations.css';

/**
 * @param {{
 *  posts: import('../../package').CompactPost[] | undefined,
 *  filteredCount?: number,
 *  processedAllCount?: number,
 * }} props
 */
export function SearchNewestProgress(props) {
  return (
    <SearchAnimation {...props} />
  );
}

/**
 * @param {{
 *  posts: import('../../package').CompactPost[] | undefined,
 *  filteredCount?: number,
 *  processedAllCount?: number,
 * }} props
 */
export function SearchOldestProgress(props) {
  return (
    <SearchAnimation toLeft {...props} />
  );
}

const FLYING_POST_ANIMATION_DURATION_MSEC = 6000;
const FLYING_POST_COUNT = 5;

/**
 * @typedef {{
 *  post: import('../../package').CompactPost,
 *  animationStart: number,
 *  animationEnd: number,
 *  animationEndTimeout: number
 * }} FlyingPost
 */


/**
 * @param {{
 *  toLeft?: boolean,
 *  posts: import('../../package').CompactPost[] | undefined,
 *  filteredCount?: number,
 *  processedAllCount?: number,
 * }} _
 */
function SearchAnimation({ toLeft, posts, filteredCount, processedAllCount }) {

  if (!toLeft) return null;

  const [flyingPosts, setFlyingPosts] = useState(/** @type {FlyingPost[]} */([]));
  const [current] = useState({ posts, flyingPosts });
  current.posts = posts;
  current.flyingPosts = flyingPosts;

  const seenPosts = new Set();

  useEffect(() => {
    let tm = setTimeout(dropNextPost, 1);

    return () => {
      clearTimeout(tm);
      for (const fp of flyingPosts) {
        clearTimeout(fp.animationEndTimeout);
      }
    };

    function dropNextPost() {
      const { flyingPosts, posts } = current;
      let nextPost = posts?.find(p => !seenPosts.has(p.uri) && !flyingPosts.find(fp => fp.post.uri === p.uri));
      if (nextPost) {
        seenPosts.add(nextPost.uri);
        const now = Date.now();
        /** @type {FlyingPost} */
        const nextPostEntry = {
          post: nextPost,
          animationStart: now,
          animationEnd: now + FLYING_POST_ANIMATION_DURATION_MSEC,
          animationEndTimeout: /** @type {*} */(setTimeout(() => {
            const { flyingPosts, posts } = current;
            const newFlyingPosts = flyingPosts.filter(fp => fp.post.uri !== nextPost.uri);
            //console.log('animation end for ', nextPostEntry, nextPost.text, flyingPosts, ' --> ', newFlyingPosts);
            setFlyingPosts(newFlyingPosts);
            current.flyingPosts = newFlyingPosts;
          }, FLYING_POST_ANIMATION_DURATION_MSEC * 1.5))
        };
        const newFlyingPosts = [...flyingPosts, nextPostEntry];
        //console.log('animation start for ', nextPostEntry, nextPost.text, flyingPosts, '-->', newFlyingPosts);
        setFlyingPosts(newFlyingPosts);
        current.flyingPosts = newFlyingPosts;
      }

      tm = setTimeout(dropNextPost, FLYING_POST_ANIMATION_DURATION_MSEC / FLYING_POST_COUNT);
    }
  }, []);

  return (
    <div
      className={
        toLeft ? 'search-animation search-animation-to-left' :
          'search-animation search-animation-to-right'}>
      {
        flyingPosts.map((fp, i) => (
          <FlyingPost
            key={fp.post.uri}
            post={fp.post}
            animationStart={fp.animationStart}
            animationEnd={fp.animationEnd}
          />
        ))
      }
    </div>
  );
}

/**
 * @param {{
 *  post: import('../../package').CompactPost,
 *  animationStart: number,
 *  animationEnd: number
 * }} _
 */
function FlyingPost({ post, animationStart, animationEnd }) {
  return (
    <div className='flying-post'>
      <Post className='post-inner' allowEmbedDepth={0} post={post}>
      </Post>
    </div>
  );
}
