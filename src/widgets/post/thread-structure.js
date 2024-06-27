// @ts-check

/**
 * @typedef {{
 *  post: import('../../../coldsky/lib').MatchCompactPost,
 *  branchPostCount: number,
 *  branchInterestWeight: number,
 *  maxBranchDepth: number,
 *  maxSignificantBranchDepth: number,
 *  maxDirectSignificantBranchDepth: number,
 *  isConversationReply: boolean,
 *  isSignificant: boolean,
 *  isParentOfSignificant: boolean,
 *  significantPostCount: number,
 *  children: ThreadBranch[] | undefined,
 *  conversationDirection?: ThreadBranch,
 *  insignificants: ThreadBranch[] | undefined,
 *  asides: ThreadBranch[] | undefined
 * }} ThreadBranch
 */

/**
 * @param {import('../../../coldsky/lib').CompactThreadPostSet} thread
 * @param {(post: import('../../../coldsky/lib').MatchCompactPost) => boolean | null | undefined} [isSignificantPost]
 */
export function threadStructure(thread, isSignificantPost) {
  /** @type {ThreadBranch} */
  const root = {
    post: thread.root,
    branchPostCount: 1,
    branchInterestWeight: initialInterestWeight(thread.root),
    maxBranchDepth: 1,
    maxSignificantBranchDepth: 1,
    maxDirectSignificantBranchDepth: 1,
    isConversationReply: false,
    isSignificant: true,
    isParentOfSignificant: false,
    significantPostCount: 0,
    children: undefined,
    conversationDirection: undefined,
    insignificants: undefined,
    asides: undefined
  };

  if (thread.all.length === 1) return root;
  // TODO: handle small size threads in a separate function,
  // there are many of them to benefit from that optimisation

  /** @type {Map<string, import('./post-text-content').MatchCompactPost>} */
  const toVisitById = new Map();
  for (const post of thread.all) {
    toVisitById.set(post.uri, post);
  }

  toVisitById.delete(thread.root.uri);
  /** @type {Map<string, ThreadBranch>} */
  const allocatedById = new Map();
  allocatedById.set(root.post.uri, root);

  for (const post of thread.all) {
    allocatePost(post);
  }

  discoverConversations(root, false);

  return root;

  /**
   * @param {import('../../../coldsky/lib').CompactPost} post 
   */
  function allocatePost(post) {
    const alreadyAllocated = allocatedById.get(post.uri);
    if (alreadyAllocated) return alreadyAllocated;

    const parentURI = post.replyTo || thread.root.uri;
    let allocatedParent = allocatedById.get(parentURI);
    if (!allocatedParent) {
      const parentPost = toVisitById.get(parentURI);
      if (!parentPost) {
        allocatedParent = root;
      } else {
        allocatedParent = allocatePost(parentPost);
      }
    }

    const isSignificant = isSignificantPost?.(post) || false;

    /** @type {ThreadBranch} */
    const allocatedPost = {
      post,
      branchPostCount: 1,
      branchInterestWeight: initialInterestWeight(post),
      maxBranchDepth: 1,
      maxSignificantBranchDepth: isSignificant ? 1 : 0,
      maxDirectSignificantBranchDepth: isSignificant ? 1 : 0,
      isConversationReply: false,
      isSignificant: isSignificant,
      isParentOfSignificant: allocatedParent.isSignificant,
      significantPostCount: 0,
      children: undefined,
      conversationDirection: undefined,
      insignificants: undefined,
      asides: undefined
    };

    addChildAllocatedPost(allocatedParent, allocatedPost);

    allocatedById.set(post.uri, allocatedPost);
    toVisitById.delete(post.uri);
    return allocatedPost;
  }

  /**
   * @param {import('../../../coldsky/lib').CompactPost} post 
   */
  function initialInterestWeight(post) {
    return post.likeCount || 1;
  }

  /**
   * @param {ThreadBranch} parent 
   * @param {ThreadBranch} child
   */
  function addChildAllocatedPost(parent, child) {
    if (!parent.children) parent.children = [child];
    else parent.children.push(child);

    let ancestor = parent;
    let descendant = child;
    while (ancestor !== descendant) {
      ancestor.branchPostCount = 0;
      ancestor.significantPostCount = 0;

      ancestor.maxBranchDepth = Math.max(
        ancestor.maxBranchDepth,
        descendant.maxBranchDepth + 1);

      ancestor.branchInterestWeight = 0;
      ancestor.maxBranchDepth = 0;
      ancestor.maxSignificantBranchDepth = 0;
      ancestor.maxDirectSignificantBranchDepth = 0;
      for (const ancestorChild of /** @type {ThreadBranch[]} */(ancestor.children)) {
        ancestor.branchPostCount += ancestorChild.branchPostCount + 1;
        ancestor.significantPostCount += ancestorChild.significantPostCount;

        if (ancestorChild.isSignificant) {
          ancestor.significantPostCount++;
          ancestor.isParentOfSignificant = true;
          ancestor.maxDirectSignificantBranchDepth = Math.max(
            ancestor.maxDirectSignificantBranchDepth,
            ancestorChild.maxDirectSignificantBranchDepth + 1);

          const SIGNIFICANT_BRANCH_INTEREST_INCREASE_FACTOR = 2;
          ancestor.branchInterestWeight += ancestorChild.branchInterestWeight * SIGNIFICANT_BRANCH_INTEREST_INCREASE_FACTOR;
        } else {
          ancestor.branchInterestWeight += ancestorChild.branchInterestWeight;
        }

        if (ancestorChild.significantPostCount || ancestorChild.isSignificant) {
          ancestor.maxSignificantBranchDepth = Math.max(
            ancestor.maxSignificantBranchDepth,
            ancestorChild.maxSignificantBranchDepth + 1);
        }

        ancestor.maxBranchDepth = Math.max(
          ancestor.maxBranchDepth,
          ancestorChild.maxBranchDepth + 1);
      }

      ancestor = allocatedById.get(ancestor.post.uri) || root;
      descendant = ancestor;
    }
  }
}

