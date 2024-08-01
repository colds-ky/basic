// @ts-check

import React, { useMemo } from 'react';
import { CompletePostContent, PostFrame } from './post';
import { InsignificantMarkers } from './thread';
import { AccountChip } from '../account/account-chip';
import { ThreadConversationView } from './thread-coversation-view';

/**
 * @param {{
 *  className?: string,
 *  branches: import('./thread-structure').ThreadBranch[],
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean
 * }} _
 */
export function ThreadNestedChildren({ className, branches, linkTimestamp, linkAuthor }) {

  /**
   * @type {{
   *  leading: import('./thread-structure').ThreadBranch[] | undefined,
   *  branch: import('./thread-structure').ThreadBranch
   * }[]}
   */
  let asideSegments = [];
  /** @type {import('./thread-structure').ThreadBranch[] | undefined} */
  let bendyLineInsignificants;
  collectAsides(branches);

  if (!asideSegments.length) asideSegments = branches.map(branch => ({ leading: undefined, branch }));
  if (!asideSegments.length) return null;

  return (
    <div
      className={className ? 'aside-interjection-section ' + className : 'aside-interjection-section'}
      style={{
        display: 'grid',
        gridTemplateColumns: asideSegments.map(() => '0.5em').join(' ') + ' 1fr',
        gridTemplateRows: asideSegments.map(() => '0em auto').join(' ')
      }}
    >
      {
        asideSegments.map(({ leading, branch }, i) => (
          <BendyLine
            key={'bendy-line-to-' + branch.post.uri}
            className={'bendy-line col-' + (i + 1) + ':' + (asideSegments.length + 2) + '-row-' + 1 + ':' + (i * 2 + 2)}
            leading={leading}
            style={{
              gridColumnStart: asideSegments.length - i,
              gridColumnEnd: asideSegments.length + 2,
              gridRowStart: 1,
              gridRowEnd: i * 2 + 2
            }}
          />
        ))
      }
      {
        asideSegments.map(({ leading, branch }, i) => (
          <ThreadNestedChildPost
            key={'nested-child-post-' + branch.post.uri}
            className={'nested-child-post col-' + (asideSegments.length + 1) + '-row-' + (i * 2 + 3)}
            leading={leading}
            branch={branch}
            linkTimestamp={linkTimestamp}
            linkAuthor={linkAuthor}
            style={{
              gridColumn: asideSegments.length + 1,
              gridRow: i * 2 + 2
            }}
          />
        ))
      }
    </div>
  );

  /** @param {import('./thread-structure').ThreadBranch[] | undefined} branches */
  function collectAsides(branches) {
    if (!branches?.length) return;
    for (const br of branches) {
      if (br.isSignificant) {
        asideSegments.push({
          leading: bendyLineInsignificants,
          branch: br
        });
        bendyLineInsignificants = undefined;
      } else {
        if (!bendyLineInsignificants) bendyLineInsignificants = [br];
        else bendyLineInsignificants.push(br);
      }
    }
  }
}


/**
 * @param {{
 *  className?: string,
 *  branch: import('./thread-structure').ThreadBranch,
 *  leading: import('./thread-structure').ThreadBranch[] | undefined,
 *  linkTimestamp?: boolean,
 *  linkAuthor?: boolean,
 *  style?: React.CSSProperties
 * }} _
 */
function ThreadNestedChildPost({ className, leading, branch, linkTimestamp, linkAuthor, style }) {
  return (
    <div className={className} style={style}>
      {
        branch.significantPostCount ?
          <ThreadConversationView
            className='nested-child-conversation-view'
            conversationDirection={branch}
            linkTimestamp={linkTimestamp}
            linkAuthor={linkAuthor} /> :
          <PostFrame>
            <CompletePostContent
              className='nested-child-post-content'
              post={branch.post}
              linkTimestamp={linkTimestamp}
              linkAuthor={linkAuthor}
            />
            {
              !branch?.insignificants?.length ? null :
                <InsignificantMarkers
                  branches={branch.insignificants}
                  linkTimestamp={linkTimestamp}
                  linkAuthor={linkAuthor}
                />
            }
          </PostFrame>
      }
    </div>
  );
}

const MAX_AVATARS_BENDY_LINE_DISPLAY = 3;

/**
 * @param {{
 *  className?: string,
 *  leading: import('./thread-structure').ThreadBranch[] | undefined,
 *  style?: React.CSSProperties
 * }} _
 */
function BendyLine({ className, leading, style }) {
  const reducedList = useMemo(() => {
    const avatars = [];
    if (leading?.length) {
      for (const branch of leading) {
        if (avatars.indexOf(branch.post.shortDID) < 0)
          avatars.push(branch.post.shortDID);
        if (avatars.length > MAX_AVATARS_BENDY_LINE_DISPLAY) break;
      }
    }
    return avatars;
  }, [leading]);
  return (
    <div className={'bendy-line ' + (className || '')} style={style}>
      {reducedList.map((shortDID, i) =>
        <AccountChip
          key={shortDID}
          account={shortDID}
          className={i === MAX_AVATARS_BENDY_LINE_DISPLAY ? 'bendy-line-more' : 'bendy-line-avatar'} />
      )}
    </div>
  );
}