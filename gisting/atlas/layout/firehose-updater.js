// @ts-check

import { breakFeedURIPostOnly, shortenDID, unwrapShortDID } from '../../../package';

/**
 * @param {import('../../../app').DBAccess} db 
 */
export function firehoseUpdater(db) {

  const state = {
  };

  return updateWithMessages;

  /**
   * @param {import('../../../package').FirehoseRecord[]} messages
   */
  function updateWithMessages(messages) {
    for (const msg of messages) {
      const senderShortDID = shortenDID(msg.repo);

      switch (msg.$type) {
        case 'app.bsky.actor.profile':
          incrementActor(senderShortDID, 1);
          continue;

        case 'app.bsky.feed.generator':
          incrementActor(senderShortDID, 1);
          continue;

        case 'app.bsky.feed.like':
          {
            const msgLink = breakFeedURIPostOnly(msg.subject.uri);
            if (msgLink) {
              if (msgLink.shortDID === senderShortDID) incrementActor(senderShortDID, 0.1); // should actually skip self-likes?
              else incrementActorPostRelation(senderShortDID, msgLink.shortDID, msg.subject.uri, 1);
            }
          }
          continue;

        case 'app.bsky.feed.repost':
          {
            // repost is slightly worse than like?
            const msgLink = breakFeedURIPostOnly(msg.subject.uri);
            if (msgLink) {
              if (msgLink.shortDID === senderShortDID) incrementActor(senderShortDID, 0.09); // should actually skip self-likes?
              else incrementActorPostRelation(senderShortDID, msgLink.shortDID, msg.subject.uri, 0.9);
            }
          }
          continue;


        case 'app.bsky.feed.post':
          const selfLink = breakFeedURIPostOnly(msg.uri);
          const parentLink = breakFeedURIPostOnly(msg.reply?.parent.uri);
          const rootLink = breakFeedURIPostOnly(msg.reply?.root.uri) || parentLink;

          if (!rootLink || (rootLink.postID === selfLink?.postID && rootLink.shortDID === senderShortDID)) {
            // starting post
            actorPosted(senderShortDID, msg.uri, 1);
          } else if (parentLink?.shortDID === senderShortDID) {
            // reply to themselves, a thread - diminish significance a little
            actorPosted(senderShortDID, msg.uri, 0.7);

            if (rootLink.shortDID !== senderShortDID) {
              // very small increment of the original post starting the thread
              incrementActorPostRelation(senderShortDID, parentLink?.shortDID, msg.reply?.parent.uri, 0.05);
            }
          } else {
            incrementActorPostRelation(senderShortDID, parentLink?.shortDID, msg.reply?.parent.uri, 0.5);

            if (rootLink.shortDID !== senderShortDID && msg.reply?.parent.uri !== msg.reply?.root.uri) {
              // small increment of the original post starting the thread
              incrementActorPostRelation(senderShortDID, parentLink?.shortDID, msg.reply?.parent.uri, 0.1);
            }
          }

          continue;

        case 'app.bsky.graph.follow':
          // very large boost
          incrementActorRelation(senderShortDID, unwrapShortDID(msg.subject), 20);
          continue;

        case 'app.bsky.graph.block':
          // decrement?
          continue;
      }
    }

  }

  function incrementActor(whoShortDID, ratio) {
    //
  }

  function actorPosted(whoShortDID, uri, ratio) {
    //
  }

  function incrementActorPostRelation(whoShortDID, whomShortDID, uri, ratio) {
    //
  }

  function incrementActorRelation(whoShortDID, whomShortDID, ratio) {
    //
  }
}