// ============================================================
// app.js - connects the page (HTML) to the game rules and the drawings
// ------------------------------------------------------------
// Sections: routing, play page, visualizer page, learn page, statistics page.
// ============================================================
(function () {
  const T = DMG.Tree, G = DMG.Game, V = DMG.Viz, E = DMG.Exp, D = DMG.caseData;
  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtTime(sec) {
    if (sec < 60) return sec.toFixed(1) + ' s';
    const m = Math.floor(sec / 60);
    return m + ' min ' + (sec - m * 60).toFixed(0) + ' s';
  }
  function suspectName(id) {
    const s = D.suspects.find(function (x) { return x.id === id; });
    return s ? s.name : '?';
  }

  // coloured circle with the first letter of a suspect's name
  const AVATAR_COLORS = ['#3f4fc4', '#f2603f', '#12a58a', '#c2410c', '#8b5cf6', '#db2777'];
  function avatar(s) {
    return '<span class="avatar" style="background:' + AVATAR_COLORS[(s.id - 1) % AVATAR_COLORS.length] + '">' + esc(s.name.charAt(0)) + '</span>';
  }
  function sortedSuspects() { return D.suspects.slice().sort(function (a, b) { return a.id - b.id; }); }

  // ===================== routing =====================
  const pages = ['home', 'play', 'visualizer', 'lab', 'learn', 'stats'];
  const onShow = {};

  function route() {
    const h = (location.hash || '#home').slice(1);
    const page = pages.indexOf(h) !== -1 ? h : 'home';
    pages.forEach(function (p) { $('#page-' + p).classList.toggle('active', p === page); });
    $$('#nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-page') === page); });
    window.scrollTo(0, 0);
    if (onShow[page]) onShow[page]();
  }

  // ===================== PLAY =====================
  let game = null;          // the current game state
  let started = false;      // has the player pressed "Start investigation"?
  let targetPercent = 0;    // experiment mode: 0 = free play
  let targetHandled = false;
  let selectedSuspect = 0;
  const ruledOut = {};      // the player's own notes: suspect id -> true
  let ticker = null;

  function modeName() { return targetPercent === 0 ? 'free_play' : 'target_' + targetPercent; }

  function newGame() {
    game = G.create(D);
    started = false;
    targetHandled = false;
    selectedSuspect = 0;
    Object.keys(ruledOut).forEach(function (k) { delete ruledOut[k]; });
    targetPercent = parseInt($('#modeSelect').value, 10);
    $('#resultOverlay').classList.add('hidden');
    $('#introOverlay').classList.remove('hidden');
    $('#banner').classList.add('hidden');
    $('#feedback').classList.add('hidden');
    $('#accusePanel').classList.remove('ready');
    if (ticker) { clearInterval(ticker); ticker = null; }
    renderAll();
  }

  function startGame() {
    $('#introOverlay').classList.add('hidden');
    targetPercent = parseInt($('#modeSelect').value, 10);
    G.start(game);
    started = true;
    if (targetPercent > 0) {
      showBanner('Experiment mode: when ' + targetPercent + '% of the leads (' + G.targetNodes(targetPercent, game.total) +
        ' of ' + game.total + ' nodes) are explored, an accusation attempt is made automatically and recorded.', false);
    }
    ticker = setInterval(function () { if (started && !game.solved) renderStats(); }, 250);
    renderAll();
  }

  function showBanner(text, good) {
    const b = $('#banner');
    b.textContent = text;
    b.classList.toggle('good', !!good);
    b.classList.remove('hidden');
  }

  function showFeedback(kind, html) {
    const f = $('#feedback');
    f.className = 'feedback ' + kind;
    f.innerHTML = html;
  }

  // ---- moving ----
  function follow(goLeft) {
    if (!started || game.solved) return;
    if (G.followLead(game, goLeft)) afterMove();
  }
  function back() {
    if (!started || game.solved) return;
    if (G.goBack(game)) afterMove();
  }
  function jumpToNode(node) {
    // From the tree: allow moving to a lead directly below, or to the previous node.
    if (!started || game.solved) return;
    if (game.current.left === node) follow(true);
    else if (game.current.right === node) follow(false);
    else if (game.trail.length > 1 && game.trail[game.trail.length - 2] === node) back();
  }

  function afterMove() {
    renderAll();
    if (targetPercent > 0 && !targetHandled && game.exploredCount >= G.targetNodes(targetPercent, game.total)) {
      targetHandled = true;
      if (!G.allExplored(game)) {
        // The experiment forces an accusation attempt at the target. The rule refuses it.
        G.attempt(game, 0);
        E.record(game, modeName(), 'BLOCKED');
        showBlocked();
        showBanner('Experiment target reached (' + targetPercent + '%). The accusation was REFUSED because only ' +
          game.exploredCount + ' of ' + game.total + ' leads are explored. Keep exploring to 100% to solve the case.', false);
      } else {
        showBanner('Experiment target reached (100%). Every lead is explored: choose a suspect and accuse.', true);
        $('#accusePanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      renderAll();
    }
    if (G.allExplored(game)) {
      $('#accusePanel').classList.add('ready');
      if (targetPercent === 0 || targetHandled) {
        if ($('#banner').classList.contains('hidden') || !$('#banner').classList.contains('good'))
          showBanner('Every lead has been explored. Study your notebook, choose a suspect and make your accusation.', true);
      }
    }
  }

  // ---- accusation ----
  function showBlocked() {
    const missing = game.total - game.exploredCount;
    const open = G.openLeads(game).map(function (o) {
      return '<li>#' + o.lead.id + ' ' + esc(o.lead.title) + ' <span class="hint">(from #' + o.from.id + ' ' + esc(o.from.title) + ')</span></li>';
    }).join('');
    showFeedback('blocked',
      '<b class="bad">Accusation refused.</b> The Chief Inspector will not sign a warrant: ' + missing + ' of ' + game.total +
      ' leads are still unexplored (completeness ' + Math.floor(G.completeness(game)) + '%). Finish every lead before accusing anyone.' +
      '<br>Open leads you can still follow:<ul>' + open + '</ul>');
  }

  function accuse() {
    if (!started || game.solved) return;
    if (!G.allExplored(game)) {                         // RULE: needs 100% completeness
      G.attempt(game, 0);
      E.record(game, modeName(), 'BLOCKED');
      showBlocked();
      renderStats();
      return;
    }
    if (!selectedSuspect) {
      showFeedback('info', 'All leads are explored. Select a suspect above, then press &ldquo;Make accusation&rdquo;.');
      return;
    }
    const result = G.attempt(game, selectedSuspect);
    E.record(game, modeName(), result);
    if (result === 'SOLVED') {
      if (ticker) { clearInterval(ticker); ticker = null; }
      renderAll();
      showResult();
    } else {
      const proof = G.clearingEvidence(game, selectedSuspect);
      showFeedback('wrong',
        '<b class="bad">Incorrect accusation: ' + esc(suspectName(selectedSuspect)) + ' is innocent.</b> ' +
        (proof
          ? 'Evidence #' + proof.id + ' (' + esc(proof.title) + ') clears them: ' + esc(proof.description)
          : 'Nothing in your notebook proves them guilty.') +
        '<br>Review your notebook and try again.');
      renderAll();
    }
  }

  function confetti() {
    const colors = ['#f2603f', '#ffbf3c', '#3f4fc4', '#12a58a', '#ff8fb1'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random() * 0.8) + 's';
      c.style.animationDuration = (2 + Math.random() * 1.5) + 's';
      document.body.appendChild(c);
      setTimeout(function () { c.remove(); }, 4200);
    }
  }

  function showResult() {
    confetti();
    const culprit = D.suspects.find(function (s) { return s.id === D.culpritId; });
    $('#resultTitle').textContent = 'You solved it: ' + culprit.name + ' is the culprit';
    $('#resultSolution').textContent = D.solution;
    $('#resultSuspects').innerHTML = D.suspects.slice().sort(function (a, b) { return a.id - b.id; }).map(function (s) {
      if (s.id === D.culpritId) return '<li class="guilty"><b>' + esc(s.name) + '</b>: GUILTY</li>';
      const p = G.clearingEvidence(game, s.id);
      return '<li class="clear"><b>' + esc(s.name) + '</b>: cleared by evidence #' + (p ? p.id + ' (' + esc(p.title) + ')' : '-') + '</li>';
    }).join('');
    $('#resultStats').innerHTML = statRows(true);
    DMG.FX.countUp($('#resultStats'));
    $('#resultOverlay').classList.remove('hidden');
  }

  // ---- rendering ----
  function statRows(extended) {
    const total = game.total;
    const rows = [
      ['Total evidence nodes', total],
      ['Explored leads', game.exploredCount],
      ['Unexplored leads', total - game.exploredCount],
      ['Lead completeness', G.completeness(game).toFixed(1) + '%'],
      ['Steps taken', game.steps],
      ['Time taken', fmtTime(G.elapsed(game))],
      ['Incorrect accusations', game.incorrect],
      ['Refused accusations', game.blocked]
    ];
    if (extended) {
      rows.push(['Fewest possible steps', G.minSteps(game)]);
      rows.push(['Tree height / leaf nodes', T.height(game.root) + ' / ' + T.countLeaves(game.root)]);
    }
    return rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');
  }

  function renderStats() { $('#liveStats').innerHTML = statRows(false); }

  function renderEvidence() {
    const n = game.current;
    $('#evidenceCard').innerHTML =
      '<div class="meta"><span>EVIDENCE #' + n.id + ' &middot; <span class="type-badge" data-type="' + esc(n.type) + '">' + esc(n.type) + '</span></span>' +
      (game.lastFresh ? '<span class="stamp">NEW</span>' : '<span class="stamp old">ALREADY EXPLORED</span>') + '</div>' +
      '<h3>' + esc(n.title) + '</h3><p>' + esc(n.description) + '</p>';
    $('#evidenceCard').style.borderTopColor = '';
  }

  function leadButton(label, lead, goLeft) {
    return '<button class="lead" type="button" data-type="' + esc(lead.type) + '" data-dir="' + (goLeft ? 'L' : 'R') + '">' +
      '<span class="lead-label">' + label + ' &middot; <span class="type-badge" data-type="' + esc(lead.type) + '">' + esc(lead.type) + '</span></span>' +
      '<span class="lead-title">#' + lead.id + ' ' + esc(lead.title) + '</span>' +
      '<span class="pill ' + (lead.explored ? 'done' : 'new') + '">' + (lead.explored ? 'Explored' : 'Unexplored') + '</span></button>';
  }

  function renderLeads() {
    const n = game.current;
    let html = '';
    if (!n.left && !n.right) {
      html = '<div class="dead-end">This trail ends here: this is a final finding with no further leads. Go back and try another lead.</div>';
    } else {
      if (n.left) html += leadButton('Lead A (left)', n.left, true);
      if (n.right) html += leadButton('Lead B (right)', n.right, false);
    }
    const box = $('#leads');
    box.innerHTML = html;
    $$('#leads .lead').forEach(function (b) {
      b.addEventListener('click', function () { follow(b.getAttribute('data-dir') === 'L'); });
    });
    $('#btnBack').disabled = !started || game.trail.length <= 1;
  }

  function renderNotebook() {
    const items = game.all.filter(function (n) { return n.explored; });
    $('#nbCount').textContent = items.length + ' / ' + game.total + ' entries';
    $('#notebook').innerHTML = items.map(function (n) {
      return '<div class="nb-item"><b>#' + n.id + ' ' + esc(n.title) + '</b> <span class="type-badge" data-type="' + esc(n.type) + '">' + esc(n.type) + '</span><p>' + esc(n.description) + '</p></div>';
    }).join('');
  }

  function renderSuspects() {
    const box = $('#suspects');
    box.innerHTML = D.suspects.slice().sort(function (a, b) { return a.id - b.id; }).map(function (s) {
      return '<div class="suspect' + (selectedSuspect === s.id ? ' selected' : '') + (ruledOut[s.id] ? ' ruled' : '') + '" data-id="' + s.id + '" tabindex="0" role="button" aria-pressed="' + (selectedSuspect === s.id) + '">' +
        '<span class="s-top">' + avatar(s) + '<span><span class="s-name">' + esc(s.name) + '</span><br><span class="s-role">' + esc(s.role) + '</span></span></span>' +
        '<span class="s-desc">' + esc(s.description) + '</span>' +
        '<label><input type="checkbox" class="rule" ' + (ruledOut[s.id] ? 'checked' : '') + '> Rule out (my note)</label></div>';
    }).join('');
    $$('#suspects .suspect').forEach(function (card) {
      const id = parseInt(card.getAttribute('data-id'), 10);
      function select() { selectedSuspect = id; renderSuspects(); }
      card.addEventListener('click', function (e) { if (e.target.closest('label')) return; select(); });
      card.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('label')) { e.preventDefault(); select(); } });
      card.querySelector('.rule').addEventListener('change', function (e) { ruledOut[id] = e.target.checked; renderSuspects(); });
    });
  }

  function renderTree() {
    V.render($('#playTree'), game.root, {
      unitX: 46, unitY: 62, radius: 16,
      current: game.current, walkLog: game.walkLog,
      fresh: (started && game.lastFresh && game.steps > 0) ? game.current : null,
      onNodeClick: jumpToNode,
      clickable: function (node) {
        return started && !game.solved && (game.current.left === node || game.current.right === node ||
          (game.trail.length > 1 && game.trail[game.trail.length - 2] === node));
      }
    });
  }

  function renderProgress() {
    const pct = G.completeness(game);
    $('#progText').textContent = pct.toFixed(1) + '%  (' + game.exploredCount + ' / ' + game.total + ' leads)';
    $('#progFill').style.width = pct + '%';
    $('#progBar').setAttribute('aria-valuenow', Math.round(pct));
  }

  // Circle meter next to the statistics.
  function renderRing() {
    V.ring($('#ring'), G.completeness(game), game.exploredCount + '/' + game.total);
  }

  // Suspect board: red dots = clues found against the suspect, green tag = cleared by proof.
  function renderBoard() {
    const a = G.analyse(game);
    $('#board').innerHTML = sortedSuspects().map(function (sp) {
      const n = a.points[sp.id] || 0;
      let pips = '';
      for (let i = 0; i < 4; i++) pips += '<i class="pip' + (i < n ? ' on' : '') + '"></i>';
      const cleared = !!a.cleared[sp.id];
      return '<div class="board-row' + (cleared ? ' cleared' : '') + '">' + avatar(sp) +
        '<span class="s">' + esc(sp.name) + '<br><span class="pips" title="' + n + ' clue(s) against">' + pips + '</span></span>' +
        (cleared ? '<span class="tag clear">CLEARED</span>' : '<span class="tag">' + (n ? n + ' clue' + (n > 1 ? 's' : '') : 'no clues') + '</span>') + '</div>';
    }).join('');
  }

  // Leads explored after every step, compared with the best possible walk.
  function exploredSeries(g) {
    const seen = {}; seen[g.walkLog[0]] = true;
    let count = 1; const out = [1];
    for (let i = 1; i < g.walkLog.length; i++) {
      if (!seen[g.walkLog[i]]) { seen[g.walkLog[i]] = true; count++; }
      out.push(count);
    }
    return out;
  }
  function idealSeries(root) {
    const moves = [];                                  // true = a forward move to a new node
    (function walk(n) {
      [n.left, n.right].forEach(function (c) { if (c) { moves.push(true); walk(c); moves.push(false); } });
    })(root);
    while (moves.length && moves[moves.length - 1] === false) moves.pop();   // stop on the last new node
    let c = 1; const out = [1];
    moves.forEach(function (m) { if (m) c++; out.push(c); });
    return out;
  }
  function drawStepChart(container) {
    const mine = exploredSeries(game);
    V.lineChart(container, 'Leads explored after each step',
      [{ values: idealSeries(game.root), cls: 'line2' }, { values: mine, cls: 'line', dots: mine.length < 40 }],
      game.total, 'steps taken', 'leads explored');
  }

  function renderAll() {
    renderProgress(); renderEvidence(); renderLeads(); renderNotebook(); renderTree(); renderStats();
    renderRing(); renderBoard(); drawStepChart($('#stepChart'));
    if (!$('#suspects').children.length) renderSuspects();
  }

  function initPlay() {
    $('#caseTitle').textContent = D.title;
    $('#introTitle').textContent = D.title;
    DMG.FX.words($('#introText'), D.intro);
    $('#introSuspects').innerHTML = sortedSuspects().map(function (s) {
      return '<li><b>' + esc(s.name) + '</b> <span>&middot; ' + esc(s.role) + '. ' + esc(s.description) + '</span></li>';
    }).join('');
    $('#btnStart').addEventListener('click', startGame);
    $('#btnRestart').addEventListener('click', newGame);
    $('#btnReplay').addEventListener('click', newGame);
    $('#btnBack').addEventListener('click', back);
    $('#btnAccuse').addEventListener('click', accuse);
    $('#modeSelect').addEventListener('change', function () {
      // Changing the mode starts a fresh investigation so each recorded session has one clear condition.
      newGame();
    });
    newGame();
  }

  onShow.play = function () { if (game) { renderAll(); } };

  // ===================== VISUALIZER =====================
  let vizSource = 'mine';
  let vizDemo = null;
  let vizHighlight = null, vizActive = null, vizTimer = null;
  let vizInspect = null;

  function vizGame() {
    if (vizSource === 'mine') return game;
    if (!vizDemo || vizDemo.percent !== vizSource) vizDemo = { percent: vizSource, g: E.exploreTo(D, parseInt(vizSource, 10)) };
    return vizDemo.g;
  }

  function badge(label, yes) { return '<span class="badge ' + (yes ? 'yes' : 'no') + '">' + (yes ? '&#10003; ' : '&#10007; ') + label + '</span>'; }

  function renderViz() {
    const g = vizGame();
    V.render($('#vizTree'), g.root, {
      unitX: 78, unitY: 92, radius: 22, levelLabels: true,
      current: vizSource === 'mine' ? g.current : null, walkLog: g.walkLog,
      reveal: $('#vizReveal').checked, highlight: vizHighlight, active: vizActive,
      onNodeClick: inspectNode
    });
    const total = T.countNodes(g.root), leaves = T.countLeaves(g.root);
    const rows = [
      ['Height (edges)', T.height(g.root)], ['Levels', T.height(g.root) + 1],
      ['Total nodes', total], ['Leaf nodes', leaves], ['Internal nodes', total - leaves],
      ['Explored nodes', g.exploredCount], ['Unexplored nodes', total - g.exploredCount],
      ['Completeness', G.completeness(g).toFixed(1) + '%']
    ];
    $('#vizMetrics').innerHTML = rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');
    $('#vizBadges').innerHTML = badge('Full', T.isFull(g.root)) + badge('Complete', T.isComplete(g.root)) + badge('Perfect', T.isPerfect(g.root));
    $('#pathOut').innerHTML = g.walkLog.map(function (id, i) {
      return (i ? '<span class="hint">&rarr;</span>' : '') + '<span class="chip' + (i === g.walkLog.length - 1 ? ' hot' : '') + '">' + id + '</span>';
    }).join('') + '<div class="trav-titles">' + (g.walkLog.length - 1) + ' steps' + (vizSource === 'mine' && !started ? ' (start the investigation on the Play page to build a path)' : '') + '</div>';
    if (vizInspect) inspectNode(vizInspect, true);
  }

  function inspectNode(node, keep) {
    vizInspect = node;
    const g = vizGame();
    const parentOpen = (function () {
      if (node === g.root) return true;
      const p = g.all.find(function (n) { return n.left === node || n.right === node; });
      return p && p.explored;
    })();
    const visible = node.explored || parentOpen || $('#vizReveal').checked;
    const depth = (function d(n, target, k) { if (!n) return -1; if (n === target) return k; const a = d(n.left, target, k + 1); return a >= 0 ? a : d(n.right, target, k + 1); })(g.root, node, 0);
    $('#inspector').innerHTML = visible
      ? '<b>#' + node.id + ' ' + esc(node.title) + '</b> &middot; ' + esc(node.type) + '<br>Level ' + depth + ' &middot; ' +
        (node.left || node.right ? 'internal node: 2 leads (#' + node.left.id + ' and #' + node.right.id + ')' : 'leaf node: final finding') +
        ' &middot; ' + (node.explored ? 'explored' : 'not explored yet') +
        (node.explored ? '<br>' + esc(node.description) : '')
      : '<b>Locked lead.</b> Explore its parent evidence first (or tick &ldquo;Reveal&rdquo; to see it).';
  }

  // ---- traversal player: builds a list of small steps, then plays them ----
  const travInfo = {
    preorder: 'Preorder: visit the Root, then the whole Left subtree, then the whole Right subtree.',
    inorder: 'Inorder: Left subtree, then the Root, then the Right subtree.',
    postorder: 'Postorder: Left subtree, Right subtree, and the Root last.',
    level: 'Level-order: one level at a time, left to right, using a queue.'
  };
  const travCode = {
    preorder: ['preorder(node):', '  if node is empty: return', '  visit(node)', '  preorder(node.left)', '  preorder(node.right)'],
    inorder: ['inorder(node):', '  if node is empty: return', '  inorder(node.left)', '  visit(node)', '  inorder(node.right)'],
    postorder: ['postorder(node):', '  if node is empty: return', '  postorder(node.left)', '  postorder(node.right)', '  visit(node)'],
    level: ['queue = [root]', 'while queue is not empty:', '  node = dequeue()', '  visit(node)', '  enqueue(node.left, node.right)']
  };
  let trKind = null, trSteps = [], trIdx = -1, trTimer = null;

  // One step = { node, stack|queue (arrays of ids), visit (bool), line, msg }
  function buildTrace(kind, root) {
    const steps = [];
    if (kind === 'level') {
      const queue = [root];
      steps.push({ node: null, queue: [root.id], line: 0, msg: 'Put the root (' + root.id + ') into the queue.' });
      while (queue.length) {
        const cur = queue.shift();
        steps.push({ node: cur, queue: queue.map(function (n) { return n.id; }), line: 2, msg: 'Dequeue ' + cur.id + ' from the front of the queue.' });
        steps.push({ node: cur, queue: queue.map(function (n) { return n.id; }), line: 3, visit: true, msg: 'VISIT ' + cur.id + ' (' + cur.title + ').' });
        if (cur.left) queue.push(cur.left);
        if (cur.right) queue.push(cur.right);
        steps.push({ node: cur, queue: queue.map(function (n) { return n.id; }), line: 4, msg: 'Add the children of ' + cur.id + ' to the back of the queue.' });
      }
      return steps;
    }
    const lineOf = { preorder: { visit: 2 }, inorder: { visit: 3 }, postorder: { visit: 4 } }[kind];
    const stack = [];
    function snap() { return stack.map(function (n) { return n.id; }); }
    function rec(n) {
      stack.push(n);
      steps.push({ node: n, stack: snap(), line: 0, msg: kind + '(' + n.id + ') is called and pushed on the stack.' });
      if (kind === 'preorder') steps.push({ node: n, stack: snap(), line: lineOf.visit, visit: true, msg: 'VISIT ' + n.id + ' (' + n.title + ').' });
      if (n.left) rec(n.left);
      if (kind === 'inorder') steps.push({ node: n, stack: snap(), line: lineOf.visit, visit: true, msg: 'Left side done. VISIT ' + n.id + ' (' + n.title + ').' });
      if (n.right) rec(n.right);
      if (kind === 'postorder') steps.push({ node: n, stack: snap(), line: lineOf.visit, visit: true, msg: 'Both sides done. VISIT ' + n.id + ' (' + n.title + ').' });
      stack.pop();
      steps.push({ node: n, stack: snap(), line: 1, msg: kind + '(' + n.id + ') finished and is popped off the stack.' });
    }
    rec(root);
    return steps;
  }

  function trDelay() { return [1100, 800, 550, 320, 150][parseInt($('#trSpeed').value, 10) - 1]; }

  function trPaint() {
    const st = trSteps[trIdx];
    const out = $('#travOut'), box = $('#memBox');
    const visited = [];
    vizHighlight = new Set();
    for (let i = 0; i <= trIdx; i++) if (trSteps[i].visit) { visited.push(trSteps[i].node); vizHighlight.add(trSteps[i].node); }
    vizActive = st ? st.node : null;
    out.innerHTML = visited.map(function (n, i) { return '<span class="chip hot' + (i === visited.length - 1 && st.visit ? ' pop' : '') + '">' + n.id + '</span>'; }).join('');
    if (st) {
      const items = st.queue || st.stack || [];
      box.className = st.queue ? 'queuebox' : 'stackbox';
      box.innerHTML = items.length ? items.map(function (id, i) {
        const top = st.queue ? i === 0 : i === items.length - 1;
        return '<span class="cell' + (top ? ' top' : '') + '">' + id + '</span>';
      }).join('') : '<span class="hint">empty</span>';
      $('#trLog').innerHTML = '<b>Step ' + (trIdx + 1) + ' of ' + trSteps.length + ':</b> ' + esc(st.msg);
      $('#trCode').innerHTML = travCode[trKind].map(function (l, i) { return i === st.line ? '<span class="on">' + esc(l) + '</span>' : esc(l); }).join('\n');
    }
    renderViz();
  }

  function trSetKind(kind) {
    trStop();
    const g = vizGame();
    trKind = kind; trSteps = buildTrace(kind, g.root); trIdx = -1;
    $$('.trav-buttons .btn').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-trav') === kind); });
    $('#travDesc').textContent = travInfo[kind];
    $('#memTitle').textContent = kind === 'level' ? 'Queue (front on the left)' : 'Recursion call stack (top is yellow)';
    $('#memBox').className = kind === 'level' ? 'queuebox' : 'stackbox';
    $('#memBox').innerHTML = '<span class="hint">empty</span>';
    $('#travOut').innerHTML = '';
    $('#trLog').textContent = 'Press Play, or Next step to go one step at a time.';
    $('#trCode').innerHTML = travCode[kind].map(esc).join('\n');
    vizHighlight = new Set(); vizActive = null;
    renderViz();
  }
  function trStop() {
    if (trTimer) { clearInterval(trTimer); trTimer = null; }
    const b = $('#trPlay'); if (b) b.innerHTML = '&#9654; Play';
  }
  function trNext() {
    if (!trKind) trSetKind('preorder');
    if (trIdx >= trSteps.length - 1) {
      trStop();
      const order = trSteps.filter(function (x) { return x.visit; }).map(function (x) { return x.node; });
      $('#trLog').innerHTML = '<b>Finished.</b> Visit order: ' + order.map(function (n) { return n.id; }).join(', ') + '.';
      vizActive = null; renderViz();
      return;
    }
    trIdx++;
    trPaint();
  }
  function trPlay() {
    if (trTimer) { trStop(); return; }
    if (!trKind) trSetKind('preorder');
    if (trIdx >= trSteps.length - 1) { trSetKind(trKind); }
    $('#trPlay').innerHTML = '&#10074;&#10074; Pause';
    trNext();
    trTimer = setInterval(trNext, trDelay());
  }

  function initViz() {
    $('#vizSource').addEventListener('change', function (e) {
      vizSource = e.target.value; vizHighlight = null; vizActive = null; vizInspect = null;
      if (trKind) trSetKind(trKind); else renderViz();
    });
    $('#vizReveal').addEventListener('change', renderViz);
    $$('.trav-buttons .btn').forEach(function (b) {
      b.addEventListener('click', function () { trSetKind(b.getAttribute('data-trav')); });
    });
    $('#trPlay').addEventListener('click', trPlay);
    $('#trStep').addEventListener('click', function () { trStop(); trNext(); });
    $('#trReset').addEventListener('click', function () { if (trKind) trSetKind(trKind); });
    $('#trSpeed').addEventListener('input', function () { if (trTimer) { clearInterval(trTimer); trTimer = setInterval(trNext, trDelay()); } });
    $('#trCode').innerHTML = travCode.preorder.map(esc).join('\n');
  }
  onShow.visualizer = function () { trStop(); trKind = null; vizHighlight = null; vizActive = null; renderViz(); };

  // ===================== LEARN =====================
  function initLearn() {
    $$('svg[data-demo]').forEach(function (svg) {
      V.render(svg, T.demo(parseInt(svg.getAttribute('data-demo'), 10)), { plain: true, unitX: 46, unitY: 56, radius: 15 });
    });
    $$('[data-props-for]').forEach(function (box) {
      const root = T.demo(parseInt(box.getAttribute('data-props-for'), 10));
      box.innerHTML = badge('Full', T.isFull(root)) + badge('Complete', T.isComplete(root)) + badge('Perfect', T.isPerfect(root)) +
        '<span class="badge no">' + T.countNodes(root) + ' nodes</span><span class="badge no">height ' + T.height(root) + '</span>';
    });
    // suspect BST: inserted in the same order as the data file (3, 1, 4, 2, 5)
    let bst = null;
    function insert(node, s) {
      if (!node) { const n = T.makeNode(s.id, s.name, s.role, ''); n.explored = true; return n; }
      if (s.id < node.id) node.left = insert(node.left, s); else if (s.id > node.id) node.right = insert(node.right, s);
      return node;
    }
    D.suspects.forEach(function (s) { bst = insert(bst, s); });
    V.render($('#suspectBst'), bst, { plain: true, unitX: 56, unitY: 58, radius: 16 });
  }

  // ===================== STATS =====================
  function renderAttemptLog() {
    const log = E.getLog();
    const body = $('#attemptTable tbody');
    body.innerHTML = log.length ? log.map(function (r) {
      return '<tr><td>' + esc(r.timestamp) + '</td><td>' + esc(r.mode) + '</td><td>' + r.completeness.toFixed(1) + '%</td><td>' + r.explored + '/' + r.total +
        '</td><td>' + r.steps + '</td><td>' + r.elapsed.toFixed(2) + '</td><td class="o-' + r.outcome + '">' + r.outcome + '</td><td>' + (r.accepted ? 'yes' : 'no') + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="empty">No attempts yet. Play a game and press &ldquo;Make accusation&rdquo;, or use Experiment mode.</td></tr>';
    $('#logNote').textContent = log.length + ' attempt(s) stored in this browser.';
  }

  function renderCppResults() {
    const R = window.DMG.cppResults;
    if (!R || !R.experiment || !R.experiment.length) {
      $('#cppNote').textContent = 'No C++ results found. Run the C++ program (menu option 3) and then export_results_to_website.py.';
      return;
    }
    $('#cppNote').textContent = 'These rows were copied unchanged from experiments/experiment_results.csv and scaling_results.csv, produced by the C++ program with std::chrono. Times depend on the computer that ran it: run the program yourself for your own numbers.';
    $('#cppTable thead').innerHTML = '<tr><th>Order</th><th>Target</th><th>Avg nodes</th><th>Completeness</th><th>Avg steps</th><th>Avg time (&micro;s)</th><th>Accepted</th><th>Solved</th><th>Deduction correct</th></tr>';
    $('#cppTable tbody').innerHTML = R.experiment.map(function (r) {
      return '<tr><td>' + r.strategy + '</td><td>' + r.target_percent + '%</td><td>' + r.avg_explored_nodes + '</td><td>' + r.avg_lead_completeness_percent + '%</td><td>' +
        r.avg_steps + '</td><td>' + r.avg_solve_time_us + '</td><td>' + r.accusation_accepted_percent + '%</td><td>' + r.case_solved_percent + '%</td><td>' + r.deduction_correct_percent + '%</td></tr>';
    }).join('');
    $('#scaleTable thead').innerHTML = '<tr><th>Height</th><th>Nodes</th><th>Target</th><th>Explored</th><th>Steps</th><th>Avg time (ms)</th><th>ns / step</th><th>Accepted</th></tr>';
    $('#scaleTable tbody').innerHTML = R.scaling.map(function (r) {
      return '<tr><td>' + r.tree_height + '</td><td>' + r.total_nodes + '</td><td>' + r.target_percent + '%</td><td>' + r.explored_nodes + '</td><td>' + r.steps +
        '</td><td>' + r.avg_time_ms + '</td><td>' + r.ns_per_step + '</td><td>' + r.accusation_accepted_percent + '%</td></tr>';
    }).join('');
    const big = R.scaling.filter(function (r) { return r.tree_height === '17'; });
    if (big.length) {
      V.barChart($('#scaleChart'), 'C++ measured: time to explore, tree of ' + big[0].total_nodes + ' nodes',
        big.map(function (r) { return r.target_percent + '%'; }), big.map(function (r) { return parseFloat(r.avg_time_ms); }), 'ms', true);
    }
  }

  function renderStatsNow() {
    $('#statsNow').innerHTML = game ? statRows(true) : '<div><dt>No investigation yet</dt><dd>-</dd></div>';
    if (game) drawStepChart($('#statsChart'));
  }

  function runBot() {
    const runs = parseInt($('#botRuns').value, 10);
    const btn = $('#btnBot');
    btn.disabled = true; btn.textContent = 'Running...';
    setTimeout(function () {                      // let the button text repaint first
      const rows = E.runAll(D, runs);
      $('#botTable tbody').innerHTML = rows.map(function (r) {
        return '<tr><td>' + r.strategy + '</td><td>' + r.percent + '%</td><td>' + r.avgExplored.toFixed(2) + '</td><td>' + r.completeness.toFixed(1) + '%</td><td>' +
          r.avgSteps.toFixed(2) + '</td><td>' + r.avgUs.toFixed(2) + '</td><td>' + r.acceptedPct.toFixed(1) + '%</td><td>' + r.solvedPct.toFixed(1) + '%</td><td>' + r.deductionPct.toFixed(1) + '%</td></tr>';
      }).join('');
      const dfs = rows.filter(function (r) { return r.strategy === 'dfs'; });
      V.barChart($('#botChart'), 'JavaScript measured: average steps (depth-first order)',
        dfs.map(function (r) { return r.percent + '%'; }), dfs.map(function (r) { return r.avgSteps; }), '', false);
      V.lineChart($('#botLine'), 'JavaScript measured: steps vs completeness (depth-first)',
        [{ values: dfs.map(function (r) { return r.avgSteps; }), cls: 'line', dots: true }], 30, '25% / 50% / 75% / 100% of leads', 'average steps');
      btn.disabled = false; btn.textContent = 'Run experiment again';
    }, 30);
  }

  function initStats() {
    $('#btnCsv').addEventListener('click', function () { E.download(E.toCSV(E.getLog()), 'human_sessions_website.csv'); });
    $('#btnClearLog').addEventListener('click', function () { E.clearLog(); renderAttemptLog(); });
    $('#btnBot').addEventListener('click', runBot);
    renderCppResults();
  }
  onShow.stats = function () { renderStatsNow(); renderAttemptLog(); };
  onShow.lab = function () { DMG.Lab.show(); };

  // ===================== HOME =====================
  function initHome() {
    const victimCard = '<div class="mug victim"><span class="ribbon">VICTIM</span><span class="avatar" style="background:#6b6b80">' + esc(D.victim.charAt(0)) +
      '</span><b>' + esc(D.victim) + '</b><span class="role">Owner of Sharma Jewellers</span><p>Aged 62. Found at his study desk on Diwali night. He had just found out a secret about the shop.</p></div>';
    $('#homeSuspects').innerHTML = victimCard + sortedSuspects().map(function (s) {
      return '<div class="mug">' + avatar(s) + '<b>' + esc(s.name) + '</b><span class="role">' + esc(s.role) + '</span><p>' + esc(s.description) + '</p></div>';
    }).join('');
    // a small tree that lights up node by node (depth-first), then starts again
    const root = T.build(D);
    const order = T.preorder(root);
    let i = 1;
    order.forEach(function (n) { n.explored = false; });
    root.explored = true;
    function draw() {
      V.render($('#heroTree'), root, { unitX: 34, unitY: 56, radius: 13, current: order[i - 1] });
    }
    draw();
    setInterval(function () {
      if (!$('#page-home').classList.contains('active')) return;
      if (i >= order.length + 2) { order.forEach(function (n) { n.explored = false; }); root.explored = true; i = 1; }
      else if (i < order.length) { order[i].explored = true; i++; }
      else i++;
      draw();
    }, 650);
  }

  // ===================== start =====================
  function init() {
    DMG.FX.init();
    DMG.FX.words($('#homeStory'), D.intro);
    initHome();
    DMG.Lab.init();
    initPlay(); initViz(); initLearn(); initStats();
    DMG.FX.reveal('#page-home .mug, #page-home .steps-grid li, #page-home .two-col .panel, #page-learn .kind, #page-learn .terms div, #page-learn .two-col .panel');
    window.addEventListener('hashchange', route);
    route();
  }

  // For automated tests only: lets a test script read the live game state.
  window.DMG.debug = { getGame: function () { return game; } };

  document.addEventListener('DOMContentLoaded', init);
})();
