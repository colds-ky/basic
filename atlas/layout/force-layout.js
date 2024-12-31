// @ts-check

/**
 * @typedef {{
 *  key: string,
 *  weight: number,
 *  descriptions?: string[]
 * }} NodeDefinition
 */

/**
 * @typedef {{
 *  key: string,
 *  nodeRatios: Record<string, number>,
 *  weight: number
 * }} EngagementDefinition
 */

/** Flavors are derived measures used to clump nodes lacking other relational information */
const FLAVOR_COUNT = 4;

/** The number of multidimensional coordinates preserved per node (later lowered to 2) */
const COORD_COUNT = 4;

const INITIAL_NODE = 256;

export function forceLayout() {

  /** @type {Map<string, number>} */
  const nodeIds = new Map();

  /** @type {string[]} Keys of corresponding node ids */
  const nodeKeys = [];

  let lastNodeId = 0;

  /** last access per node id */
  let layoutOrder = new Uint32Array(INITIAL_NODE * 1);

  /** weight per node id */
  let weights = new Float32Array(INITIAL_NODE * 1);

  /** flavour vector per node, @see FLAVOR_COUNT */
  let flavors = new Float32Array(INITIAL_NODE * FLAVOR_COUNT);

  /** multidimensional coordinates per node, @see COORD_COUNT */
  let coords = new Float32Array(INITIAL_NODE * COORD_COUNT);

  let layoutOrderCounter = 0;

  const layoutCtl = {
    loadNodes,
    updateNodeWeights,
    updateNodeDescriptions,
    deleteNodes,
    loadEngagement,
    layout
  };

  return layoutCtl;

  /** @param {NodeDefinition[]} nodes */
  function loadNodes(nodes) {
    for (const n of nodes) {
      let id = /** @type {number} */(nodeIds.get(n.key));
      if (id >= 0) {
        updateNodeWeightOne(id, n.weight);
        if (n.descriptions?.length) updateNodeDescriptionOne(id, n.descriptions);
      } else {
        id = allocNodeId();
        nodeIds.set(n.key, id);
        nodeKeys[id] = n.key;

        weights[id] = n.weight;
        deriveFlavorFor(id, n.descriptions);
      }
    }
  }

  /** @param {Record<string, number>} update */
  function updateNodeWeights(update) {
    for (const key in update) {
      const weight = update[key];
      if (weight >= 0) {
        const id = /** @type {number} */(nodeIds.get(key));
        if (id>=0) updateNodeWeightOne(id, weight);
      }
    }
  }

  /**@param {number} id @param {number} weight */
  function updateNodeWeightOne(id, weight) {
  }

  /** @param {Record<string, string[]>} update */
  function updateNodeDescriptions(update) {
  }

  /**@param {number} id @param {string[]} descriptions */
  function updateNodeDescriptionOne(id, descriptions) {
  }

  /** @param {string[]} nodeKeys */
  function deleteNodes(nodeKeys) {
  }

  /** @param {EngagementDefinition} engagement */
  function loadEngagement(engagement) {
  }

  /** @returns {number} */
  function allocNodeId() {
    if (lastNodeId < layoutOrder.length) {
      lastNodeId++;
      return lastNodeId;
    }

    if (lastNodeId > nodeIds.size) {
      // find first free slot
      for (let iNode = lastNodeId; iNode < layoutOrder.length; iNode++) {
        const nodeLive = layoutOrder[iNode] >= 0;
        if (!nodeLive) return iNode;
      }
    }

    // grow the arrays
    const newSize = layoutOrder.length * 2;

    const newLayoutOrder = new Uint32Array(newSize);
    newLayoutOrder.set(layoutOrder);
    layoutOrder = newLayoutOrder;

    const newWeights = new Float32Array(newSize);
    newWeights.set(weights);
    weights = newWeights;

    const newFlavors = new Float32Array(newSize * FLAVOR_COUNT);
    newFlavors.set(flavors);
    flavors = newFlavors;

    const newCoords = new Float32Array(newSize * COORD_COUNT);
    newCoords.set(coords);
    coords = newCoords;

    lastNodeId++;
    return lastNodeId;
  }

  /**
   * @param {number} id
   * @param {string[]} descriptions
   */
  function deriveFlavorFor(id, descriptions) {
    const flavor = new Float32Array(FLAVOR_COUNT);
    if (descriptions) {
      for (const desc of descriptions) {
        const hash = hashString(desc);
        const index = hash % FLAVOR_COUNT;
        flavor[index] = 1;
      }
    }
    flavors.set(flavor, id * FLAVOR_COUNT);
  }

  function layout() {
  }

}
