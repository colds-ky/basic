// @ts-check

import React from 'react';

import { CompletePostContent, PostFrame } from './post';
import { InsignificantMarkers } from './thread';
import { ThreadNestedChildren } from './thread-nested-children';

/**
 * @param {{
*  className?: string,
*  conversationDirection: import('./thread-structure').ThreadBranch,
*  linkTimestamp?: boolean,
*  linkAuthor?: boolean
* }} _
*/
export function ThreadConversationView({
 className,
 conversationDirection,
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
   />
 );

 /** @type {import('./thread-structure').ThreadBranch | undefined} */
 let prevConvo = conversationDirection;
 /** @type {import('./thread-structure').ThreadBranch[] | undefined} */
 let insignificants;
 /** @type {import('./thread-structure').ThreadBranch[] | undefined} */
 let asides;
 while (prevConvo) {
   insignificants = concatArraysSlim(insignificants, prevConvo.insignificants);
   asides = concatArraysSlim(asides, prevConvo.asides);
   const showNext =
     prevConvo.conversationDirection &&
     (prevConvo.conversationDirection.isSignificant || prevConvo.conversationDirection.isParentOfSignificant);

   if (showNext) {

     const suppressAuthor =
       prevConvo.conversationDirection?.post.shortDID === prevPost.shortDID &&
       !asides?.length; // if same author, and no visual interjection - no need to repeat the author's name

     if (insignificants?.length) {
       conversationSegments.push(
         <InsignificantMarkers
           key={'insignificants:' + prevConvo.post.uri}
           branches={insignificants}
         />
       );
       insignificants = undefined;
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

     if (prevConvo.isSignificant && prevConvo.significantPostCount && prevConvo.conversationDirection) {
       conversationSegments.push(
         <CompletePostContent
           key={'conversation:' + prevConvo.conversationDirection.post.uri}
           className='conversation'
           post={prevConvo.conversationDirection.post}
           linkTimestamp={linkTimestamp}
           linkAuthor={linkAuthor}
           suppressAuthor={suppressAuthor}
         />
       );
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
