/* ============================================================
   EPHEMERENT — emergence figure. Ink-on-paper node network that
   drifts, connects, and dissolves. A research diagram, not a
   product visual. Transparent background (paper shows through).
   mountEmergence(canvas, opts)

   Performance-guarded: hard node cap, IntersectionObserver pause
   when off-screen, tab-visibility pause, and a static single frame
   under prefers-reduced-motion. Never burns frames off-screen.
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
    const CAP = opts.cap || 130;           // hard node cap — bounds the O(n^2) link pass
    const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

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
      const count = Math.min(CAP, Math.max(10, Math.round((W * H) / density)));
      for (let i = 0; i < count; i++) { const n = {}; spawn(n, true); nodes.push(n); }
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      init();
      if (!running) draw(0);  // keep a correct static frame when paused
    }

    function alphaFor(n) {
      const u = n.life / n.max;
      if (u < 0.12) return u / 0.12;
      if (u > 0.8) return Math.max(0, (1 - u) / 0.2);
      return 1;
    }

    function draw(dt) {
      ctx.clearRect(0, 0, W, H);

      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        n.life += dt;
        if (n.life >= n.max) spawn(n, false);
      }

      // links (O(n^2), bounded by CAP)
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
    }

    // ---- run loop, gated by visibility + reduced-motion ----
    let running = false, rafId = 0, last = 0, onScreen = false;

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      draw(dt);
      if (running) rafId = requestAnimationFrame(frame);
    }
    function start() {
      if (running || reduceMQ.matches || !onScreen || document.hidden) return;
      running = true; last = performance.now();
      rafId = requestAnimationFrame(frame);
    }
    function stop() {
      running = false; cancelAnimationFrame(rafId);
    }

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
    reduceMQ.addEventListener?.('change', () => { reduceMQ.matches ? (stop(), draw(0)) : start(); });

    // Only animate while the canvas is actually in view.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        onScreen = entries[0].isIntersecting;
        onScreen ? start() : stop();
      }, { threshold: 0.05 }).observe(canvas);
    } else {
      onScreen = true;
    }

    resize();
    if (reduceMQ.matches) {
      draw(0);                 // one static frame, no loop
    } else {
      onScreen = true; start(); // start; IO will pause it when scrolled away
    }
  }

  window.mountEmergence = mountEmergence;
})();
