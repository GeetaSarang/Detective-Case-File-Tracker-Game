// ============================================================
// visualizer.js - draws binary trees as SVG
// ------------------------------------------------------------
// Used by the Play page, the Tree Visualizer page and the Learn page.
// Node states:
//   explored  : the player has opened it
//   open      : its parent is explored but it is not (a lead you can follow now)
//   locked    : its parent is not explored yet
//   plain     : used for teaching diagrams where exploration does not matter
// ============================================================
window.DMG = window.DMG || {};

(function () {
  const T = DMG.Tree;
  const V = {};
  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }

  // Draws a tree into an <svg> element.
  // opts: unitX, unitY, radius, plain, reveal, levelLabels, current, walkLog,
  //       highlight (Set of nodes), active (node), onNodeClick(node), clickable(node)
  V.render = function (svg, root, opts) {
    opts = opts || {};
    const unitX = opts.unitX || 56, unitY = opts.unitY || 66, r = opts.radius || 17;
    const padX = (opts.levelLabels ? 54 : 0) + r + 12, padY = r + 12;
    const L = T.layout(root);
    const W = Math.max(L.leaves - 1, 0) * unitX + 2 * padX;
    const H = L.maxDepth * unitY + 2 * padY;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const pos = new Map();
    L.items.forEach(function (it) {
      pos.set(it.node, { x: padX + it.x * unitX, y: padY + it.depth * unitY, it: it });
    });

    // edges of the path the player has walked
    const pathEdges = new Set();
    if (opts.walkLog) {
      for (let i = 1; i < opts.walkLog.length; i++) {
        const a = opts.walkLog[i - 1], b = opts.walkLog[i];
        pathEdges.add(a + '-' + b); pathEdges.add(b + '-' + a);
      }
    }

    function state(node, parent) {
      if (opts.plain) return 'plain';
      if (node.explored) return 'explored';
      if (!parent || parent.explored) return 'open';
      return 'locked';
    }

    if (opts.levelLabels) {
      for (let d = 0; d <= L.maxDepth; d++) {
        const t = el('text', { x: 8, y: padY + d * unitY + 4, class: 'level-label' }, svg);
        t.textContent = 'Level ' + d;
      }
    }

    // edges first, so nodes are drawn on top
    L.items.forEach(function (it) {
      const p = pos.get(it.node);
      [it.node.left, it.node.right].forEach(function (child) {
        if (!child) return;
        const c = pos.get(child);
        let cls = 'edge';
        if (opts.plain) cls += ' edge-on';
        else if (child.explored) cls += ' edge-on';
        else if (it.node.explored) cls += ' edge-open';
        else cls += ' edge-locked';
        if (pathEdges.has(it.node.id + '-' + child.id)) cls += ' edge-path';
        el('line', { x1: p.x, y1: p.y + r, x2: c.x, y2: c.y - r, class: cls }, svg);
      });
    });

    // nodes
    L.items.forEach(function (it) {
      const node = it.node, p = pos.get(node);
      const st = state(node, it.parent ? it.parent.node : null);
      let cls = 'node n-' + st;
      if (opts.highlight && opts.highlight.has(node)) cls += ' n-trav';
      if (opts.active === node) cls += ' n-active';
      if (opts.selected === node) cls += ' n-sel';
      if (opts.found && opts.found.has(node)) cls += ' n-found';
      if (opts.fresh === node) cls += ' n-new';
      const clickable = opts.clickable ? opts.clickable(node) : !!opts.onNodeClick;
      if (clickable) cls += ' clickable';
      const g = el('g', { class: cls, 'data-id': node.id }, svg);

      const showText = st !== 'locked' || opts.reveal;
      const tip = el('title', {}, g);
      tip.textContent = showText
        ? '#' + node.id + ' ' + node.title + (node.type ? ' (' + node.type + ')' : '')
        : 'Locked lead: explore its parent evidence first';

      el('circle', { class: 'body', cx: p.x, cy: p.y, r: r }, g);
      if (opts.current === node) el('circle', { class: 'ring', cx: p.x, cy: p.y, r: r + 5 }, g).parentNode.classList.add('n-current');
      const t = el('text', { x: p.x, y: p.y }, g);
      t.textContent = (st === 'locked' && !opts.reveal) ? '?' : String(node.id);

      if (opts.onNodeClick) g.addEventListener('click', function () { opts.onNodeClick(node); });
    });
  };

  // Draws a small bar chart (inline SVG) into a container.
  V.barChart = function (container, title, labels, values, unit, alt) {
    container.innerHTML = '';
    const svg = el('svg', { viewBox: '0 0 520 220', role: 'img', 'aria-label': title });
    const max = Math.max.apply(null, values) || 1;
    const left = 50, bottom = 180, top = 34, bw = 70, gap = (520 - left - 20 - bw * values.length) / Math.max(values.length - 1, 1);
    el('text', { x: 10, y: 18, class: 'ctitle' }, svg).textContent = title;
    el('line', { x1: left, y1: bottom, x2: 510, y2: bottom, class: 'axis' }, svg);
    values.forEach(function (v, i) {
      const h = (bottom - top) * v / max;
      const x = left + i * (bw + gap);
      el('rect', { x: x, y: bottom - h, width: bw, height: h, rx: 6, class: 'bar' + (alt ? ' alt' : '') }, svg);
      el('text', { x: x + bw / 2, y: bottom - h - 6, 'text-anchor': 'middle' }, svg).textContent =
        (v >= 100 ? v.toFixed(0) : v.toFixed(2)) + (unit ? ' ' + unit : '');
      el('text', { x: x + bw / 2, y: bottom + 18, 'text-anchor': 'middle' }, svg).textContent = labels[i];
    });
    container.appendChild(svg);
  };

  // Line chart. series = [{ values: [...], cls: 'line' | 'line2' }], x = 0..n-1.
  // xLabel / yLabel are axis captions. yMax is the top of the y axis.
  V.lineChart = function (container, title, series, yMax, xLabel, yLabel) {
    container.innerHTML = '';
    const W = 520, H = 230, left = 46, right = 14, top = 32, bottom = 186;
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': title });
    el('text', { x: 10, y: 18, class: 'ctitle' }, svg).textContent = title;
    const n = Math.max.apply(null, series.map(function (s) { return s.values.length; })) - 1 || 1;
    for (let k = 0; k <= 4; k++) {
      const y = bottom - (bottom - top) * k / 4;
      el('line', { x1: left, y1: y, x2: W - right, y2: y, class: k === 0 ? 'axis' : 'grid' }, svg);
      el('text', { x: left - 6, y: y + 4, 'text-anchor': 'end' }, svg).textContent = Math.round(yMax * k / 4);
    }
    el('line', { x1: left, y1: top, x2: left, y2: bottom, class: 'axis' }, svg);
    series.forEach(function (s) {
      const pts = s.values.map(function (v, i) {
        return (left + (W - left - right) * i / n).toFixed(1) + ',' + (bottom - (bottom - top) * v / yMax).toFixed(1);
      });
      el('polyline', { points: pts.join(' '), class: s.cls }, svg);
      if (s.dots) s.values.forEach(function (v, i) {
        const c = pts[i].split(',');
        el('circle', { cx: c[0], cy: c[1], r: 4.5, class: 'dot' }, svg);
      });
    });
    el('text', { x: (left + W - right) / 2, y: H - 8, 'text-anchor': 'middle' }, svg).textContent = xLabel;
    const yl = el('text', { x: 12, y: (top + bottom) / 2, 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + ((top + bottom) / 2) + ')' }, svg);
    yl.textContent = yLabel;
    container.appendChild(svg);
  };

  // Donut / ring meter showing a percentage. The circle is created once and then only
  // updated, so the CSS transition can slide it smoothly from the old value to the new one.
  V.ring = function (container, percent, sub) {
    const r = 42, c = 2 * Math.PI * r;
    let fg = container.querySelector('.ring-fg');
    if (!fg) {
      container.innerHTML =
        '<svg viewBox="0 0 110 110" role="img">' +
        '<circle class="ring-bg" cx="55" cy="55" r="' + r + '"></circle>' +
        '<circle class="ring-fg" cx="55" cy="55" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '"></circle>' +
        '<text class="ring-text" x="55" y="52"></text><text class="ring-sub" x="55" y="70"></text></svg>';
      fg = container.querySelector('.ring-fg');
      void fg.getBoundingClientRect();                 // force a layout so the first change animates
    }
    fg.style.strokeDashoffset = (c * (1 - percent / 100)).toFixed(1);
    fg.classList.toggle('done', percent >= 100);
    container.querySelector('svg').setAttribute('aria-label', Math.round(percent) + ' percent explored');
    container.querySelector('.ring-text').textContent = Math.round(percent) + '%';
    container.querySelector('.ring-sub').textContent = sub || '';
  };

  DMG.Viz = V;
})();
