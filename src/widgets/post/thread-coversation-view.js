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
   asides = concatArraysSlim(asides, prevConvo.asides);
   const showNext =
     prevConvo.conversationDirection &&
     (
      unrollMainConversation && prevConvo.isLeadingToTargetPost ||
      prevConvo.conversationDirection.isSignificant ||
      prevConvo.conversationDirection.isParentOfSignificant
    );

   if (showNext) {

     const suppressAuthor =
       prevConvo.conversationDirection?.post.shortDID === prevConvo.post.shortDID &&
       !asides?.length; // if same author, and no visual interjection - no need to repeat the author's name

     if (intermediateInsignificants?.length) {
       conversationSegments.push(
         <InsignificantMarkers
           key={'insignificants:' + prevConvo.post.uri}
           branches={intermediateInsignificants}
         />
       );
       intermediateInsignificants = undefined;
     }

     if (asides?.length) {
       conversationSegments.push(
         <ThreadNestedChildren
           key={'asides:' + prevConvo.post.uri}
           branches={asides}
         />
       );
       asides = undefined;
     }

     if (!intermediateInsignificants?.length && !asides?.length && !prevConvo.post.embeds?.length) {
      conversationSegments.push(
        <hr className='conversation-divider' key={'conversation-divider:' + prevConvo.post.uri} />
      );
     }

     if (prevConvo.conversationDirection && (
      unrollMainConversation && prevConvo.conversationDirection.isLeadingToTargetPost ||
      prevConvo.isSignificant && prevConvo.significantPostCount
     )) {
       conversationSegments.push(
         <CompletePostContent
           key={'conversation:' + prevConvo.conversationDirection.post.uri}
           className='conversation'
           post={prevConvo.conversationDirection.post}
           incrementTimestampSince={prevConvo.post.asOf}
           linkTimestamp={linkTimestamp}
           linkAuthor={linkAuthor}
           suppressAuthor={suppressAuthor}
         />
       );
     } else {
      if (!intermediateInsignificants) intermediateInsignificants = [prevConvo];
      else intermediateInsignificants.push(prevConvo);
     }
   }

   prevConvo = prevConvo.conversationDirection;
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
