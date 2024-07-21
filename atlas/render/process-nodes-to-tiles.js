// @ts-check

/**
 * @template T
 * @param {{
 *  nodes: T[],
 *  getPoint: (item: T, point: { x: number, y: number, h: number, weight: number }) => void,
 *  dimensionCount: number
 * }} _
 */
export function processNodesToTiles({ nodes, getPoint, dimensionCount }) {
  const usersBounds = getNodeCoordBounds({ nodes, getPoint });

  const point = { x: 0, y: 0, h: 0, weight: 0 };

  /** @type {T[][]} */
  const tiles = [];
  for (const node of nodes) {
    getPoint(node, point);
    const tileX = Math.floor((point.x - usersBounds.x.min) / (usersBounds.x.max - usersBounds.x.min) * dimensionCount);
    const tileY = Math.floor((point.x - usersBounds.y.min) / (usersBounds.y.max - usersBounds.y.min) * dimensionCount);
    const tileIndex = tileX + tileY * dimensionCount;
    const tileBucket = tiles[tileIndex] || (tiles[tileIndex] = []);

    tileBucket.push(node);
  }

  const aPoint = { x: 0, y: 0, h: 0, weight: 0 };
  const bPoint = { x: 0, y: 0, h: 0, weight: 0 };

  for (const tileBucket of tiles) {
    if (!tileBucket) continue;

    tileBucket.sort(compareNodeWeights);
  }

  return tiles;

  /**
   * @param {T} aNode
   * @param {T} bNode
   */
  function compareNodeWeights(aNode, bNode) {
    getPoint(aNode, aPoint);
    getPoint(bNode, bPoint);
    return bPoint.weight - aPoint.weight;
  }
}

/**
 * @template T
 * @param {{
 *  nodes: T[],
 *  getPoint: (item: T, point: { x: number, y: number, h: number, weight: number }) => void
 * }} _
 */
export function getNodeCoordBounds({ nodes, getPoint }) {
  const bounds = {
    x: { min: NaN, max: NaN },
    y: { min: NaN, max: NaN },
    weight: { min: NaN, max: NaN }
  };

  const point = { x: 0, y: 0, h: 0, weight: 0 };

  for (const node of nodes) {
    getPoint(node, point);
    if (!Number.isFinite(bounds.x.min) || point.x < bounds.x.min) bounds.x.min = point.x;
    if (!Number.isFinite(bounds.x.max) || point.x > bounds.x.max) bounds.x.max = point.x;
    if (!Number.isFinite(bounds.y.min) || point.y < bounds.y.min) bounds.y.min = point.y;
    if (!Number.isFinite(bounds.y.max) || point.y > bounds.y.max) bounds.y.max = point.y;
    if (!Number.isFinite(bounds.weight.min) || point.weight < bounds.weight.min) bounds.weight.min = point.weight;
    if (!Number.isFinite(bounds.weight.max) || point.weight > bounds.weight.max) bounds.weight.max = point.weight;
  }

  return bounds;
}
