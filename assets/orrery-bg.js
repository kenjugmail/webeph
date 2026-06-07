/* ============================================================
   ORRERY — hero canvas. A clockwork solar system of agents
   orbiting a central goal. Tilted orbits for a 3D instrument feel.
   mountOrrery(canvasId, opts)
   ============================================================ */
(function () {
  function mountOrrery(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    let cx = 0, cy = 0;
    const tilt = opts.tilt != null ? opts.tilt : 0.42;     // y-squash for perspective
    let mx = 0, my = 0, tmx = 0, tmy = 0;                  // parallax

    const COLORS = {
      sun:   '#f4cd7a',
      ring:  'rgba(168,162,220,0.16)',
      ringHot: 'rgba(232,176,75,0.30)'
    };

    // Agent orbits. r = orbit radius factor (of min dim), speed rad/s, phase, color, label, size
    const orbits = [
      { r: 0.115, s:  0.55, p: 0.0, c: '#5ff0dc', label: 'plan',     sz: 5.5 },
      { r: 0.185, s: -0.40, p: 1.2, c: '#6aa8de', label: 'edit·a',   sz: 7   },
      { r: 0.185, s: -0.40, p: 3.6, c: '#6aa8de', label: 'edit·b',   sz: 7   },
      { r: 0.265, s:  0.30, p: 0.6, c: '#2dd4bf', label: 'tests',    sz: 6.5 },
      { r: 0.265, s:  0.30, p: 4.0, c: '#2dd4bf', label: 'lint',     sz: 5.5 },
      { r: 0.350, s: -0.22, p: 2.1, c: '#e0a544', label: 'review',   sz: 7.5 },
      { r: 0.350, s: -0.22, p: 5.0, c: '#3d7fb8', label: 'shader',   sz: 6.5 },
      { r: 0.430, s:  0.16, p: 0.3, c: '#5ff0dc', label: 'merge',    sz: 6   },
    ];

    // background stars
    let stars = [];
    function seedStars() {
      stars = [];
      const n = Math.floor((W * H) / 9000);
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 1.3 + 0.2,
          tw: Math.random() * Math.PI * 2,
          tws: Math.random() * 1.5 + 0.3,
          d: Math.random() * 0.4 + 0.2  // parallax depth
        });
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W * (opts.cxf != null ? opts.cxf : 0.5);
      cy = H * (opts.cyf != null ? opts.cyf : 0.5);
      seedStars();
    }

    function ellipsePoint(rad, ang) {
      return { x: cx + Math.cos(ang) * rad + mx, y: cy + Math.sin(ang) * rad * tilt + my };
    }

    let t0 = performance.now();
    function frame(now) {
      const t = (now - t0) / 1000;
      mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
      const minD = Math.min(W, H);

      ctx.clearRect(0, 0, W, H);

      // stars
      for (const s of stars) {
        const a = 0.35 + Math.sin(s.tw + now * 0.001 * s.tws) * 0.3;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = '#cfd0ff';
        ctx.beginPath();
        ctx.arc(s.x + mx * s.d * 2, s.y + my * s.d * 2, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // orbit rings (draw unique radii)
      const drawn = new Set();
      for (const o of orbits) {
        const rad = o.r * minD;
        const key = Math.round(rad);
        if (drawn.has(key)) continue;
        drawn.add(key);
        ctx.beginPath();
        ctx.ellipse(cx + mx, cy + my, rad, rad * tilt, 0, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.ring;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // sun glow
      const pulse = 1 + Math.sin(now * 0.0016) * 0.06;
      const sunR = minD * 0.052 * pulse;
      const g = ctx.createRadialGradient(cx + mx, cy + my, 0, cx + mx, cy + my, sunR * 6);
      g.addColorStop(0, 'rgba(244,205,122,0.55)');
      g.addColorStop(0.25, 'rgba(232,176,75,0.22)');
      g.addColorStop(0.6, 'rgba(61,127,184,0.10)');
      g.addColorStop(1, 'rgba(61,127,184,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx + mx, cy + my, sunR * 6, 0, Math.PI * 2);
      ctx.fill();

      // sun core
      const cg = ctx.createRadialGradient(cx + mx, cy + my, 0, cx + mx, cy + my, sunR);
      cg.addColorStop(0, '#fff6e3');
      cg.addColorStop(0.5, COLORS.sun);
      cg.addColorStop(1, '#d99537');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx + mx, cy + my, sunR, 0, Math.PI * 2);
      ctx.fill();

      // agents — compute positions
      const pts = orbits.map(o => {
        const ang = o.p + t * o.s;
        const rad = o.r * minD;
        const p = ellipsePoint(rad, ang);
        // depth: behind sun when sin(ang) < 0 (top of ellipse) -> dim slightly
        const depth = (Math.sin(ang) + 1) / 2; // 0 back .. 1 front
        return { ...p, o, depth, ang };
      });

      // connection filaments (sun -> agent), faint
      for (const pt of pts) {
        ctx.beginPath();
        ctx.moveTo(cx + mx, cy + my);
        ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = `rgba(61,127,184,${0.04 + pt.depth * 0.05})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // sort by depth so front agents draw last
      pts.sort((a, b) => a.depth - b.depth);

      for (const pt of pts) {
        const o = pt.o;
        const scale = 0.55 + pt.depth * 0.6;
        const r = o.sz * scale;
        // glow
        const ag = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r * 4);
        ag.addColorStop(0, hexA(o.c, 0.5));
        ag.addColorStop(1, hexA(o.c, 0));
        ctx.fillStyle = ag;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, r * 4, 0, Math.PI * 2); ctx.fill();
        // body
        ctx.fillStyle = o.c;
        ctx.globalAlpha = 0.55 + pt.depth * 0.45;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
        // bright core
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(pt.x - r * 0.25, pt.y - r * 0.25, r * 0.32, 0, Math.PI * 2); ctx.fill();

        // label (front only)
        if (pt.depth > 0.45 && opts.labels !== false) {
          ctx.globalAlpha = (pt.depth - 0.45) / 0.55;
          ctx.font = '500 11px "IBM Plex Mono", monospace';
          ctx.fillStyle = 'rgba(237,236,246,0.85)';
          ctx.textAlign = 'left';
          ctx.fillText(o.label, pt.x + r + 7, pt.y + 3.5);
          ctx.globalAlpha = 1;
        }
      }

      requestAnimationFrame(frame);
    }

    function hexA(hex, a) {
      const h = hex.replace('#', '');
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }

    // parallax (only when not reduced motion)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && opts.parallax !== false) {
      window.addEventListener('mousemove', (e) => {
        tmx = (e.clientX / window.innerWidth - 0.5) * 26;
        tmy = (e.clientY / window.innerHeight - 0.5) * 18;
      });
    }

    window.addEventListener('resize', resize);
    resize();
    frame(performance.now()); // synchronous first paint, then self-schedules
  }

  window.mountOrrery = mountOrrery;
})();
