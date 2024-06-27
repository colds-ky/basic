// @ts-check

import React from 'react';
import { CompletePostContent, PostFrame } from './post';
import { InsignificantMarkers } from './thread';
import { ThreadNestedChildren } from './thread-nested-children';

/**
 * @param {{
*  className?: string,
*  parent: import('./thread-structure').ThreadBranch,
*  linkTimestamp?: boolean,
*  linkAuthor?: boolean
* }} _
*/
export function ThreadForumView({
  className,
  parent,
  linkTimestamp,
  linkAuthor
}) {
  return (
    <PostFrame className={'thread-forum-view ' + (className || '')}>
      <CompletePostContent
        post={parent.post}
        linkTimestamp={linkTimestamp}
        linkAuthor={linkAuthor}
      />
      <InsignificantMarkers branches={parent?.insignificants || []} />
      <ThreadNestedChildren
        branches={parent.asides || parent.children || []} />
    </PostFrame>
  );
}