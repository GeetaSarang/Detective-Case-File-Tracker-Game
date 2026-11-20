// ============================================================
// tree.js - binary tree functions in JavaScript
// ------------------------------------------------------------
// This is a JavaScript re-implementation of the functions in
// cpp_application/EvidenceTree.h. The website does NOT run the C++ code.
// A node is a plain object: { id, title, type, description, pointsTo, clears,
//                              explored, left, right }
// Height convention: empty tree = -1, a single node = 0.
// ============================================================
window.DMG = window.DMG || {};

(function () {
  const T = {};

  // Node creation.
  T.makeNode = function (id, title, type, description) {
    return {
      id: id, title: title || ('Node ' + id), type: type || '', description: description || '',
      pointsTo: [], clears: [], explored: false, left: null, right: null
    };
  };

  // Builds the evidence tree from the case data (each record names its parent and side).
  T.build = function (data) {
    const byId = {};
    let root = null;
    data.nodes.forEach(function (n) {
      const node = T.makeNode(n.id, n.title, n.type, n.description);
      node.pointsTo = n.pointsTo.slice();
      node.clears = n.clears.slice();
      byId[n.id] = node;
      if (n.side === 'ROOT') root = node;
      else if (n.side === 'L') byId[n.parent].left = node;    // left child link
      else byId[n.parent].right = node;                       // right child link
    });
    return root;
  };

  // Recursive traversals. Each returns an array of nodes in visiting order.
  T.preorder = function (n, out) {
    out = out || [];
    if (!n) return out;
    out.push(n); T.preorder(n.left, out); T.preorder(n.right, out);
    return out;
  };
  T.inorder = function (n, out) {
    out = out || [];
    if (!n) return out;
    T.inorder(n.left, out); out.push(n); T.inorder(n.right, out);
    return out;
  };
  T.postorder = function (n, out) {
    out = out || [];
    if (!n) return out;
    T.postorder(n.left, out); T.postorder(n.right, out); out.push(n);
    return out;
  };
  // Level-order (breadth-first) using a queue.
  T.levelOrder = function (root) {
    const out = [];
    if (!root) return out;
    const queue = [root];
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      out.push(cur);
      if (cur.left) queue.push(cur.left);
      if (cur.right) queue.push(cur.right);
    }
    return out;
  };

  // Counting.
  T.countNodes = function (n) { return n ? 1 + T.countNodes(n.left) + T.countNodes(n.right) : 0; };
  T.countLeaves = function (n) {
    if (!n) return 0;
    if (!n.left && !n.right) return 1;
    return T.countLeaves(n.left) + T.countLeaves(n.right);
  };
  T.height = function (n) { return n ? 1 + Math.max(T.height(n.left), T.height(n.right)) : -1; };

  // Search / evidence retrieval (general binary tree: may need both subtrees).
  T.findById = function (n, id) {
    if (!n) return null;
    if (n.id === id) return n;
    return T.findById(n.left, id) || T.findById(n.right, id);
  };

  // Full: every node has 0 or 2 children.
  T.isFull = function (n) {
    if (!n) return true;
    if (!n.left && !n.right) return true;
    if (n.left && n.right) return T.isFull(n.left) && T.isFull(n.right);
    return false;
  };

  // Complete: no real node may appear after a gap in level order.
  T.isComplete = function (root) {
    if (!root) return true;
    const queue = [root];
    let head = 0, seenGap = false;
    while (head < queue.length) {
      const cur = queue[head++];
      if (cur.left) { if (seenGap) return false; queue.push(cur.left); } else seenGap = true;
      if (cur.right) { if (seenGap) return false; queue.push(cur.right); } else seenGap = true;
    }
    return true;
  };

  // Perfect: full and all leaves on the same depth.
  function perfectHelper(n, depth, leafDepth) {
    if (!n) return true;
    if (!n.left && !n.right) return depth === leafDepth;
    if (!n.left || !n.right) return false;
    return perfectHelper(n.left, depth + 1, leafDepth) && perfectHelper(n.right, depth + 1, leafDepth);
  }
  T.isPerfect = function (root) {
    if (!root) return true;
    let leafDepth = 0, walker = root;
    while (walker.left) { walker = walker.left; leafDepth++; }
    return perfectHelper(root, 0, leafDepth);
  };
  T.perfectCount = function (h) { return Math.pow(2, h + 1) - 1; };

  // Small example trees for the learning page (same shapes as TreeDemo.h in C++).
  T.demo = function (shape) {
    const n = {};
    for (let i = 1; i <= 7; i++) { n[i] = T.makeNode(i, 'Node ' + i, 'Demo', ''); n[i].explored = true; }
    if (shape === 1) { n[1].left = n[2]; n[1].right = n[3]; n[2].left = n[4]; n[2].right = n[5]; n[3].left = n[6]; n[3].right = n[7]; }
    else if (shape === 2) { n[1].left = n[2]; n[1].right = n[3]; n[2].left = n[4]; n[2].right = n[5]; n[3].left = n[6]; }
    else if (shape === 3) { n[1].left = n[2]; n[1].right = n[3]; n[3].left = n[4]; n[3].right = n[5]; }
    else { n[1].left = n[2]; n[2].left = n[3]; n[3].left = n[4]; }
    return n[1];
  };

  // Layout for drawing: leaves are spaced evenly, a parent sits above its children.
  // Returns { items: [{node, x, depth, parent}], leaves, maxDepth } in preorder.
  T.layout = function (root) {
    let leafCounter = 0;
    const items = [];
    function place(node, depth, parent) {
      if (!node) return null;
      const item = { node: node, depth: depth, parent: parent, x: 0 };
      items.push(item);
      const l = place(node.left, depth + 1, item);
      const r = place(node.right, depth + 1, item);
      if (!l && !r) item.x = leafCounter++;
      else if (l && r) item.x = (l.x + r.x) / 2;
      else item.x = (l || r).x;
      return item;
    }
    place(root, 0, null);
    let maxDepth = 0;
    items.forEach(function (it) { if (it.depth > maxDepth) maxDepth = it.depth; });
    return { items: items, leaves: leafCounter, maxDepth: maxDepth };
  };

  DMG.Tree = T;
})();
