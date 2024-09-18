// @ts-check


/**
 * @typedef {{
 *  profile: import('../../package').CompactProfile,
 *  color: number,
 *  weight: number,
 *  x: number,
 *  y: number,
 *  relevant: import('../../package').CompactPost[]
 * }} ProfileBubble
 */

/**
 * 
 * @param {import('../../app').DBAccess} db
 */
export async function firehoseToBubbles(db) {
  // TODO: collect records, generate bubbles for accounts, recalculate positions, labels and flashing

  /** @type {ProfileBubble[]} */
  const bubbles = [];
  /** @type {Map<string, ProfileBubble>} */
  const bubbleByShortDID = new Map();

  for await (const chunk of db.firehose()) {
    for (const post of chunk.posts) {
      const existingBubble = bubbleByShortDID.get(post.shortDID);
      if (existingBubble) {
        // TODO: update bubble
      } else {
        // TODO: create bubble
      }
    }

    for (const profile of chunk.profiles) {
      const existingBubble = bubbleByShortDID.get(profile.shortDID);
      if (existingBubble) {
        // TODO: update bubble
      } else {
        // TODO: create bubble
      }
    }
  }

}


function state() {
  

  return {
    bubbles: [],

    addRecords,
    addProfiles,
  };

  /**
   * @param {import('../../package').FirehoseRecord[]} records
   */
  function addRecords(records) {
    for (const rec of records) {
      switch (rec.$type) {
        case 'app.bsky.actor.profile':
          break;
        
        case 'app.bsky.feed.post':
          // Handle feed post
          break;
        case 'app.bsky.feed.repost':
          // Handle feed repost
          break;
        case 'app.bsky.feed.like':
          // Handle feed like
          break;
        case 'app.bsky.graph.follow':
          // Handle graph follow
          break;
        case 'app.bsky.graph.block':
          // Handle graph block
          break;

        default:
          // Handle unknown type
          break;

      }
    }
  }

  /**
   * @param {import('../../package').CompactProfile[]} profiles
   */
  function addProfiles(profiles) {
  }
}