// @ts-check

/**
 * 
 * @param {ReturnType<typeof import('../../package/firehose').firehose>} firehose 
 */
export function firehoseToBubbles(firehose) {
  // TODO: collect records, generate bubbles for accounts, recalculate positions, labels and flashing
}

/**
 * @typedef {{
 *  profile: import('../../package').CompactProfile,
 *  color: number,
 *  weight: number,
 *  x: number,
 *  y: number,
 *  recent: 
 * }} ProfileBubble
 */

function state() {
  const bubbles = [];
  const bubbleByShortDID = new Map();

  return {
    bubbles: [],

    addRecords,
    addProfiles,
  };

  /**
   * 
   * @param {import('../../package').FirehoseRecord[]} records
   */
  function addRecords(records) {
  }

  function addProfiles(profiles) {
  }
}