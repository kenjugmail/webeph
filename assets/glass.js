/* ============================================================
   LIQUID GLASS — refraction and sheen.

   Loaded only when the glass material is active. The frost and the lit
   edge in glass.css carry the look on their own; everything here is an
   enhancement on top of a material that already works.

   Displacement technique follows samasante/liquid-glass
   (github.com/samasante/liquid-glass). Its encoding, restated:

     R  x displacement, 128 = neutral
     G  y displacement, 128 = neutral
     B  specular mask,  128 = none, 255 = full

   A rounded-rect signed distance field is rendered into those channels
   and handed to feDisplacementMap, which pushes each pixel of the
   source by the amount the map encodes. Two things from that library
   are not optional and are easy to get wrong:

   1. The map must be backed by neutral grey across the whole filter
      region. feImage only covers the box, and transparent-black
      outside it biases the edge into a dark contorted fringe.
   2. `backdrop-filter: url(#…)` is Chromium-only. Refracting the page
      behind a fixed panel therefore cannot be the baseline, so this
      runs behind a support test and simply does not apply elsewhere.

   That library also warns a stretched lens blooms an oval across a
   wide panel, so this only lenses content-sized elements.
   ============================================================ */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var MAP_SIZE = 128;          // map resolution; the SDF is smooth, so this is plenty
  var LENS_MAX_AREA = 420000;  // px^2 — past this a lens blooms, so frost only

  var supportsLens =
    typeof CSS !== 'undefined' &&
    CSS.supports &&
    (CSS.supports('backdrop-filter', 'url(#glass)') ||
      CSS.supports('-webkit-backdrop-filter', 'url(#glass)'));

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(pointer: fine)');

  /* ---- The map ------------------------------------------------
     Rendered once per distinct shape and cached. Only a quadrant is
     computed and mirrored into the other three, which is what makes a
     per-element map cheap enough to be worth doing at all. */
  var mapCache = Object.create(null);

  function displacementMap(w, h, radius, strength) {
    var key = w + 'x' + h + 'r' + radius + 's' + strength;
    if (mapCache[key]) return mapCache[key];

    var size = MAP_SIZE;
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var img = ctx.createImageData(size, size);
    var data = img.data;

    var halfW = w / 2;
    var halfH = h / 2;
    var r = Math.min(radius, Math.min(halfW, halfH));
    var stepX = w / size;
    var stepY = h / size;
    var half = size >> 1;

    for (var row = 0; row < half; row++) {
      var mirrorRow = size - 1 - row;
      var py = (row + 0.5) * stepY - halfH;      // negative in this quadrant
      var edgeY = -py - halfH + r;

      for (var col = 0; col < half; col++) {
        var mirrorCol = size - 1 - col;
        var px = (col + 0.5) * stepX - halfW;
        var edgeX = -px - halfW + r;

        /* Signed distance to a rounded rectangle. Positive is outside. */
        var qx = edgeX > 0 ? edgeX : 0;
        var qy = edgeY > 0 ? edgeY : 0;
        var outer = Math.sqrt(qx * qx + qy * qy);
        var inner = edgeX > edgeY ? (edgeX > 0 ? 0 : edgeX) : (edgeY > 0 ? 0 : edgeY);
        var sdf = outer + inner - r;

        var dx = 128, dy = 128, spec = 128;

        if (sdf < 0) {
          /* Bend rises toward the rim the way it does through a real
             lens: proportional to tan of the angle, held just inside
             the radius so the root stays real at the very edge. */
          var depth = -sdf;
          var reach = Math.max(r, 1);
          var t = 1 - Math.min(depth / reach, 1);       // 0 centre, 1 at rim
          var bend = (t / Math.sqrt(1 - Math.min(t * t, 0.999))) * strength;
          if (bend > 40) bend = 40;

          /* Push outward from the centre, so the edges pull the
             backdrop inward the way a convex edge does. */
          var len = Math.sqrt(px * px + py * py) || 1;
          dx = 128 + (px / len) * bend;
          dy = 128 + (py / len) * bend;

          /* Specular sits in the same band as the bend, brightest at
             the rim, so the shine follows the geometry rather than
             being painted on top of it. */
          spec = 128 + Math.round(127 * Math.pow(t, 3));
        }

        dx = dx < 0 ? 0 : dx > 255 ? 255 : dx;
        dy = dy < 0 ? 0 : dy > 255 ? 255 : dy;

        /* One quadrant, four writes. X mirrors invert the X channel
           around neutral; Y mirrors invert Y. */
        var mx = 256 - dx;
        var my = 256 - dy;
        write(data, (row * size + col) * 4, dx, dy, spec);
        write(data, (row * size + mirrorCol) * 4, mx, dy, spec);
        write(data, (mirrorRow * size + col) * 4, dx, my, spec);
        write(data, (mirrorRow * size + mirrorCol) * 4, mx, my, spec);
      }
    }

    ctx.putImageData(img, 0, 0);
    var url = canvas.toDataURL();
    mapCache[key] = url;
    return url;
  }

  function write(data, i, r, g, b) {
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }

  /* ---- The filter ---------------------------------------------
     Three displacement passes at slightly different scales, each kept
     to one channel and added back together. That difference between
     channels is the colour fringing real glass shows at an edge; one
     pass would bend all three identically and read as plastic. */
  var defs = null;
  var filterSeq = 0;

  function ensureDefs() {
    if (defs) return defs;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return defs;
  }

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function buildFilter(mapUrl, scale, dispersion, specular) {
    var id = 'eph-glass-' + (++filterSeq);
    var f = el('filter', {
      id: id,
      x: '-10%', y: '-10%', width: '120%', height: '120%',
      filterUnits: 'objectBoundingBox',
      'color-interpolation-filters': 'sRGB'
    });

    /* Neutral grey behind the map: feImage only covers the box, and
       transparent-black outside it drags the edge into a dark fringe. */
    f.appendChild(el('feFlood', { 'flood-color': 'rgb(128,128,128)', 'flood-opacity': '1', result: 'mapBg' }));
    f.appendChild(el('feImage', { href: mapUrl, preserveAspectRatio: 'none', result: 'rawMap' }));
    f.appendChild(el('feComposite', { in: 'rawMap', in2: 'mapBg', operator: 'over', result: 'map' }));

    var chans = [
      ['R', scale * (1 + dispersion), '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'refR'],
      ['G', scale * (1 + dispersion * 0.5), '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'refG'],
      ['B', scale, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'refB']
    ];
    chans.forEach(function (c) {
      f.appendChild(el('feDisplacementMap', {
        in: 'SourceGraphic', in2: 'map', scale: c[1],
        xChannelSelector: 'R', yChannelSelector: 'G'
      }));
      f.appendChild(el('feColorMatrix', { type: 'matrix', values: c[2], result: c[3] }));
    });
    f.appendChild(el('feComposite', { in: 'refR', in2: 'refG', operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0', result: 'refRG' }));
    f.appendChild(el('feComposite', { in: 'refRG', in2: 'refB', operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0', result: 'lens' }));

    if (specular > 0) {
      /* Lift the map's B channel into a white sheen (128 -> 0,
         255 -> 1) and add it over the refracted backdrop. */
      f.appendChild(el('feColorMatrix', {
        in: 'map', type: 'matrix',
        values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 ' + (-128 / 255),
        result: 'sheen'
      }));
      f.appendChild(el('feComposite', {
        in: 'sheen', in2: 'lens', operator: 'arithmetic',
        k1: '0', k2: String(specular), k3: '1', k4: '0'
      }));
    }

    ensureDefs().appendChild(f);
    return id;
  }

  /* ---- Applying ------------------------------------------------ */
  var LENSED = '.menu-panel, .card, .price-card, .auth-card, .mode-toggle';

  function lens(node) {
    var rect = node.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 24) return;
    if (rect.width * rect.height > LENS_MAX_AREA) return;   // would bloom

    var radius = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
    var strength = Math.max(2, Math.min(rect.width, rect.height) * 0.06);
    var url = displacementMap(Math.round(rect.width), Math.round(rect.height), radius, strength);
    var id = buildFilter(url, Math.round(strength * 0.9), 0.18, 0.5);

    var blur = 'blur(var(--glass-blur)) saturate(var(--glass-saturate))';
    node.style.backdropFilter = blur + ' url(#' + id + ')';
    node.style.webkitBackdropFilter = blur + ' url(#' + id + ')';
    node.dataset.glassLensed = 'true';
  }

  function unlens(node) {
    node.style.backdropFilter = '';
    node.style.webkitBackdropFilter = '';
    delete node.dataset.glassLensed;
  }

  /* ---- Sheen tracking ------------------------------------------
     One rAF, pointer position written as two custom properties. The
     gradient in glass.css reads them; nothing here touches layout. */
  var tracked = [];
  var pending = false;
  var pointer = { x: 0, y: 0 };

  function onMove(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pending) return;
    pending = true;
    requestAnimationFrame(paintSheen);
  }

  function paintSheen() {
    pending = false;
    for (var i = 0; i < tracked.length; i++) {
      var node = tracked[i];
      var r = node.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      var x = ((pointer.x - r.left) / r.width) * 100;
      var y = ((pointer.y - r.top) / r.height) * 100;
      node.style.setProperty('--glass-x', Math.max(-20, Math.min(120, x)) + '%');
      node.style.setProperty('--glass-y', Math.max(-20, Math.min(120, y)) + '%');
    }
  }

  /* ---- Lifecycle ----------------------------------------------- */
  var active = false;

  function enable() {
    if (active) return;
    active = true;

    if (supportsLens && !document.documentElement.classList.contains('no-heavy-motion')) {
      document.querySelectorAll(LENSED).forEach(lens);
    }
    if (finePointer.matches && !reduced.matches) {
      tracked = Array.prototype.slice.call(
        document.querySelectorAll('.nav, .ebar, .jr-header, .menu-panel, .card, .price-card, .auth-card')
      );
      if (tracked.length) window.addEventListener('pointermove', onMove, { passive: true });
    }
  }

  function disable() {
    if (!active) return;
    active = false;
    document.querySelectorAll('[data-glass-lensed]').forEach(unlens);
    window.removeEventListener('pointermove', onMove);
    tracked.forEach(function (n) {
      n.style.removeProperty('--glass-x');
      n.style.removeProperty('--glass-y');
    });
    tracked = [];
  }

  function sync() {
    if (document.documentElement.dataset.material === 'glass') enable();
    else disable();
  }

  window.addEventListener('ephemerent:materialchange', sync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();

  window.EphemerentGlass = { enable: enable, disable: disable, supportsLens: supportsLens };
})();
