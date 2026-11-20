// ============================================================
// lab.js - the "Tree Lab" page
// ------------------------------------------------------------
// Three small interactive experiments:
//   1. An editable binary tree with live Full / Complete / Perfect checks
//      that explain WHY a tree passes or fails.
//   2. A Binary SEARCH Tree of suspect ids: animated insert / search / inorder.
//   3. A search race: general binary tree (O(n)) versus BST (O(h)).
// Everything here is JavaScript. It does not run the C++ program.
// ============================================================
window.DMG = window.DMG || {};

(function () {
  const T = DMG.Tree, V = DMG.Viz;
  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  const MAX_NODES = 15;

  // ---------- small helpers ----------
  function plain(id) { const n = T.makeNode(id, 'Node ' + id, 'Demo', ''); n.explored = true; return n; }
  function badge(label, yes) { return '<span class="badge ' + (yes ? 'yes' : 'no') + '">' + (yes ? '&#10003; ' : '&#10007; ') + label + '</span>'; }
  function depthOf(root, target) {
    let found = -1;
    (function walk(n, d) { if (!n || found >= 0) return; if (n === target) { found = d; return; } walk(n.left, d + 1); walk(n.right, d + 1); })(root, 0);
    return found;
  }

  // ---------- explanations for the three checks ----------
  // Each returns { ok: boolean, text: string } so the page can say WHY.
  function whyFull(root) {
    if (!root) return { ok: true, text: 'The tree is empty, so there is nothing that breaks the rule.' };
    let bad = null;
    T.preorder(root).forEach(function (n) { if (!bad && (!!n.left !== !!n.right)) bad = n; });
    if (!bad) return { ok: true, text: 'Every node has 0 or 2 children.' };
    return { ok: false, text: 'Node ' + bad.id + ' has only a ' + (bad.left ? 'left' : 'right') + ' child. In a full tree a node has 0 or 2 children.' };
  }

  function whyComplete(root) {
    if (!root) return { ok: true, text: 'The tree is empty.' };
    const queue = [root];
    let head = 0, gap = null;
    while (head < queue.length) {
      const cur = queue[head++];
      const kids = [['left', cur.left], ['right', cur.right]];
      for (let i = 0; i < 2; i++) {
        if (kids[i][1]) {
          if (gap) return { ok: false, text: 'Node ' + cur.id + ' appears after a gap. The gap is the missing ' + gap.side + ' child of node ' + gap.node.id + '. In a complete tree nothing may come after a gap in level order.' };
          queue.push(kids[i][1]);
        } else if (!gap) gap = { node: cur, side: kids[i][0] };
      }
    }
    return { ok: true, text: 'Level by level there is no gap before the last real node.' };
  }

  function whyPerfect(root) {
    if (!root) return { ok: true, text: 'The tree is empty.' };
    const f = whyFull(root);
    if (!f.ok) return { ok: false, text: 'It is not full, so it cannot be perfect. (' + f.text + ')' };
    const leaves = T.preorder(root).filter(function (n) { return !n.left && !n.right; });
    const d0 = depthOf(root, leaves[0]);
    for (let i = 1; i < leaves.length; i++) {
      const d = depthOf(root, leaves[i]);
      if (d !== d0) return { ok: false, text: 'Leaves are on different levels: leaf ' + leaves[0].id + ' is on level ' + d0 + ' but leaf ' + leaves[i].id + ' is on level ' + d + '.' };
    }
    return { ok: true, text: 'Every internal node has 2 children and all ' + leaves.length + ' leaves are on level ' + d0 + '.' };
  }

  // ======================================================
  // 1. EDITABLE TREE
  // ======================================================
  let labRoot = null, labSel = null, nextId = 1;

  function buildPreset(name) {
    const map = { perfect: 1, complete: 2, full: 3, skewed: 4 };
    if (name === 'one') { labRoot = plain(1); nextId = 2; }
    else { labRoot = T.demo(map[name]); nextId = 8; }
    labSel = null;
    renderLab();
  }

  function findParent(root, target) {
    let res = null;
    T.preorder(root).forEach(function (n) { if (n.left === target || n.right === target) res = n; });
    return res;
  }

  function addChild(side) {
    if (!labSel || labSel[side] || T.countNodes(labRoot) >= MAX_NODES) return;
    const n = plain(nextId++);
    labSel[side] = n;
    labSel = n;                       // move the selection to the new node so you can keep growing
    renderLab(n);
  }

  function deleteSelected() {
    if (!labSel) return;
    if (labSel === labRoot) { labRoot = null; labSel = null; renderLab(); return; }
    const p = findParent(labRoot, labSel);
    if (p.left === labSel) p.left = null; else p.right = null;
    labSel = p;
    renderLab();
  }

  function renderLab(fresh) {
    V.render($('#labTree'), labRoot, {
      plain: true, unitX: 58, unitY: 66, radius: 18, levelLabels: true,
      selected: labSel, fresh: fresh || null,
      onNodeClick: function (n) { labSel = n; renderLab(); }
    });
    const n = T.countNodes(labRoot), leaves = T.countLeaves(labRoot), h = T.height(labRoot);
    const wf = whyFull(labRoot), wc = whyComplete(labRoot), wp = whyPerfect(labRoot);
    $('#labBadges').innerHTML = badge('Full', wf.ok) + badge('Complete', wc.ok) + badge('Perfect', wp.ok);
    $('#labWhy').innerHTML = [['Full', wf], ['Complete', wc], ['Perfect', wp]].map(function (r) {
      return '<li class="' + (r[1].ok ? 'yes' : 'no') + '"><b>' + r[0] + ': ' + (r[1].ok ? 'yes' : 'no') + '.</b> ' + r[1].text + '</li>';
    }).join('');
    if (labRoot) {
      const perfectN = T.perfectCount(h);
      $('#labFormula').innerHTML = 'Height h = ' + h + '. A perfect tree of this height has 2<sup>' + (h + 1) + '</sup> &minus; 1 = ' + perfectN +
        ' nodes and ' + Math.pow(2, h) + ' leaves.<br>Your tree has ' + n + ' nodes and ' + leaves + ' leaves' +
        (n === perfectN && leaves === Math.pow(2, h) ? ' &rarr; the counts match.' : ' &rarr; the counts do not match, so it is not perfect.');
    } else $('#labFormula').textContent = 'The tree is empty. Press "Just a root" to start again.';
    $('#labStats').innerHTML = [['Total nodes', n], ['Leaf nodes', leaves], ['Internal nodes', n - leaves], ['Height (edges)', h]]
      .map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');
    function ids(list) { return list.map(function (x) { return x.id; }).join(' ') || '(empty)'; }
    $('#labTrav').innerHTML = '<b>Preorder:</b> ' + ids(T.preorder(labRoot)) + '<br><b>Inorder:</b> ' + ids(T.inorder(labRoot)) +
      '<br><b>Postorder:</b> ' + ids(T.postorder(labRoot)) + '<br><b>Level-order:</b> ' + ids(T.levelOrder(labRoot));
    $('#labSel').textContent = labSel ? 'Selected: node ' + labSel.id : 'Click a circle to select it.';
    $('#labAddL').disabled = !labSel || !!labSel.left || n >= MAX_NODES;
    $('#labAddR').disabled = !labSel || !!labSel.right || n >= MAX_NODES;
    $('#labDel').disabled = !labSel;
  }

  // ======================================================
  // 2. BST PLAYGROUND (suspect ids)
  // ======================================================
  let bstRoot = null, bstTimer = null;

  function bstInsertQuiet(root, id) {
    if (!root) return plain(id);
    if (id < root.id) root.left = bstInsertQuiet(root.left, id);
    else if (id > root.id) root.right = bstInsertQuiet(root.right, id);
    return root;
  }
  function resetBst() {
    stopBst();
    bstRoot = null;
    DMG.caseData.suspects.forEach(function (s) { bstRoot = bstInsertQuiet(bstRoot, s.id); });
    $('#bstLog').innerHTML = '<li class="hint">Press Search or Insert.</li>';
    renderBst();
  }
  function stopBst() { if (bstTimer) { clearInterval(bstTimer); bstTimer = null; } }
  function renderBst(hl, active, found) {
    V.render($('#bstSvg'), bstRoot, { plain: true, unitX: 54, unitY: 58, radius: 17, levelLabels: true, highlight: hl || null, active: active || null, found: found || null });
  }
  function bstName(id) {
    const s = DMG.caseData.suspects.find(function (x) { return x.id === id; });
    return s ? ' (' + s.name + ')' : '';
  }

  // Walks from the root towards `id`, one comparison per tick.
  function bstWalk(id, mode) {
    stopBst();
    const log = $('#bstLog');
    log.innerHTML = '';
    const visited = new Set();
    let cur = bstRoot, comps = 0;
    function say(t) { log.insertAdjacentHTML('beforeend', '<li>' + t + '</li>'); }
    if (!cur) { say('The tree is empty.'); return; }
    bstTimer = setInterval(function () {
      if (!cur) { finish(false); return; }
      visited.add(cur); comps++;
      if (id === cur.id) {
        renderBst(visited, cur, mode === 'search' ? new Set([cur]) : null);
        say('Compare ' + id + ' with ' + cur.id + ': equal.');
        finish(true);
        return;
      }
      const goLeft = id < cur.id;
      say('Compare ' + id + ' with ' + cur.id + ': ' + id + (goLeft ? ' &lt; ' : ' &gt; ') + cur.id + ', so go ' + (goLeft ? 'left' : 'right') + '.');
      renderBst(visited, cur);
      const next = goLeft ? cur.left : cur.right;
      if (!next) {
        if (mode === 'insert') {
          const n = plain(id);
          if (goLeft) cur.left = n; else cur.right = n;
          stopBst();
          say('Empty spot found. Node ' + id + ' is inserted as the ' + (goLeft ? 'left' : 'right') + ' child of ' + cur.id + '. Comparisons: ' + comps + '.');
          V.render($('#bstSvg'), bstRoot, { plain: true, unitX: 54, unitY: 58, radius: 17, levelLabels: true, fresh: n });
          return;
        }
        cur = null; return;
      }
      cur = next;
    }, 650);

    function finish(ok) {
      stopBst();
      const total = T.countNodes(bstRoot);
      if (mode === 'insert' && ok) say('<b>Id ' + id + ' already exists.</b> A BST keeps keys unique, so nothing is inserted.');
      else if (mode === 'search') say(ok
        ? '<b>Found</b> id ' + id + bstName(id) + ' after ' + comps + ' comparison(s). The tree has ' + total + ' nodes.'
        : '<b>Not found.</b> Id ' + id + ' is not in the tree. We needed only ' + comps + ' comparison(s), not ' + total + '.');
    }
  }

  function bstInorder() {
    stopBst();
    const order = T.inorder(bstRoot);
    const log = $('#bstLog');
    log.innerHTML = '';
    const hl = new Set();
    let i = 0;
    bstTimer = setInterval(function () {
      if (i >= order.length) { stopBst(); log.insertAdjacentHTML('beforeend', '<li><b>Inorder of a BST always gives sorted order.</b></li>'); renderBst(hl); return; }
      hl.add(order[i]);
      log.insertAdjacentHTML('beforeend', '<li>Visit ' + order[i].id + bstName(order[i].id) + '</li>');
      renderBst(hl, order[i]);
      i++;
    }, 550);
  }

  // ======================================================
  // 3. SEARCH RACE
  // ======================================================
  let raceTimer = null, raceRoot = null;

  function bstCompareCount(id) {
    // Balanced BST of ids 1..15 (inserted level by level: 8,4,12,2,6,10,14,...).
    let node = null;
    [8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15].forEach(function (k) { node = bstInsertQuiet(node, k); });
    let comps = 0;
    while (node) { comps++; if (id === node.id) return comps; node = id < node.id ? node.left : node.right; }
    return comps;
  }

  function renderRace(hl, found) {
    V.render($('#raceTree'), raceRoot, { plain: true, unitX: 38, unitY: 52, radius: 14, highlight: hl || null, found: found || null });
  }

  function runRace() {
    if (raceTimer) { clearInterval(raceTimer); raceTimer = null; }
    let id = parseInt($('#raceId').value, 10);
    if (isNaN(id)) id = 1;
    id = Math.max(1, Math.min(15, id));
    $('#raceId').value = id;
    const order = T.preorder(raceRoot);
    const need = order.findIndex(function (n) { return n.id === id; }) + 1;
    const hl = new Set();
    let i = 0;
    $('#raceB').textContent = '-'; $('#raceBBar').style.width = '0';
    raceTimer = setInterval(function () {
      i++;
      hl.add(order[i - 1]);
      const isHit = order[i - 1].id === id;
      renderRace(hl, isHit ? new Set([order[i - 1]]) : null);
      $('#raceA').textContent = i + (i === 1 ? ' node' : ' nodes');
      $('#raceABar').style.width = (100 * i / 15) + '%';
      if (isHit) {
        clearInterval(raceTimer); raceTimer = null;
        const b = bstCompareCount(id);
        $('#raceB').textContent = b + (b === 1 ? ' node' : ' nodes');
        $('#raceBBar').style.width = (100 * b / 15) + '%';
        $('#raceNote').innerHTML = 'Evidence #' + id + ' was the <b>' + need + '</b>' + (need === 1 ? 'st' : need === 2 ? 'nd' : need === 3 ? 'rd' : 'th') +
          ' node in preorder. A BST of the same ids needs only <b>' + b + '</b> comparisons. With a million nodes the BST would still need only about 20, while the general tree could need a million.';
      }
    }, 330);
  }

  // ======================================================
  // wiring
  // ======================================================
  const Lab = {};
  Lab.init = function () {
    $$('[data-preset]').forEach(function (b) { b.addEventListener('click', function () { buildPreset(b.getAttribute('data-preset')); }); });
    $('#labAddL').addEventListener('click', function () { addChild('left'); });
    $('#labAddR').addEventListener('click', function () { addChild('right'); });
    $('#labDel').addEventListener('click', deleteSelected);
    buildPreset('complete');

    $('#bstSearch').addEventListener('click', function () { bstWalk(parseInt($('#bstInput').value, 10), 'search'); });
    $('#bstInsert').addEventListener('click', function () {
      const v = parseInt($('#bstInput').value, 10);
      if (isNaN(v) || v < 1 || v > 99) { $('#bstLog').innerHTML = '<li>Please type a whole number from 1 to 99.</li>'; return; }
      if (T.countNodes(bstRoot) >= MAX_NODES) { $('#bstLog').innerHTML = '<li>The lab tree is full (15 nodes). Press Reset.</li>'; return; }
      bstWalk(v, 'insert');
    });
    $('#bstInorder').addEventListener('click', bstInorder);
    $('#bstReset').addEventListener('click', resetBst);
    resetBst();

    raceRoot = T.build(DMG.caseData);
    T.preorder(raceRoot).forEach(function (n) { n.explored = true; });
    renderRace();
    $('#raceGo').addEventListener('click', runRace);
  };
  Lab.show = function () { renderLab(); renderBst(); renderRace(); };

  DMG.Lab = Lab;
})();
