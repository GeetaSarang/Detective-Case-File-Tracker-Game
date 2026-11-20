// ============================================================
// fx.js - colour themes and small animations
// ------------------------------------------------------------
//   * five colour themes (saved in localStorage when it is allowed)
//   * floating background shapes
//   * "reveal on scroll" for cards
//   * ripple on buttons
//   * words that fade in one by one
//   * numbers that count up
// Nothing here changes the game rules.
// ============================================================
window.DMG = window.DMG || {};

(function () {
  const FX = {};

  const THEMES = [
    { id: 'lavender', name: 'Lavender Latte', a: '#7c5cff', b: '#ff6fa5' },
    { id: 'mint', name: 'Mint Matcha', a: '#1f9d7a', b: '#ffd36b' },
    { id: 'peach', name: 'Peach Sunset', a: '#e8505b', b: '#ff9f1c' },
    { id: 'night', name: 'Night Diya', a: '#15122b', b: '#ffc857' },
    { id: 'notebook', name: 'Cream Notebook', a: '#3f4fc4', b: '#ffbf3c' }
  ];

  function applyTheme(id) {
    document.documentElement.setAttribute('data-theme', id);
    Array.prototype.forEach.call(document.querySelectorAll('.swatch'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-theme') === id);
      b.setAttribute('aria-pressed', b.getAttribute('data-theme') === id ? 'true' : 'false');
    });
    try { localStorage.setItem('dmg-theme', id); } catch (e) { /* storage may be blocked: ignore */ }
    if (FX.onTheme) FX.onTheme(id);
  }

  FX.initThemes = function () {
    const box = document.getElementById('themes');
    THEMES.forEach(function (t) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch'; b.setAttribute('data-theme', t.id);
      b.title = t.name; b.setAttribute('aria-label', 'Theme: ' + t.name);
      b.style.background = 'linear-gradient(135deg,' + t.a + ' 50%,' + t.b + ' 50%)';
      b.addEventListener('click', function () { applyTheme(t.id); });
      box.appendChild(b);
    });
    applyTheme(document.documentElement.getAttribute('data-theme') || 'lavender');
  };

  // soft moving blobs and small shapes that float upwards
  FX.initBackground = function () {
    const bg = document.createElement('div');
    bg.className = 'bg-fx'; bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = '<span class="blob b1"></span><span class="blob b2"></span>';
    const kinds = ['s-dot', 's-ring', 's-star', 's-diamond'];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span');
      const size = 10 + Math.random() * 22;
      s.className = 'fx-shape ' + kinds[i % kinds.length];
      s.style.width = s.style.height = size + 'px';
      s.style.left = (Math.random() * 100) + '%';
      s.style.setProperty('--dur', (14 + Math.random() * 16) + 's');
      s.style.setProperty('--delay', (-Math.random() * 20) + 's');
      bg.appendChild(s);
    }
    document.body.insertBefore(bg, document.body.firstChild);
  };

  // cards slide in when they are scrolled into view
  FX.reveal = function (selector) {
    const items = document.querySelectorAll(selector);
    if (!('IntersectionObserver' in window)) { Array.prototype.forEach.call(items, function (e) { e.classList.add('in'); }); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    Array.prototype.forEach.call(items, function (el, i) {
      el.classList.add('reveal');
      el.style.setProperty('--d', ((i % 6) * 0.08) + 's');
      io.observe(el);
    });
  };

  // a circle spreads from the click point on every button
  FX.initRipple = function () {
    document.addEventListener('pointerdown', function (e) {
      const btn = e.target.closest && e.target.closest('.btn');
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect(), size = Math.max(r.width, r.height);
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = (e.clientX - r.left - size / 2) + 'px';
      span.style.top = (e.clientY - r.top - size / 2) + 'px';
      btn.appendChild(span);
      setTimeout(function () { span.remove(); }, 650);
    });
  };

  // text that appears word by word
  FX.words = function (el, text) {
    el.textContent = '';
    text.split(' ').forEach(function (w, i) {
      const s = document.createElement('span');
      s.className = 'w'; s.style.setProperty('--i', i);
      s.textContent = w + ' ';
      el.appendChild(s);
    });
  };

  // numbers like "25", "100.0%" or "9.3 s" count up from zero
  FX.countUp = function (container) {
    Array.prototype.forEach.call(container.querySelectorAll('dd'), function (dd) {
      const m = /^(\d+(?:\.\d+)?)(.*)$/.exec(dd.textContent.trim());
      if (!m) return;
      const target = parseFloat(m[1]), decimals = (m[1].split('.')[1] || '').length, tail = m[2];
      const t0 = performance.now(), dur = 900;
      (function step(now) {
        const k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
        dd.textContent = (target * e).toFixed(decimals) + tail;
        if (k < 1) requestAnimationFrame(step); else dd.textContent = m[1] + tail;
      })(t0);
    });
  };

  FX.init = function () { FX.initThemes(); FX.initBackground(); FX.initRipple(); };
  DMG.FX = FX;
})();
