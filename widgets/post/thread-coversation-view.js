// @ts-check

import React from 'react';

import { CompletePostContent, PostFrame } from './post';
import { InsignificantMarkers } from './thread';
import { ThreadNestedChildren } from './thread-nested-children';

/**
 * @param {{
 *  className?: string,
 *  conversationDirection: import('./thread-structure').ThreadBranch,
 *  unrollMainConversation?: boolean,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean
 * }} _
 */
export function ThreadConversationView({
  className,
  conversationDirection,
  unrollMainConversation,
  linkTimestamp,
  linkAuthor
}) {
  const conversationSegments = [];
  let prevPost = conversationDirection.post;
  console.log('ThreadConversationView-starter {}.post', conversationDirection);
  conversationSegments.push(
    <CompletePostContent
      key={'conversation-starter:' + conversationDirection.post.uri}
      className='conversation-starter'
      post={conversationDirection.post}
      linkTimestamp={linkTimestamp}
      linkAuthor={linkAuthor}
      replies={conversationDirection.insignificants}
    />
  );

  /** @type {import('./thread-structure').ThreadBranch | undefined} */
  let prevConvo = conversationDirection;
  /** @type {import('./thread-structure').ThreadBranch[] | undefined} */
  let intermediateInsignificants;
  /** @type {import('./thread-structure').ThreadBranch[] | undefined} */
  let asides;
  while (prevConvo) {
    console.log('ThreadConversationView while(prevConvo) ', prevConvo);
    asides = concatArraysSlim(asides, prevConvo.asides);

    /** as opposed to collapsing into a little ball */
    const showNext =
      prevConvo.conversationDirection &&
      (
        unrollMainConversation && prevConvo.isLeadingToTargetPost ||
        prevConvo.conversationDirection.isSignificant ||
        prevConvo.conversationDirection.isParentOfSignificant
      ) &&
      prevConvo.conversationDirection;

    if (!showNext) {
      if (prevConvo.conversationDirection) {
        console.log('ThreadConversationView !showNext ', prevConvo);
        if (!intermediateInsignificants) intermediateInsignificants = [prevConvo.conversationDirection];
        else intermediateInsignificants.push(prevConvo.conversationDirection);
      }
    } else {

      let naturallySpaced = false;
      if (intermediateInsignificants?.length) {
        console.log('ThreadConversationView intermediateInsignificants', intermediateInsignificants);
        conversationSegments.push(
          <InsignificantMarkers
            key={'insignificants:' + prevConvo.post.uri}
            branches={intermediateInsignificants}
            linkTimestamp={linkTimestamp}
            linkAuthor={linkAuthor}
          />
        );
        intermediateInsignificants = undefined;
        naturallySpaced = true;
      }

      if (asides?.length) {
        console.log('ThreadConversationView asides', asides);
        conversationSegments.push(
          <ThreadNestedChildren
            className='thread-conversation-asides'
            key={'asides:' + prevConvo.post.uri}
            branches={asides}
            linkTimestamp={linkTimestamp}
            linkAuthor={linkAuthor}
          />
        );
        asides = undefined;
        naturallySpaced = true;
      }

      if (prevConvo.post.embeds?.length)
        naturallySpaced = true;

      let suppressAuthor =
        showNext.post.shortDID === prevConvo.post.shortDID && !naturallySpaced;
        // if same author, and no visual interjection - no need to repeat the author's name

      let showNextClassName = 'conversation';
      if (suppressAuthor) {
        console.log('ThreadConversationView suppressAuthor, <hr>');
        conversationSegments.push(
          <hr className='conversation-divider' key={'conversation-divider:' + prevConvo.post.uri} />
        );
        showNextClassName = 'conversation conversation-after-divider';
      } else if (!naturallySpaced) {
        showNextClassName = 'conversation conversation-after-tight-post';
      }

      console.log('ThreadConversationView <CompletePostContent {}.post ', showNext);
      conversationSegments.push(
        <CompletePostContent
          key={'conversation:' + showNext.post.uri}
          className={showNextClassName}
          post={showNext.post}
          incrementTimestampSince={prevConvo.post.asOf}
          linkTimestamp={linkTimestamp}
          linkAuthor={linkAuthor}
          suppressAuthor={suppressAuthor}
          replies={showNext.insignificants}
        />
      );
    }

    prevConvo = prevConvo.conversationDirection;
  }

  if (intermediateInsignificants?.length) {
    console.log('ThreadConversationView intermediateInsignificants:last', intermediateInsignificants);
    conversationSegments.push(
      <InsignificantMarkers
        key={'insignificants:last'}
        branches={intermediateInsignificants}
        linkTimestamp={linkTimestamp}
        linkAuthor={linkAuthor}
      />
    );
    intermediateInsignificants = undefined;
  }

  if (asides?.length) {
    console.log('ThreadConversationView asides:last', asides);
    conversationSegments.push(
      <ThreadNestedChildren
        className='thread-conversation-asides'
        key={'asides:last'}
        branches={asides}
        linkTimestamp={linkTimestamp}
        linkAuthor={linkAuthor}
      />
    );
    asides = undefined;
  }

  return (
    <PostFrame className={'thread-conversation-view ' + (className || '')}>
      {conversationSegments}
    </PostFrame>
  );
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
