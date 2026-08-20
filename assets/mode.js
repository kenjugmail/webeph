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

  /** What the page is showing right now, whichever way it got there. */
  function effective() {
    if (root.dataset.mode) return root.dataset.mode;
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var body = document.body;
    var paper = body && (body.classList.contains('lab-page') ||
      body.classList.contains('jr-page') || body.classList.contains('nw-page') ||
      body.classList.contains('vespera-page') || body.classList.contains('legal-page') ||
      body.classList.contains('error-page'));
    if (paper) return dark ? 'dark' : 'light';
    return 'dark';
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
      '.ebar-in, .nav-inner, .jr-header-inner, .nw-header-inner, .enav, .nav-links'
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
    });

    label();

    /* If the reader has expressed no preference, keep following the OS. */
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (!stored()) label(); };
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
