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
  var root = document.documentElement;

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
     are deliberately absent: they are built around photography of lit
     paper and stay paper unless a reader asks for dark here. Must match
     the @media blocks in tokens.css, or the control offers the wrong
     switch. */
  var FOLLOWS_SYSTEM = ['jr-page', 'nw-page', 'vespera-page'];

  /* Surfaces whose native face is night. */
  var NATIVE_DARK = ['orrery-page', 'utility-page', 'auth-page',
    'vellum-page', 'shelterix-page', 'genesis-fall-page'];

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

    function label() {
      var now = effective();
      var next = now === 'dark' ? 'light' : 'dark';
      btn.setAttribute('aria-label', 'Switch to ' + next + ' mode');
      btn.setAttribute('title', 'Switch to ' + next + ' mode');
      btn.dataset.mode = now;
      /* Two glyphs, swapped by CSS, so no icon request. */
      btn.innerHTML = '<span aria-hidden="true">' + (now === 'dark' ? '☾' : '☀') + '</span>';
    }

    btn.addEventListener('click', function () {
      apply(effective() === 'dark' ? 'light' : 'dark');
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

  window.EphemerentMode = { apply: apply, effective: effective };
})();
