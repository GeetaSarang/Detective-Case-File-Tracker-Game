// ============================================================
// experiment.js - lead completeness vs solve time (browser version)
// ------------------------------------------------------------
// 1. A log of every accusation attempt (kept in the browser's localStorage,
//    downloadable as CSV in the same format as the C++ program writes).
// 2. An automated "computer detective" that explores 25/50/75/100% of the
//    leads, then accuses through the same rule as the game.
//    All numbers are measured when you press the button - none are typed in.
// ============================================================
window.DMG = window.DMG || {};

(function () {
  const G = DMG.Game;
  const E = {};
  const KEY = 'dmg_attempt_log_v1';
  let memoryLog = [];                       // fallback if localStorage is blocked

  // ---------- attempt log ----------
  E.getLog = function () {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return memoryLog; }
  };
  function saveLog(log) {
    memoryLog = log;
    try { localStorage.setItem(KEY, JSON.stringify(log)); } catch (e) { /* storage unavailable: keep in memory */ }
  }
  E.clearLog = function () { saveLog([]); };

  // Records one accusation attempt with the numbers at that moment.
  E.record = function (g, mode, outcome) {
    const log = E.getLog();
    log.push({
      timestamp: new Date().toLocaleString('sv-SE').replace('T', ' '),
      mode: mode,
      completeness: +G.completeness(g).toFixed(1),
      explored: g.exploredCount,
      total: g.total,
      steps: g.steps,
      elapsed: +G.elapsed(g).toFixed(2),
      outcome: outcome,
      accepted: outcome !== 'BLOCKED'
    });
    saveLog(log);
  };

  E.toCSV = function (log) {
    const lines = ['timestamp,mode,lead_completeness_percent,explored_nodes,total_nodes,steps,elapsed_seconds,outcome,accusation_accepted'];
    log.forEach(function (r) {
      lines.push([r.timestamp, r.mode, r.completeness.toFixed(1), r.explored, r.total, r.steps,
                  r.elapsed.toFixed(2), r.outcome, r.accepted ? 'YES' : 'NO'].join(','));
    });
    return lines.join('\n') + '\n';
  };

  E.download = function (text, filename) {
    const blob = new Blob([text], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  };

  // ---------- computer detective ----------
  // Small repeatable random number generator (so the "random" strategy gives the same results each time).
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Walk until "target" nodes are explored. random=false: left lead first (depth-first).
  function walk(g, target, random, rnd) {
    while (g.exploredCount < target) {
      const c = g.current;
      const canL = c.left && !c.left.explored, canR = c.right && !c.right.explored;
      let moved;
      if (canL && canR) moved = G.followLead(g, random ? rnd() < 0.5 : true);
      else if (canL) moved = G.followLead(g, true);
      else if (canR) moved = G.followLead(g, false);
      else moved = G.goBack(g);
      if (!moved) break;
    }
  }

  // One complete run: explore, deduce, accuse. Returns what happened.
  function oneRun(g, target, random, rnd) {
    walk(g, target, random, rnd);
    let suspect = G.deduce(g);
    const deductionOk = suspect === g.data.culpritId;
    if (suspect === 0) suspect = G.fallback(g);
    const result = G.attempt(g, suspect);
    return { deductionOk: deductionOk, result: result };
  }

  // Explores a fresh game to a given percentage (used for the visualizer demos).
  E.exploreTo = function (data, percent) {
    const g = G.create(data);
    walk(g, G.targetNodes(percent, g.total), false, Math.random);
    return g;
  };

  // Runs one condition many times. Timing: a whole batch is timed and divided by the number of
  // runs, because performance.now() is deliberately coarse in browsers.
  E.runCondition = function (data, percent, random, runs) {
    const g = G.create(data);
    const target = G.targetNodes(percent, g.total);
    const rnd = mulberry32(2026 + percent);

    // Pass 1 (not timed): statistics.
    let explored = 0, steps = 0, accepted = 0, solved = 0, deductionOk = 0;
    for (let i = 0; i < runs; i++) {
      G.reset(g);
      const r = oneRun(g, target, random, rnd);
      explored += g.exploredCount; steps += g.steps;
      if (r.result !== 'BLOCKED') accepted++;
      if (r.result === 'SOLVED') solved++;
      if (r.deductionOk) deductionOk++;
    }

    // Pass 2: time reset + run. Pass 3: time reset alone. Difference = time of the run itself.
    const rnd2 = mulberry32(2026 + percent);
    for (let i = 0; i < 200; i++) { G.reset(g); oneRun(g, target, random, rnd2); }     // warm-up
    let t0 = performance.now();
    for (let i = 0; i < runs; i++) { G.reset(g); oneRun(g, target, random, rnd2); }
    const withRuns = performance.now() - t0;
    t0 = performance.now();
    for (let i = 0; i < runs; i++) { G.reset(g); }
    const resetOnly = performance.now() - t0;
    const avgUs = Math.max(0, withRuns - resetOnly) * 1000 / runs;

    return {
      strategy: random ? 'random' : 'dfs', percent: percent, runs: runs,
      avgExplored: explored / runs, completeness: 100 * explored / runs / g.total,
      avgSteps: steps / runs, avgUs: avgUs,
      acceptedPct: 100 * accepted / runs, solvedPct: 100 * solved / runs, deductionPct: 100 * deductionOk / runs
    };
  };

  E.runAll = function (data, runs) {
    const rows = [];
    [false, true].forEach(function (random) {
      [25, 50, 75, 100].forEach(function (p) { rows.push(E.runCondition(data, p, random, runs)); });
    });
    return rows;
  };

  DMG.Exp = E;
})();
