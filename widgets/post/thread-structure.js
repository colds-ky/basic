// @ts-check

/**
 * @typedef {{
 *  post: import('../../package').MatchCompactPost,
 *  depth: number,
 *  branchPostCount: number,
 *  branchInterestWeight: number,
 *  maxBranchDepth: number,
 *  maxSignificantBranchDepth: number,
 *  maxDirectSignificantBranchDepth: number,
 *  isConversationReply: boolean,
 *  isSignificant: boolean,
 *  isLeadingToTargetPost: boolean,
 *  isParentOfSignificant: boolean,
 *  significantPostCount: number,
 *  children: ThreadBranch[] | undefined,
 *  conversationDirection?: ThreadBranch,
 *  insignificants: ThreadBranch[] | undefined,
 *  asides: ThreadBranch[] | undefined
 * }} ThreadBranch
 */

/**
 * @param {import('../../package').CompactThreadPostSet} thread
 * @param {(post: import('../../package').MatchCompactPost) => boolean | null | undefined} [isSignificantPost]
 */
export function threadStructure(thread, isSignificantPost) {
  /** @type {ThreadBranch} */
  const root = {
    post: thread.root,
    depth: 0,
    branchPostCount: 1,
    branchInterestWeight: initialInterestWeight(thread.root),
    maxBranchDepth: 1,
    maxSignificantBranchDepth: 1,
    maxDirectSignificantBranchDepth: 1,
    isConversationReply: false,
    isSignificant: true,
    isLeadingToTargetPost: true,
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

  /** @type {Map<string, ThreadBranch>} */
  const allocatedById = new Map();
  allocatedById.set(root.post.uri, root);

  /** @type {Set<string>} */
  const toAggregateURIs = new Set();
  for (const post of thread.all) {
    toAggregateURIs.add(post.uri);
    allocatePost(post);
  }

  // populate children
  for (const branch of allocatedById.values()) {
    const parent = branch.post.replyTo && allocatedById.get(branch.post.replyTo) || root;
    if (parent === branch) continue;

    if (!parent.children) parent.children = [branch];
    else parent.children.push(branch);
  }

  aggregateChildren(root);

  discoverConversations(root, false);

  return root;

  /**
   * @param {import('../../package').CompactPost} post 
   */
  function allocatePost(post) {
    const alreadyAllocated = allocatedById.get(post.uri);
    if (alreadyAllocated) return alreadyAllocated;

    const isSignificant = isSignificantPost?.(post) || false;

    /** @type {ThreadBranch} */
    const allocatedPost = {
      post,
      depth: 0,
      branchPostCount: 1,
      branchInterestWeight: initialInterestWeight(post),
      maxBranchDepth: 1,
      maxSignificantBranchDepth: isSignificant ? 1 : 0,
      maxDirectSignificantBranchDepth: isSignificant ? 1 : 0,
      isConversationReply: false,
      isSignificant: isSignificant,
      isLeadingToTargetPost: post.uri === thread.current.uri || post.uri === thread.current.replyTo,
      isParentOfSignificant: false,
      significantPostCount: 0,
      children: undefined,
      conversationDirection: undefined,
      insignificants: undefined,
      asides: undefined
    };

    allocatedById.set(post.uri, allocatedPost);
    return allocatedPost;
  }

  /**
   * @param {import('../../package').CompactPost} post 
   */
  function initialInterestWeight(post) {
    return post.likeCount || 1;
  }

  /**
   * @param {ThreadBranch} parent 
   */
  function aggregateChildren(parent) {
    parent.branchPostCount = 0;
    parent.significantPostCount = 0;
    parent.maxBranchDepth = 0;

    parent.branchInterestWeight = 0;
    parent.maxBranchDepth = 0;
    parent.maxSignificantBranchDepth = 0;
    parent.maxDirectSignificantBranchDepth = 0;
    if (parent.children) {
      for (const ancestorChild of parent.children) {
        ancestorChild.depth = parent.depth + 1;
        aggregateChildren(ancestorChild);

        parent.branchPostCount += ancestorChild.branchPostCount + 1;
        parent.significantPostCount += ancestorChild.significantPostCount;

        if (ancestorChild.isLeadingToTargetPost) parent.isLeadingToTargetPost = true;

        if (ancestorChild.isSignificant) {
          parent.significantPostCount++;
          parent.isParentOfSignificant = true;
          parent.maxDirectSignificantBranchDepth = Math.max(
            parent.maxDirectSignificantBranchDepth,
            ancestorChild.maxDirectSignificantBranchDepth + 1);

          const SIGNIFICANT_BRANCH_INTEREST_INCREASE_FACTOR = 2;
          parent.branchInterestWeight += ancestorChild.branchInterestWeight * SIGNIFICANT_BRANCH_INTEREST_INCREASE_FACTOR;
        } else {
          parent.branchInterestWeight += ancestorChild.branchInterestWeight;
        }

        if (ancestorChild.significantPostCount || ancestorChild.isSignificant) {
          parent.maxSignificantBranchDepth = Math.max(
            parent.maxSignificantBranchDepth,
            ancestorChild.maxSignificantBranchDepth + 1);
        }

        parent.maxBranchDepth = Math.max(
          parent.maxBranchDepth,
          ancestorChild.maxBranchDepth + 1);
      }
    }
  }
}

/**
 * @param {ThreadBranch} convoStarter
 * @param {boolean} pressureToFindConversation
 */
function discoverConversations(convoStarter, pressureToFindConversation) {
  if (!convoStarter.children?.length) return;

  /** @type {ThreadBranch | undefined} */
  let branchLeadingToTargetPost;

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

  for (const child of convoStarter.children) {
    if (child.isLeadingToTargetPost) {
      branchLeadingToTargetPost = child;
    }

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

  if (branchLeadingToTargetPost) {
    convoStarter.conversationDirection = branchLeadingToTargetPost;
  } else if (directSignificantBranches.length) {
    convoStarter.conversationDirection = detectConversationForPeerPosts(
      directSignificantBranches,
      /** @type {ThreadBranch} */(deepestDirectSignificantBranch),
      totalDirectSignificantBranchDepth,
      totalDirectSignificantBranchInterest,
      pressureToFindConversation
    );
  } else if (significantBranches.length) {
    convoStarter.conversationDirection = detectConversationForPeerPosts(
      significantBranches,
      /** @type {ThreadBranch} */(deepestSignificantBranch),
      totalSignificantBranchDepth,
      totalSignificantBranchInterest,
      pressureToFindConversation
    );
  } else {
    convoStarter.conversationDirection = detectConversationForPeerPosts(
      convoStarter.children,
      /** @type {ThreadBranch} */(deepestBranch),
      totalBranchDepth,
      totalBranchInterest,
      pressureToFindConversation
    );

    if (!convoStarter.conversationDirection) {
      convoStarter.insignificants = convoStarter.children;
    }
  }

  if (convoStarter.conversationDirection) {
    convoStarter.conversationDirection.isConversationReply = true;
  }

  for (const child of convoStarter.children) {
    if (convoStarter.conversationDirection) {
      if (child !== convoStarter.conversationDirection) {
        if (child.isSignificant || child.significantPostCount) {
          if (!convoStarter.asides) convoStarter.asides = [child];
          else convoStarter.asides.push(child);
        } else {
          if (!convoStarter.insignificants) convoStarter.insignificants = [child];
          else convoStarter.insignificants.push(child);
        }
      }
    }

    discoverConversations(
      child,
      child === convoStarter.conversationDirection ? true : false);
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
