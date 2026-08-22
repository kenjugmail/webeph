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
      /* Write 'flat' rather than removing the key. Glass is the default
         material now, so an absent key means "has not chosen" -- and if
         turning glass off also cleared the key, the next page load
         would read that as never-chosen and turn it straight back on. */
      localStorage.setItem(MATERIAL_KEY, on ? 'glass' : 'flat');
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

  /* There used to be two lists here: FOLLOWS_SYSTEM, for the surfaces
     that took prefers-color-scheme, and NATIVE_DARK, for the ones
     whose own face was night. Dark is the default for the whole site
     now, so both collapsed -- one to empty and the other to every
     class on the site, which made the function that read them return
     'dark' down both branches. Deleted rather than left standing:
     scaffolding that always answers the same way reads like a decision
     is being made somewhere, and the next person to touch this would
     look for it.

     The head snippet writes data-mode on <html> before the first
     stylesheet, so the first branch below is the real path and the
     fallback only runs if storage threw.

     What this costs: jr-page, nw-page and vespera-page followed the
     reader's system preference before, and a reader whose OS asks for
     light now gets dark anyway. That is deliberate, and the toggle is
     in every nav. */

  /** What the page is showing right now, whichever way it got there. */
  function effective() {
    return root.dataset.mode || 'dark';
  }


  /* ---- Photographic plates -------------------------------------------
     The hero plates are pins and thread on lit paper. On the dark face
     an untouched one glows like a lightbox, so the build carries a
     tone-inverted twin (scripts/make-dark-plates.py) and these swap to
     it.

     Whichever variant sits in the markup is the one the preload
     scanner fetches, so it has to be the one most readers will end up
     looking at. That used to be the light plate, on the reasoning that
     dark was opt-in on the lab pages and therefore the smaller
     population. Making dark glass the default inverted it exactly: the
     scanner was fetching the light plate for everyone, mode.js was
     swapping it, and the hero -- the LCP image on the home page --
     was being downloaded twice on the common path.

     So the dark srcset is in the markup now and the light one rides in
     data-srcset-light. The extra fetch moved to the reader who chooses
     light, which is the minority again. */
  function plates(face) {
    var light = face === 'light';
    var nodes = document.querySelectorAll('[data-srcset-light], [data-src-light]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.dataset.srcsetLight) {
        /* The markup value is the dark one; cache it on first use so
           switching back has something to return to. */
        if (!el.dataset.srcsetDark) el.dataset.srcsetDark = el.getAttribute('srcset');
        el.setAttribute('srcset', light ? el.dataset.srcsetLight : el.dataset.srcsetDark);
      }
      if (el.dataset.srcLight) {
        if (!el.dataset.srcDark) el.dataset.srcDark = el.getAttribute('src');
        el.setAttribute('src', light ? el.dataset.srcLight : el.dataset.srcDark);
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

    var mark = document.createElement('span');
    mark.className = 'mode-toggle-mark';
    mark.setAttribute('aria-hidden', 'true');

    var copy = document.createElement('span');
    copy.className = 'mode-toggle-copy';
    copy.setAttribute('aria-hidden', 'true');

    var copyLabel = document.createElement('small');
    copyLabel.textContent = 'Look';
    var copyValue = document.createElement('b');
    copy.appendChild(copyLabel);
    copy.appendChild(copyValue);
    btn.appendChild(mark);
    btn.appendChild(copy);
    host.appendChild(btn);

    var GLYPH = { light: '\u2600', dark: '\u263e', glass: '\u25c8' };
    var NAME = { light: 'light', dark: 'dark', glass: 'liquid glass' };
    var SHORT_NAME = { light: 'Light', dark: 'Dark', glass: 'Glass' };

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
      mark.textContent = GLYPH[now];
      copyValue.textContent = SHORT_NAME[now];
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
