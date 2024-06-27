// @ts-check

import React from 'react';
import { CompletePostContent, PostFrame } from './post';
import { InsignificantMarkers } from './thread';

/**
 * @param {{
 *  className?: string,
 *  branches: import('./thread-structure').ThreadBranch[]
 * }} _
 */
export function ThreadNestedChildren({ className, branches }) {
 const asideSegments = [];
 /** @type {import('./thread-structure').ThreadBranch[] | undefined} */
 let bendyLineInsignificants;
 collectAsides(branches);

 if (!asideSegments.length) return null;

 return (
   <div className={className ? 'aside-interjection-section ' + className : 'aside-interjection-section'}>
     {asideSegments}
   </div>
 );

 /** @param {import('./thread-structure').ThreadBranch[] | undefined} branches */
 function collectAsides(branches) {
   if (!branches?.length) return;
   for (const br of branches) {
     if (br.isSignificant) {
       asideSegments.push(
         <ThreadNestedChildPost
           key={br.post.uri}
           leading={bendyLineInsignificants}
           branch={br}
         />
       );
       bendyLineInsignificants = undefined;
     } else {
       if (!bendyLineInsignificants) bendyLineInsignificants = [br];
       else bendyLineInsignificants.push(br);
     }
   }
 }
}

function ThreadNestedChildPost({ leading, branch }) {
  return (
    <div className='aside-post-dummy-work-in-progress'>
      <PostFrame>
        <CompletePostContent
          post={branch.post} />
          {
            !branch?.insignificants?.length ? null :
            <InsignificantMarkers branches={branch.insignificants} />
          }
      </PostFrame>
    </div>
  );
 }