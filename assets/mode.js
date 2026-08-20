/* ============================================================
   MODE — the light/dark control.

   The palettes live in tokens.css. This file only owns the control
   and the stored preference. The class that actually prevents a flash
   of the wrong face is the inline snippet in each page's <head>; by
   the time this deferred script runs, the correct face is already
   painted.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'eph-mode';
  var MATERIAL_KEY = 'eph-material';
  var root = document.documentElement;

  /* The control cycles through three looks rather than carrying two
     controls in a nav that is already full. Glass is a material rather
     than a face, so it composes with dark: it needs a ground with
     something behind it to be worth refracting. */
  var CYCLE = ['light', 'dark', 'glass'];

  function material() {
    return root.dataset.material === 'glass' ? 'glass' : 'flat';
  }

  function setMaterial(name) {
    var on = name === 'glass';
    if (on) root.dataset.material = 'glass';
    else delete root.dataset.material;
    try {
      if (on) localStorage.setItem(MATERIAL_KEY, 'glass');
      else localStorage.removeItem(MATERIAL_KEY);
    } catch (e) { /* private browsing */ }

    if (on) {
      ensureGlassAssets();
    }
    window.dispatchEvent(new CustomEvent('ephemerent:materialchange', {
      detail: { material: name },
    }));
  }

  /* The stylesheet is already there when glass was the stored choice;
     this covers switching to it during a visit. The script is an
     enhancement either way, so it is always loaded late. */
  function ensureGlassAssets() {
    if (!document.querySelector('link[data-glass-css]') &&
        !document.querySelector('link[href*="glass.css"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/assets/glass.css?v=20260820';
      link.setAttribute('data-glass-css', '');
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-glass-js]')) {
      var script = document.createElement('script');
      script.src = '/assets/glass.js?v=20260820';
      script.defer = true;
      script.setAttribute('data-glass-js', '');
      document.head.appendChild(script);
    }
  }

  /* Surfaces whose identity is fixed. genesis-fall is a single
     art-directed teaser with no counterpart palette, so offering it a
     toggle would promise something tokens.css cannot deliver. */
  var FIXED = ['genesis-fall-page'];

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function apply(mode) {
    if (mode === 'light' || mode === 'dark') root.dataset.mode = mode;
    else delete root.dataset.mode;
    try {
      if (mode) localStorage.setItem(KEY, mode);
      else localStorage.removeItem(KEY);
    } catch (e) { /* private browsing: the choice just does not persist */ }
    /* Some surfaces paint their accents from JavaScript rather than from
       CSS custom properties, so a class swap is not enough to move them.
       They listen for this. */
    window.dispatchEvent(new CustomEvent('ephemerent:modechange', {
      detail: { mode: effective() },
    }));
  }

  /* Surfaces that follow the reader's system preference. The lab pages
     are absent because they are night-native now, not because they are
     pinned to paper. Must match the blocks in tokens.css, or the
     control offers the wrong switch. */
  var FOLLOWS_SYSTEM = ['jr-page', 'nw-page', 'vespera-page'];

  /* Surfaces whose native face is night. */
  var NATIVE_DARK = ['orrery-page', 'utility-page', 'auth-page',
    'vellum-page', 'shelterix-page', 'genesis-fall-page',
    'lab-page', 'legal-page', 'error-page'];

  var has = function (list) {
    var body = document.body;
    if (!body) return false;
    for (var i = 0; i < list.length; i++) {
      if (body.classList.contains(list[i])) return true;
    }
    return false;
  };

  /** What the page is showing right now, whichever way it got there. */
  function effective() {
    if (root.dataset.mode) return root.dataset.mode;
    if (has(FOLLOWS_SYSTEM)) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return has(NATIVE_DARK) ? 'dark' : 'light';
  }


  /* ---- Photographic plates -------------------------------------------
     The hero plates are pins and thread on lit paper. On the dark face
     an untouched one glows like a lightbox, so the build carries a
     tone-inverted twin (scripts/make-dark-plates.py) and these swap to
     it.

     The light srcset stays in the markup rather than being held in a
     data attribute and set from here. That keeps the browser's preload
     scanner working for the common path, at the cost of one extra
     fetch for a reader who has chosen dark -- on the lab pages dark is
     opt-in, so that is the smaller population, and delaying the LCP
     image for everyone to save it would be the wrong trade. */
  function plates(face) {
    var dark = face === 'dark';
    var nodes = document.querySelectorAll('[data-srcset-dark], [data-src-dark]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.dataset.srcsetDark) {
        if (!el.dataset.srcsetLight) el.dataset.srcsetLight = el.getAttribute('srcset');
        el.setAttribute('srcset', dark ? el.dataset.srcsetDark : el.dataset.srcsetLight);
      }
      if (el.dataset.srcDark) {
        if (!el.dataset.srcLight) el.dataset.srcLight = el.getAttribute('src');
        el.setAttribute('src', dark ? el.dataset.srcDark : el.dataset.srcLight);
      }
    }
  }

  function build() {
    var body = document.body;
    if (!body) return;
    for (var i = 0; i < FIXED.length; i++) {
      if (body.classList.contains(FIXED[i])) return;
    }
    if (document.querySelector('.mode-toggle')) return;

    /* Every nav on the site is hand-written and none of them share
       markup, so attach to whichever inner wrapper this page happens
       to use rather than assuming one structure. */
    var host = document.querySelector(
      '.ebar-in, .nav-inner, .jr-header-inner, .nw-masthead-row, .enav, .nav-links'
    );
    if (!host) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mode-toggle';
    btn.setAttribute('aria-live', 'polite');
    host.appendChild(btn);

    var GLYPH = { light: '\u2600', dark: '\u263e', glass: '\u25c8' };
    var NAME = { light: 'light', dark: 'dark', glass: 'liquid glass' };

    /** Which of the three looks is on screen. */
    function current() {
      if (material() === 'glass') return 'glass';
      return effective() === 'dark' ? 'dark' : 'light';
    }

    function label() {
      var now = current();
      var next = CYCLE[(CYCLE.indexOf(now) + 1) % CYCLE.length];
      btn.setAttribute('aria-label', 'Appearance: ' + NAME[now] + '. Switch to ' + NAME[next] + '.');
      btn.setAttribute('title', 'Switch to ' + NAME[next]);
      btn.dataset.look = now;
      btn.innerHTML = '<span aria-hidden="true">' + GLYPH[now] + '</span>';
    }

    btn.addEventListener('click', function () {
      var next = CYCLE[(CYCLE.indexOf(current()) + 1) % CYCLE.length];
      if (next === 'glass') {
        /* Glass wants a ground with something behind it, so it arrives
           on the dark face rather than on paper. */
        apply('dark');
        setMaterial('glass');
      } else {
        setMaterial('flat');
        apply(next);
      }
      label();
      plates(effective());
    });

    label();
    plates(effective());

    /* Relabel on a system change only where the system drives the face. */
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (!stored() && has(FOLLOWS_SYSTEM)) label(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* The stylesheet arrived from the head snippet, but the enhancement
     script is only fetched here -- including on a load that already
     started in glass, which is the common case for someone who chose
     it last visit. */
  if (root.dataset.material === 'glass') ensureGlassAssets();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

  window.EphemerentMode = { apply: apply, effective: effective };
})();
