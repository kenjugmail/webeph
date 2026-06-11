/* ============================================================
   VELLUM — shared software-3D helper. Pure-canvas wireframe
   projection + a small library of procedural geometry. No GPU,
   no WebGL — fitting for an engine that proves 3D headlessly.
   window.V3 : { rot, project, normalize, icosphere, torus,
                 boxStack, cubeField, boxEdges, bbox }
   ============================================================ */
(function () {
  const V3 = {};

  // rotate point [x,y,z]: yaw around Y, then pitch around X
  V3.rot = function (p, yaw, pitch) {
    const x = p[0], y = p[1], z = p[2];
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y1 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return [x1, y1, z2];
  };

  // perspective project -> {x, y, depth, s}
  V3.project = function (p, cx, cy, dist, fov) {
    const z = p[2] + dist;
    const s = fov / (z <= 0.01 ? 0.01 : z);
    return { x: cx + p[0] * s, y: cy - p[1] * s, depth: p[2], s };
  };

  V3.normalize = function (v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };

  function edgeKey(a, b) { return a < b ? a + '_' + b : b + '_' + a; }

  // ---- geodesic icosphere ----
  V3.icosphere = function (subdiv) {
    const t = (1 + Math.sqrt(5)) / 2;
    let verts = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
    ].map(V3.normalize);
    let faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];
    for (let s = 0; s < (subdiv || 0); s++) {
      const mid = {};
      const nf = [];
      const midpoint = (a, b) => {
        const k = edgeKey(a, b);
        if (mid[k] != null) return mid[k];
        const va = verts[a], vb = verts[b];
        const m = V3.normalize([(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2]);
        verts.push(m);
        mid[k] = verts.length - 1;
        return mid[k];
      };
      for (const f of faces) {
        const a = midpoint(f[0], f[1]), b = midpoint(f[1], f[2]), c = midpoint(f[2], f[0]);
        nf.push([f[0], a, c], [f[1], b, a], [f[2], c, b], [a, b, c]);
      }
      faces = nf;
    }
    return { verts, edges: edgesFromFaces(faces) };
  };

  function edgesFromFaces(faces) {
    const set = {};
    for (const f of faces) {
      for (let i = 0; i < 3; i++) {
        const a = f[i], b = f[(i + 1) % 3];
        set[edgeKey(a, b)] = a < b ? [a, b] : [b, a];
      }
    }
    return Object.values(set);
  }

  // ---- torus (mechanical ring / bearing) in the XZ plane ----
  V3.torus = function (R, r, seg, ring) {
    const verts = [], edges = [];
    for (let i = 0; i < seg; i++) {
      const u = (i / seg) * Math.PI * 2;
      for (let j = 0; j < ring; j++) {
        const v = (j / ring) * Math.PI * 2;
        const cr = R + r * Math.cos(v);
        verts.push([cr * Math.cos(u), r * Math.sin(v), cr * Math.sin(u)]);
        const cur = i * ring + j;
        const nextRing = i * ring + ((j + 1) % ring);
        const nextSeg = ((i + 1) % seg) * ring + j;
        edges.push([cur, nextRing], [cur, nextSeg]);
      }
    }
    return { verts, edges };
  };

  // ---- single box -> 8 verts + 12 edges, offset into an existing list ----
  V3.boxEdges = function (cx, cy, cz, w, h, d) {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const v = [
      [cx - hw, cy - hh, cz - hd], [cx + hw, cy - hh, cz - hd],
      [cx + hw, cy + hh, cz - hd], [cx - hw, cy + hh, cz - hd],
      [cx - hw, cy - hh, cz + hd], [cx + hw, cy - hh, cz + hd],
      [cx + hw, cy + hh, cz + hd], [cx - hw, cy + hh, cz + hd]
    ];
    const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    return { v, e };
  };

  function combine(parts) {
    const verts = [], edges = [];
    for (const p of parts) {
      const off = verts.length;
      for (const vv of p.v) verts.push(vv);
      for (const ee of p.e) edges.push([ee[0] + off, ee[1] + off]);
    }
    return { verts, edges };
  }

  // ---- articulated stack (robotics arm) ----
  V3.boxStack = function () {
    return combine([
      V3.boxEdges(0, -0.95, 0, 1.7, 0.5, 1.7),      // base
      V3.boxEdges(0, -0.3, 0, 0.7, 0.85, 0.7),      // joint 1
      V3.boxEdges(0.35, 0.45, 0, 1.5, 0.42, 0.5),   // upper arm
      V3.boxEdges(1.0, 0.95, 0, 0.5, 0.65, 0.42),   // forearm
      V3.boxEdges(1.0, 1.45, 0, 0.85, 0.28, 0.7)    // gripper head
    ]);
  };

  // ---- voxel scene field (game scene) ----
  V3.cubeField = function () {
    const parts = [];
    const heights = [
      [-1.4, 0.9, -1.0], [-0.5, 1.5, -1.1], [0.5, 0.7, -1.2], [1.4, 1.2, -0.9],
      [-1.5, 0.6, 0.0], [-0.5, 1.1, 0.1], [0.6, 1.7, 0.0], [1.5, 0.8, 0.1],
      [-1.3, 1.0, 1.1], [-0.3, 0.6, 1.2], [0.7, 1.3, 1.1], [1.4, 0.5, 1.0]
    ];
    for (const [x, h, z] of heights) {
      parts.push(V3.boxEdges(x * 0.85, -1.2 + h / 2, z * 0.85, 0.62, h, 0.62));
    }
    return combine(parts);
  };

  // ---- bounding box for a vert list ----
  V3.bbox = function (verts) {
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const v of verts) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], v[i]); mx[i] = Math.max(mx[i], v[i]); }
    return V3.boxEdges((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2, mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  };

  // ---- visibility-gated render loop ----
  // Runs draw(now) via requestAnimationFrame only while `el` is on screen, so a page
  // full of demo canvases costs nothing once scrolled past (the source of the old lag).
  // With prefers-reduced-motion the scene is drawn once, static, when it first appears.
  V3.visLoop = function (el, draw) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = false, raf = 0;
    function tick(now) {
      raf = 0;
      if (!visible) return;
      draw(now);
      raf = requestAnimationFrame(tick);
    }
    function start() {
      if (reduce) { draw(performance.now()); return; }
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    if (!('IntersectionObserver' in window)) {
      visible = true; start();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        visible = entry.isIntersecting;
        if (visible) start(); else stop();
      }
    }, { rootMargin: '120px' });
    io.observe(el);
  };

  window.V3 = V3;
})();
