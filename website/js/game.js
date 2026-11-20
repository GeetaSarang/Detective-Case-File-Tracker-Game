// ============================================================
// game.js - the RULES of the game (no drawing here)
// ------------------------------------------------------------
// JavaScript version of cpp_application/GameLogic.h.
// The key rule is in Game.attempt(): every accusation is refused until
// 100% of the evidence nodes have been explored.
// ============================================================
window.DMG = window.DMG || {};

(function () {
  const T = DMG.Tree;
  const G = {};

  // Creates a new game state from the case data.
  G.create = function (data) {
    const root = T.build(data);
    const g = {
      data: data, root: root, all: T.preorder(root), total: T.countNodes(root),
      current: root, trail: [root], walkLog: [root.id],
      steps: 0, exploredCount: 1, incorrect: 0, blocked: 0, solved: false,
      startMs: null, endMs: null, lastFresh: true
    };
    root.explored = true;                 // the player begins by examining the crime scene
    return g;
  };

  // Puts an existing game back to the start (used by the automated experiment).
  G.reset = function (g) {
    for (let i = 0; i < g.all.length; i++) g.all[i].explored = false;
    g.root.explored = true;
    g.current = g.root; g.trail = [g.root]; g.walkLog = [g.root.id];
    g.steps = 0; g.exploredCount = 1; g.incorrect = 0; g.blocked = 0;
    g.solved = false; g.startMs = null; g.endMs = null; g.lastFresh = true;
  };

  G.start = function (g) { g.startMs = performance.now(); };

  // Seconds since the investigation started (or until it was solved).
  G.elapsed = function (g) {
    if (g.startMs === null) return 0;
    const end = g.solved ? g.endMs : performance.now();
    return (end - g.startMs) / 1000;
  };

  // Follow the left (true) or right (false) lead. Costs one step.
  G.followLead = function (g, goLeft) {
    const next = goLeft ? g.current.left : g.current.right;
    if (!next) return false;
    g.lastFresh = !next.explored;
    if (!next.explored) { next.explored = true; g.exploredCount++; }
    g.current = next; g.trail.push(next); g.walkLog.push(next.id); g.steps++;
    return true;
  };

  // Walk back to the evidence that led here. Costs one step.
  G.goBack = function (g) {
    if (g.trail.length <= 1) return false;
    g.trail.pop();
    g.current = g.trail[g.trail.length - 1];
    g.lastFresh = false;
    g.walkLog.push(g.current.id); g.steps++;
    return true;
  };

  G.completeness = function (g) { return 100 * g.exploredCount / g.total; };
  G.allExplored = function (g) { return g.exploredCount === g.total; };

  // THE ACCUSATION RULE: refused until every lead is explored.
  // Returns 'BLOCKED', 'WRONG' or 'SOLVED'.
  G.attempt = function (g, suspectId) {
    if (!G.allExplored(g)) { g.blocked++; return 'BLOCKED'; }
    if (suspectId === g.data.culpritId) { g.solved = true; g.endMs = performance.now(); return 'SOLVED'; }
    g.incorrect++;
    return 'WRONG';
  };

  // Looks only at explored evidence: clues pointing at each suspect, and who is cleared.
  G.analyse = function (g) {
    const points = {}, cleared = {};
    for (let i = 0; i < g.all.length; i++) {
      const n = g.all[i];
      if (!n.explored) continue;
      n.pointsTo.forEach(function (id) { points[id] = (points[id] || 0) + 1; });
      n.clears.forEach(function (id) { cleared[id] = true; });
    }
    return { points: points, cleared: cleared };
  };

  // Best deduction from the evidence so far: the single uncleared suspect with the most
  // clues pointing at them. Returns 0 if inconclusive (no clues, or a tie).
  G.deduce = function (g) {
    const a = G.analyse(g);
    let best = 0, bestScore = 0, tie = false;
    g.data.suspects.forEach(function (s) {
      if (a.cleared[s.id]) return;
      const score = a.points[s.id] || 0;
      if (score > bestScore) { best = s.id; bestScore = score; tie = false; }
      else if (score === bestScore && score > 0) tie = true;
    });
    return (bestScore === 0 || tie) ? 0 : best;
  };

  // If the deduction is inconclusive, name the lowest-numbered suspect who is not cleared.
  G.fallback = function (g) {
    const a = G.analyse(g);
    const sorted = g.data.suspects.slice().sort(function (x, y) { return x.id - y.id; });
    for (let i = 0; i < sorted.length; i++) if (!a.cleared[sorted[i].id]) return sorted[i].id;
    return sorted[0].id;
  };

  // Explored evidence that clears a suspect (or null).
  G.clearingEvidence = function (g, suspectId) {
    for (let i = 0; i < g.all.length; i++) {
      const n = g.all[i];
      if (n.explored && n.clears.indexOf(suspectId) !== -1) return n;
    }
    return null;
  };

  // Leads that are visible but unexplored: [{from, lead}].
  G.openLeads = function (g) {
    const open = [];
    g.all.forEach(function (n) {
      if (!n.explored) return;
      if (n.left && !n.left.explored) open.push({ from: n, lead: n.left });
      if (n.right && !n.right.explored) open.push({ from: n, lead: n.right });
    });
    return open;
  };

  // 25% of 15 nodes -> 4 (rounded up), same as the C++ targetNodeCount().
  G.targetNodes = function (percent, total) { return Math.floor((percent * total + 99) / 100); };
  G.minSteps = function (g) { return 2 * (g.total - 1) - T.height(g.root); };

  DMG.Game = G;
})();
