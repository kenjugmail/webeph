/* ============================================================
   VELLUM — hero canvas. A geodesic instrument turning in the
   dark while a verification plane sweeps it: the act of proving
   3D work headlessly, on the CPU. mountVellumHero(canvas, opts)
   ============================================================ */
(function () {
  function mountVellumHero(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    let cx = 0, cy = 0, R = 1;
    let mx = 0, my = 0, tmx = 0, tmy = 0;

    const COL = {
      edge: '61,127,184',     // steel-blue
      hot: '45,212,191',      // teal (scanned)
      node: '224,165,68',     // brass
      grid: '184,192,210'
    };
    function readPalette() {
      const cs = getComputedStyle(canvas);
      const g = (n, fb) => { const v = cs.getPropertyValue(n).trim(); return v || fb; };
      COL.edge = g('--wf-edge', COL.edge);
      COL.hot = g('--wf-hot', COL.hot);
      COL.node = g('--wf-node', COL.node);
      COL.grid = g('--wf-grid', COL.grid);
    }
    readPalette();
    window.addEventListener('vellum-palette', readPalette);

    const sphere = window.V3.icosphere(1);
    const box = window.V3.bbox(sphere.verts);

    // small orbiting satellites (different primitives → many kinds of 3D work)
    const sats = [
      { geo: window.V3.boxEdges(0, 0, 0, 1, 1, 1), r: 1.95, sp: 0.22, ph: 0.0, sc: 0.26, spin: 0.9 },
      { geo: tetra(), r: 2.4, sp: -0.16, ph: 2.3, sc: 0.30, spin: -0.7 },
      { geo: octa(), r: 2.15, sp: 0.19, ph: 4.4, sc: 0.27, spin: 1.1 }
    ];

    function tetra() {
      const v = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(window.V3.normalize);
      return { v, e: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] };
    }
    function octa() {
      const v = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      return { v, e: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]] };
    }

    let stars = [];
    function seedStars() {
      stars = [];
      const n = Math.floor((W * H) / 10000);
      for (let i = 0; i < n; i++) stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.2 + 0.2, tw: Math.random() * 6.28, tws: Math.random() * 1.4 + 0.3, d: Math.random() * 0.4 + 0.2
      });
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W * (opts.cxf != null ? opts.cxf : 0.66);
      cy = H * (opts.cyf != null ? opts.cyf : 0.52);
      R = Math.min(W, H) * 0.24;
      seedStars();
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DIST = 5.2, FOV = 4.0;

    function projV(p, yaw, pitch, scale, off) {
      const r = window.V3.rot(p, yaw, pitch);
      const wp = [r[0] * scale + (off ? off[0] : 0), r[1] * scale + (off ? off[1] : 0), r[2] * scale + (off ? off[2] : 0)];
      const z = wp[2] + DIST;
      const s = (FOV / (z <= 0.01 ? 0.01 : z)) * R;
      return { x: cx + wp[0] * s + mx, y: cy - wp[1] * s + my, depth: wp[2] };
    }

    let t0 = performance.now();
    function frame(now) {
      const t = (now - t0) / 1000;
      mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
      ctx.clearRect(0, 0, W, H);

      // stars
      for (const s of stars) {
        const a = 0.32 + Math.sin(s.tw + now * 0.001 * s.tws) * 0.28;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = '#cfd6e6';
        ctx.beginPath(); ctx.arc(s.x + mx * s.d * 2, s.y + my * s.d * 2, s.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;

      const yaw = reduce ? 0.6 : t * 0.32;
      const pitch = -0.42 + Math.sin(t * 0.3) * 0.05;

      // ground grid (y = -1.55 plane)
      drawGrid(yaw, pitch);

      // sweeping verification plane — screen-space vertical sweep
      const sweep = reduce ? 0.4 : (Math.sin(t * 0.85) * 0.5 + 0.5);
      const projTop = projV([0, 1.55, 0], yaw, pitch, 1, null).y;
      const projBot = projV([0, -1.55, 0], yaw, pitch, 1, null).y;
      const scanY = projTop + (projBot - projTop) * sweep;
      const band = R * 0.42;

      // bounding box (faint)
      drawEdges(box.v, box.e, yaw, pitch, 1, null, scanY, band, 0.16, false);

      // main geodesic
      drawEdges(sphere.verts, sphere.edges, yaw, pitch, 1, null, scanY, band, 0.62, false);
      drawNodes(sphere.verts, yaw, pitch, 1, null, scanY, band);

      // satellites
      for (const s of sats) {
        const a = s.ph + (reduce ? 0 : t * s.sp);
        const off = [Math.cos(a) * s.r, Math.sin(a * 0.7) * 0.5, Math.sin(a) * s.r];
        drawEdges(s.geo.v, s.geo.e, reduce ? 0.5 : t * s.spin, 0.4, s.sc, off, scanY, band, 0.5, true);
      }

      // the scan line itself
      ctx.save();
      const grad = ctx.createLinearGradient(0, scanY - 1, 0, scanY + 1);
      ctx.strokeStyle = `rgba(${COL.hot},0.55)`;
      ctx.lineWidth = 1;
      ctx.shadowColor = `rgba(${COL.hot},0.8)`; ctx.shadowBlur = 14;
      const lx = cx - R * 2.7, rx = cx + R * 2.7;
      ctx.beginPath(); ctx.moveTo(lx + mx, scanY); ctx.lineTo(rx + mx, scanY); ctx.stroke();
      // ticks
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(${COL.hot},0.85)`;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('verify ·', rx + mx + 8, scanY + 3);
      ctx.restore();

      requestAnimationFrame(frame);
    }

    function drawGrid(yaw, pitch) {
      const n = 6, span = 2.6, y = -1.55;
      ctx.lineWidth = 1;
      for (let i = -n; i <= n; i++) {
        const f = i / n * span;
        line3([f, y, -span], [f, y, span], yaw, pitch);
        line3([-span, y, f], [span, y, f], yaw, pitch);
      }
    }
    function line3(a, b, yaw, pitch) {
      const pa = projV(a, yaw, pitch, 1, null), pb = projV(b, yaw, pitch, 1, null);
      const dep = (pa.depth + pb.depth) / 2;
      const al = 0.05 + Math.max(0, (dep + 2) / 4) * 0.05;
      ctx.strokeStyle = `rgba(${COL.grid},${al})`;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }

    function hotness(y, scanY, band) {
      const d = Math.abs(y - scanY);
      return d < band ? 1 - d / band : 0;
    }

    function drawEdges(verts, edges, yaw, pitch, scale, off, scanY, band, baseA, isSat) {
      const P = verts.map(v => projV(v, yaw, pitch, scale, off));
      for (const [i, j] of edges) {
        const a = P[i], b = P[j];
        const dep = (a.depth + b.depth) / 2;
        const depthA = 0.35 + Math.max(0, Math.min(1, (dep + 2.2) / 4.4)) * 0.65;
        const hot = Math.max(hotness(a.y, scanY, band), hotness(b.y, scanY, band));
        const col = hot > 0.04 ? COL.hot : COL.edge;
        const al = (isSat ? baseA * 0.7 : baseA) * depthA * (1 + hot * 0.6);
        ctx.strokeStyle = `rgba(${col},${Math.min(1, al)})`;
        ctx.lineWidth = hot > 0.04 ? 1.4 : 1;
        if (hot > 0.3) { ctx.shadowColor = `rgba(${COL.hot},0.6)`; ctx.shadowBlur = 8; }
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    function drawNodes(verts, yaw, pitch, scale, off, scanY, band) {
      const P = verts.map(v => projV(v, yaw, pitch, scale, off));
      P.forEach((p) => {
        const dep = Math.max(0, Math.min(1, (p.depth + 2.2) / 4.4));
        const hot = hotness(p.y, scanY, band);
        const r = (1.6 + dep * 1.8) * (1 + hot * 0.6);
        ctx.fillStyle = hot > 0.04 ? `rgba(${COL.hot},${0.7 + dep * 0.3})` : `rgba(${COL.node},${0.45 + dep * 0.5})`;
        if (hot > 0.3) { ctx.shadowColor = `rgba(${COL.hot},0.8)`; ctx.shadowBlur = 10; }
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    if (!reduce && opts.parallax !== false) {
      window.addEventListener('mousemove', (e) => {
        tmx = (e.clientX / window.innerWidth - 0.5) * 24;
        tmy = (e.clientY / window.innerHeight - 0.5) * 16;
      });
    }

    window.addEventListener('resize', resize);
    if (window.ResizeObserver) { new ResizeObserver(resize).observe(canvas); }
    resize();
    frame(performance.now());
  }

  window.mountVellumHero = mountVellumHero;
})();