/**
 * @param {ThreadBranch} root
 * @param {boolean} pressureToFindConversation
 */
function discoverConversations(root, pressureToFindConversation) {
  if (!root.children?.length) return;

  /** @type {ThreadBranch[]} */
  let directSignificantBranches = [];
  /** @type {ThreadBranch | undefined} */
  let deepestDirectSignificantBranch;
  let totalDirectSignificantBranchDepth = 0;
  let totalDirectSignificantBranchInterest = 0;

  /** @type {ThreadBranch[]} */
  let significantBranches = [];
  /** @type {ThreadBranch | undefined} */
  let deepestSignificantBranch;
  let totalSignificantBranchDepth = 0;
  let totalSignificantBranchInterest = 0;

  /** @type {ThreadBranch | undefined} */
  let deepestBranch;
  let totalBranchDepth = 0;
  let totalBranchInterest = 0;

  for (const child of root.children) {
    if (child.isSignificant) {
      directSignificantBranches.push(child);
      totalDirectSignificantBranchDepth += child.maxDirectSignificantBranchDepth;
      totalDirectSignificantBranchInterest += child.branchInterestWeight;
      if (!deepestDirectSignificantBranch ||
        child.maxDirectSignificantBranchDepth > deepestDirectSignificantBranch.maxDirectSignificantBranchDepth)
        deepestDirectSignificantBranch = child;
    }

    if (child.isSignificant || child.significantPostCount) {
      significantBranches.push(child);
      totalSignificantBranchDepth += child.maxSignificantBranchDepth;
      totalSignificantBranchInterest += child.branchInterestWeight;
      if (!deepestSignificantBranch ||
        child.maxSignificantBranchDepth > deepestSignificantBranch.maxSignificantBranchDepth)
        deepestSignificantBranch = child;
    }

    totalBranchDepth += child.maxBranchDepth;
    totalBranchInterest += child.branchInterestWeight;
    if (!deepestBranch ||
      child.maxBranchDepth > deepestBranch.maxBranchDepth)
      deepestBranch = child;
  }

  // finding conversation starter at the top
  // if found, conversation below needs to be traced harder
  // otherwise, it's a forum and conversations within branches need to be checked (but no pressure)

  if (directSignificantBranches.length) {
    root.conversationDirection = detectConversationForPeerPosts(
      directSignificantBranches,
      /** @type {ThreadBranch} */(deepestDirectSignificantBranch),
      totalDirectSignificantBranchDepth,
      totalDirectSignificantBranchInterest,
      pressureToFindConversation
    );
  } else if (significantBranches.length) {
    root.conversationDirection = detectConversationForPeerPosts(
      significantBranches,
      /** @type {ThreadBranch} */(deepestSignificantBranch),
      totalSignificantBranchDepth,
      totalSignificantBranchInterest,
      pressureToFindConversation
    );
  } else {
    root.conversationDirection = detectConversationForPeerPosts(
      root.children,
      /** @type {ThreadBranch} */(deepestBranch),
      totalBranchDepth,
      totalBranchInterest,
      pressureToFindConversation
    );
  }

  if (root.conversationDirection) {
    root.conversationDirection.isConversationReply = true;
  }

  for (const child of root.children) {
    if (root.conversationDirection) {
      if (child !== root.conversationDirection) {
        if (child.isSignificant || child.significantPostCount) {
          if (!root.asides) root.asides = [child];
          else root.asides.push(child);
        } else {
          if (!root.insignificants) root.insignificants = [child];
          else root.insignificants.push(child);
        }
      }
    }

    discoverConversations(
      child,
      child === root.conversationDirection ? true : false);
  }
}

/**
 * @param {ThreadBranch[]} branches
 * @param {ThreadBranch} deepestBranch
 * @param {number} totalBranchDepth
 * @param {number} totalBranchInterest
 * @param {boolean} pressureToFindConversation
 */
function detectConversationForPeerPosts(
  branches,
  deepestBranch,
  totalBranchDepth,
  totalBranchInterest,
  pressureToFindConversation
) {

  const DEEPEST_BRANCH_DEPTH_OVERWHELM_AVERAGE_FACTOR =
    pressureToFindConversation ? 1.2 : 1.6;

  const DEEPST_BRANCH_INTEREST_OVERWHELM_AVERAGE_FACTOR =
    1.2;

  // conversation either starts in one, or it's a forum of these
  const deepestBranchDepth = deepestBranch?.maxBranchDepth || 0;
  if (branches.length === 1) {
    return branches[0];
  } else {
    const averageDepthExceptMax = (totalBranchDepth - deepestBranchDepth) / (branches.length - 1);
    if (deepestBranchDepth > averageDepthExceptMax * DEEPEST_BRANCH_DEPTH_OVERWHELM_AVERAGE_FACTOR) {
      return deepestBranch;
    } else {
      if (pressureToFindConversation) {
        const deepestBranchInterest = deepestBranch?.branchInterestWeight || 0;
        const averageInterestExceptMaxDepth = (totalBranchInterest - deepestBranchInterest) / (branches.length - 1);
        if (deepestBranchInterest > averageInterestExceptMaxDepth * DEEPST_BRANCH_INTEREST_OVERWHELM_AVERAGE_FACTOR) {
          return deepestBranch;
        }
      }
    }
  }

}
