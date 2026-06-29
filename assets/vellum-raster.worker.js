/* ============================================================
   VELLUM — real CPU rasterizer + mesh verifier (Web Worker).
   Runs OFF the main thread, with NO GPU. Given a triangle mesh it
   actually: (1) analyses half-edge topology for watertightness and
   manifoldness, (2) integrates signed volume (divergence theorem),
   (3) rasterizes the triangles with a z-buffer and Lambert shading
   into an RGBA buffer, timing the work. Everything it reports is
   measured, not staged. This is what makes Vellum's "prove, don't
   eyeball — no GPU in the loop" claim literally true.
   ============================================================ */

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
// signed area of triangle (a,b) sweeping to p, in screen space
function edge(ax, ay, bx, by, px, py) { return (bx - ax) * (py - ay) - (by - ay) * (px - ax); }

self.onmessage = (e) => {
  const { verts, tris, w, h, palette } = e.data;
  const t0 = (self.performance || Date).now();

  // ---------- topology: count how many triangles share each edge ----------
  const ec = new Map();
  const key = (a, b) => (a < b ? a + ':' + b : b + ':' + a);
  for (let i = 0; i < tris.length; i++) {
    const f = tris[i];
    for (let k = 0; k < 3; k++) {
      const u = f[k], v = f[(k + 1) % 3];
      const kk = key(u, v);
      ec.set(kk, (ec.get(kk) || 0) + 1);
    }
  }
  let boundary = 0, nonmanifold = 0, total = 0;
  for (const n of ec.values()) { total++; if (n === 1) boundary++; else if (n > 2) nonmanifold++; }
  const manifoldIntegrity = total ? (total - boundary - nonmanifold) / total : 0;
  const watertight = boundary === 0;
  const manifold = nonmanifold === 0;

  // ---------- signed volume via divergence theorem: V = (1/6) Σ v0·(v1×v2) ----------
  let vol6 = 0;
  for (let i = 0; i < tris.length; i++) {
    const p = verts[tris[i][0]], q = verts[tris[i][1]], r = verts[tris[i][2]];
    vol6 += p[0] * (q[1] * r[2] - q[2] * r[1])
          - p[1] * (q[0] * r[2] - q[2] * r[0])
          + p[2] * (q[0] * r[1] - q[1] * r[0]);
  }
  const volume = Math.abs(vol6) / 6;

  // ---------- rasterize: perspective project, z-buffer, Lambert shade ----------
  const tRas = (self.performance || Date).now();
  const dist = 5.0, fov = 4.0, R = Math.min(w, h) * 0.34, cx = w * 0.5, cy = h * 0.52;
  const yaw = 0.7, pitch = -0.5;
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw), cpit = Math.cos(pitch), spit = Math.sin(pitch);
  function rot(p) {
    const x = p[0], y = p[1], z = p[2];
    const x1 = x * cyaw + z * syaw;
    const z1 = -x * syaw + z * cyaw;
    const y1 = y * cpit - z1 * spit;
    const z2 = y * spit + z1 * cpit;
    return [x1, y1, z2];
  }
  const rv = new Array(verts.length);     // rotated (view-space) verts
  const sx = new Float32Array(verts.length), sy = new Float32Array(verts.length), sz = new Float32Array(verts.length);
  for (let i = 0; i < verts.length; i++) {
    const r = rot(verts[i]); rv[i] = r;
    const z = r[2] + dist; const s = (fov / (z <= 0.01 ? 0.01 : z)) * R;
    sx[i] = cx + r[0] * s; sy[i] = cy - r[1] * s; sz[i] = r[2];
  }

  const zbuf = new Float32Array(w * h); zbuf.fill(Infinity);
  const rgba = new Uint8ClampedArray(w * h * 4);
  const light = norm([0.45, 0.75, 0.55]);
  // theme colour (amber phosphor by default), passed in as [r,g,b]
  const base = palette && palette.length === 3 ? palette : [255, 182, 39];
  const hot = [255, 240, 207];

  for (let i = 0; i < tris.length; i++) {
    const ia = tris[i][0], ib = tris[i][1], ic = tris[i][2];
    const ax = sx[ia], ay = sy[ia], bx = sx[ib], by = sy[ib], cx2 = sx[ic], cy2 = sy[ic];
    const area = edge(ax, ay, bx, by, cx2, cy2);
    if (Math.abs(area) < 1e-6) continue;
    const n = norm(cross(sub(rv[ib], rv[ia]), sub(rv[ic], rv[ia])));
    // abs() so both faces shade (winding-agnostic), then bias up
    const shade = 0.20 + 0.80 * Math.abs(n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx2)));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx2)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy2)));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy2)));
    const inv = 1 / area;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = edge(bx, by, cx2, cy2, px, py) * inv;
        const w1 = edge(cx2, cy2, ax, ay, px, py) * inv;
        const w2 = edge(ax, ay, bx, by, px, py) * inv;
        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
          const z = w0 * sz[ia] + w1 * sz[ib] + w2 * sz[ic];
          const idx = y * w + x;
          if (z < zbuf[idx]) {
            zbuf[idx] = z;
            // depth fog toward the hot colour near camera
            const fog = Math.max(0, Math.min(1, (z + 1.8) / 3.6));
            const o = idx * 4;
            rgba[o]     = (base[0] * fog + hot[0] * (1 - fog)) * shade;
            rgba[o + 1] = (base[1] * fog + hot[1] * (1 - fog)) * shade;
            rgba[o + 2] = (base[2] * fog + hot[2] * (1 - fog)) * shade;
            rgba[o + 3] = 255;
          }
        }
      }
    }
  }

  let covered = 0;
  for (let i = 0; i < zbuf.length; i++) if (zbuf[i] !== Infinity) covered++;

  const now = (self.performance || Date).now();
  self.postMessage({
    ok: true,
    vertCount: verts.length,
    triCount: tris.length,
    boundary, nonmanifold, manifoldIntegrity, watertight, manifold,
    volume,
    w, h,
    rasMs: now - tRas,
    totalMs: now - t0,
    covered,
    coverage: covered / (w * h),
    rgba: rgba.buffer,
  }, [rgba.buffer]);
};
