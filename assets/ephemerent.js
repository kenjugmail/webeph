/* ============================================================
   EPHEMERENT — emergence figure. Ink-on-paper node network that
   drifts, connects, and dissolves. A research diagram, not a
   product visual. Transparent background (paper shows through).
   mountEmergence(canvas, opts)
   ============================================================ */
(function () {
  function mountEmergence(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    let nodes = [];
    const INK = '23,22,15';
    const ACC = '21,96,84';
    const LINK = opts.link || 92;          // connect distance
    const density = opts.density || 7800;  // px^2 per node

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function spawn(n, seed) {
      n.x = Math.random() * W;
      n.y = Math.random() * H;
      n.vx = rnd(-0.18, 0.18);
      n.vy = rnd(-0.18, 0.18);
      n.r = rnd(1.1, 2.6);
      n.acc = Math.random() < 0.22;
      n.max = rnd(6, 13);                  // lifespan seconds
      n.life = seed ? Math.random() * n.max : 0;
    }

    function init() {
      nodes = [];
      const count = Math.max(10, Math.round((W * H) / density));
      for (let i = 0; i < count; i++) { const n = {}; spawn(n, true); nodes.push(n); }
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      init();
    }

    function alphaFor(n) {
      const u = n.life / n.max;
      if (u < 0.12) return u / 0.12;
      if (u > 0.8) return Math.max(0, (1 - u) / 0.2);
      return 1;
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);

      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        n.life += dt;
        if (n.life >= n.max) spawn(n, false);
      }

      // links
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i], aa = alphaFor(a);
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < LINK) {
            const al = (1 - d / LINK) * 0.5 * aa * alphaFor(b);
            ctx.strokeStyle = `rgba(${(a.acc || b.acc) ? ACC : INK},${al})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      // nodes
      for (const n of nodes) {
        const a = alphaFor(n);
        ctx.fillStyle = `rgba(${n.acc ? ACC : INK},${0.85 * a})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }

      requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    resize();
    frame(performance.now());
  }

  window.mountEmergence = mountEmergence;
})();
