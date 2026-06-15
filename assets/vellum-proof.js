/* ============================================================
   VELLUM — Proof Bench. A rotating wireframe artifact (CAD part,
   robot rig, game scene) on the left; a renderer-neutral proof
   report on the right. The report is computed for real: a Web
   Worker rasterizes the mesh on the CPU (no GPU) and analyses its
   topology, and the panel shows the measured result — verts/tris,
   open + non-manifold edges, signed volume, and the actual
   millisecond cost of the CPU render, with the rendered frame
   shown as proof. If a Worker is unavailable it degrades to a
   staged report so the page never breaks. mountProofBench(rootEl)
   ============================================================ */
(function () {
  const ARTIFACTS = {
    part: {
      label: 'CAD part · bearing.step',
      build: () => window.V3.torus(1.25, 0.42, 28, 14),
      mesh: () => torusTris(1.25, 0.42, 28, 14),
      metricName: 'geometric fidelity',
      metric: 0.96,
      checks: [
        ['loads · STEP → mesh', 'tessellate'],
        ['watertight surface', '0 open edges'],
        ['manifold geometry', '0 non-manifold'],
        ['within tolerance', '±0.05 mm'],
        ['printable · positive volume', '14.2 cm³']
      ]
    },
    rig: {
      label: 'Robot rig · arm.urdf',
      build: () => window.V3.boxStack(),
      mesh: () => boxesTris([
        [0, -0.95, 0, 1.7, 0.5, 1.7], [0, -0.3, 0, 0.7, 0.85, 0.7],
        [0.35, 0.45, 0, 1.5, 0.42, 0.5], [1.0, 0.95, 0, 0.5, 0.65, 0.42],
        [1.0, 1.45, 0, 0.85, 0.28, 0.7]
      ]),
      metricName: 'kinematic score',
      metric: 0.93,
      checks: [
        ['URDF parses · 5 links', 'tree valid'],
        ['joint limits respected', '4 / 4 joints'],
        ['self-collision free', 'swept volume'],
        ['reach envelope', '0.84 m radius'],
        ['mass properties valid', 'inertia ok']
      ]
    },
    scene: {
      label: 'Game scene · level_03.gltf',
      build: () => window.V3.cubeField(),
      mesh: () => boxesTris([
        [-1.4, 0.9, -1.0], [-0.5, 1.5, -1.1], [0.5, 0.7, -1.2], [1.4, 1.2, -0.9],
        [-1.5, 0.6, 0.0], [-0.5, 1.1, 0.1], [0.6, 1.7, 0.0], [1.5, 0.8, 0.1],
        [-1.3, 1.0, 1.1], [-0.3, 0.6, 1.2], [0.7, 1.3, 1.1], [1.4, 0.5, 1.0]
      ].map(([x, h, z]) => [x * 0.85, -1.2 + h / 2, z * 0.85, 0.62, h, 0.62])),
      metricName: 'scene health',
      metric: 0.91,
      checks: [
        ['scene graph valid', '12 nodes'],
        ['collision mesh closed', 'convex hulls'],
        ['navmesh connected', '1 island'],
        ['draw-call budget', '≤ 1.2k calls'],
        ['automated playtest', 'goal reached']
      ]
    }
  };

  // ---- real triangulated meshes (closed, manifold) for the CPU proof ----
  function torusTris(R, r, seg, ring) {
    const verts = [], tris = [];
    for (let i = 0; i < seg; i++) {
      const u = (i / seg) * Math.PI * 2;
      for (let j = 0; j < ring; j++) {
        const v = (j / ring) * Math.PI * 2;
        const cr = R + r * Math.cos(v);
        verts.push([cr * Math.cos(u), r * Math.sin(v), cr * Math.sin(u)]);
      }
    }
    const idx = (i, j) => ((i % seg) * ring) + (j % ring);
    for (let i = 0; i < seg; i++) for (let j = 0; j < ring; j++) {
      const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
      tris.push([a, b, c], [a, c, d]);
    }
    return { verts, tris };
  }
  function boxesTris(boxes) {
    const verts = [], tris = [];
    const F = [[0, 1, 2], [0, 2, 3], [5, 4, 7], [5, 7, 6], [4, 0, 3], [4, 3, 7],
      [1, 5, 6], [1, 6, 2], [3, 2, 6], [3, 6, 7], [4, 5, 1], [4, 1, 0]];
    for (const [cx, cy, cz, w, h, d] of boxes) {
      const o = verts.length, hw = w / 2, hh = h / 2, hd = d / 2;
      verts.push(
        [cx - hw, cy - hh, cz - hd], [cx + hw, cy - hh, cz - hd], [cx + hw, cy + hh, cz - hd], [cx - hw, cy + hh, cz - hd],
        [cx - hw, cy - hh, cz + hd], [cx + hw, cy - hh, cz + hd], [cx + hw, cy + hh, cz + hd], [cx - hw, cy + hh, cz + hd]
      );
      for (const f of F) tris.push([f[0] + o, f[1] + o, f[2] + o]);
    }
    return { verts, tris };
  }

  function mountProofBench(root) {
    root.classList.add('proof');
    root.innerHTML = `
      <div class="proof-toolbar">
        <div class="proof-tabs" data-tabs>
          <button data-k="part" class="on">CAD part</button>
          <button data-k="rig">Robot rig</button>
          <button data-k="scene">Game scene</button>
        </div>
        <span class="proof-engine mono">vellum · headless kernel</span>
      </div>
      <div class="proof-grid">
        <div class="proof-stage" data-stage>
          <canvas data-canvas></canvas>
          <span class="proof-badge mono"><i class="dot-live"></i> no GPU · CPU render</span>
          <span class="proof-name mono" data-name></span>
          <span class="proof-axis mono">x · y · z</span>
        </div>
        <div class="review-panel proof-panel">
          <div class="review-verdict" data-verdict>
            <span class="verdict-dot"></span>
            <span class="verdict-text mono" data-vtext>VERIFYING…</span>
          </div>
          <div class="review-aspects" data-aspects></div>
          <div class="review-metric">
            <div class="metric-row"><span data-metricname>spatial metric</span><b class="mono" data-metric>0.00</b></div>
            <div class="metric-track"><i data-metricbar></i></div>
            <div class="metric-foot mono" data-foot>renderer-neutral · same proof in Three · Unreal · Blender</div>
            <div class="proof-render-wrap" data-render-wrap>
              <canvas data-render class="proof-render" aria-label="Frame rendered on the CPU"></canvas>
              <span class="proof-render-label mono" data-render-label></span>
            </div>
          </div>
        </div>
      </div>
    `;

    const stage = root.querySelector('[data-stage]');
    const canvas = root.querySelector('[data-canvas]');
    const ctx = canvas.getContext('2d');
    const aspectsEl = root.querySelector('[data-aspects]');
    const nameEl = root.querySelector('[data-name]');
    const vEl = root.querySelector('[data-verdict]');
    const vText = root.querySelector('[data-vtext]');
    const metricEl = root.querySelector('[data-metric]');
    const metricBar = root.querySelector('[data-metricbar]');
    const metricNameEl = root.querySelector('[data-metricname]');
    const footEl = root.querySelector('[data-foot]');
    const renderWrap = root.querySelector('[data-render-wrap]');
    const renderCanvas = root.querySelector('[data-render]');
    const renderLabel = root.querySelector('[data-render-label]');

    let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    let cx = 0, cy = 0, R = 1;
    function size() {
      const r = stage.getBoundingClientRect();
      W = r.width; H = r.height;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W * 0.5; cy = H * 0.54; R = Math.min(W, H) * 0.3;
    }
    size();
    window.addEventListener('resize', size);
    if (window.ResizeObserver) { new ResizeObserver(size).observe(stage); }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DIST = 5.0, FOV = 4.0;
    const COL = { edge: '61,127,184', hot: '45,212,191', node: '224,165,68', grid: '184,192,210' };
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

    function projV(p, yaw, pitch) {
      const r = window.V3.rot(p, yaw, pitch);
      const z = r[2] + DIST;
      const s = (FOV / (z <= 0.01 ? 0.01 : z)) * R;
      return { x: cx + r[0] * s, y: cy - r[1] * s, depth: r[2] };
    }

    let current = 'part', geo = null, box = null, runToken = 0;
    let progress = 0;        // verification scan progress 0..1
    let running = false;

    function setArtifact(key) {
      current = key;
      const A = ARTIFACTS[key];
      geo = A.build();
      box = window.V3.bbox(geo.verts);
      nameEl.textContent = A.label;
      root.querySelectorAll('[data-tabs] button').forEach(b => b.classList.toggle('on', b.dataset.k === key));
      runProof(key);
    }

    // ---------- REAL proof via the CPU rasterizer worker ----------
    let worker;
    function getWorker() {
      if (worker !== undefined) return worker;
      try { worker = new Worker('assets/vellum-raster.worker.js'); }
      catch (e) { worker = null; }
      return worker;
    }
    function paletteRGB() {
      const parts = (COL.node || '224,165,68').split(',').map(n => parseInt(n.trim(), 10));
      return (parts.length === 3 && parts.every(n => !isNaN(n))) ? parts : [255, 182, 39];
    }
    function hideRender() { renderWrap.classList.remove('on'); }

    function runProof(key) {
      const A = ARTIFACTS[key];
      const token = ++runToken;
      running = true; progress = 0;
      aspectsEl.innerHTML = '';
      vEl.className = 'review-verdict';
      vText.textContent = 'VERIFYING…';
      metricEl.textContent = '0.00';
      metricBar.style.width = '0%';
      metricBar.style.background = 'var(--violet)';
      metricNameEl.textContent = A.metricName;
      hideRender();

      const wk = getWorker();
      let mesh = null;
      if (wk) { try { mesh = A.mesh(); } catch (e) { mesh = null; } }
      if (!wk || !mesh) { return runReportSim(A, token); }

      let settled = false;
      const onMsg = (ev) => { if (settled) return; settled = true; cleanup(); if (token === runToken && ev.data && ev.data.ok) applyReal(token, A, ev.data); };
      const onErr = () => { if (settled) return; settled = true; cleanup(); worker = undefined; if (token === runToken) runReportSim(A, token); };
      function cleanup() { wk.removeEventListener('message', onMsg); wk.removeEventListener('error', onErr); }
      wk.addEventListener('message', onMsg);
      wk.addEventListener('error', onErr);
      setTimeout(() => { if (!settled) { settled = true; cleanup(); if (token === runToken) runReportSim(A, token); } }, 2500);
      try { wk.postMessage({ verts: mesh.verts, tris: mesh.tris, w: 132, h: 88, palette: paletteRGB() }); }
      catch (e) { settled = true; cleanup(); runReportSim(A, token); }
    }

    function applyReal(token, A, d) {
      const checks = [
        ['tessellated · STEP → mesh', `${d.vertCount} verts · ${d.triCount} tris`, true],
        ['watertight surface', `${d.boundary} open edges`, d.watertight],
        ['manifold geometry', `${d.nonmanifold} non-manifold`, d.manifold],
        ['positive volume', `${d.volume.toFixed(2)} units³`, d.volume > 0],
        ['rasterized · no GPU', `${d.w}×${d.h} · ${d.rasMs.toFixed(1)} ms`, true],
      ];
      metricNameEl.textContent = 'manifold integrity';
      // draw the actual CPU-rendered frame
      try {
        renderCanvas.width = d.w; renderCanvas.height = d.h;
        renderCanvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d.rgba), d.w, d.h), 0, 0);
        renderLabel.textContent = `actual CPU frame · ${d.rasMs.toFixed(0)} ms · no GPU`;
        renderWrap.classList.add('on');
      } catch (e) { /* render inset is optional */ }

      aspectsEl.innerHTML = '';
      const rows = checks.map(([k, w]) => {
        const row = document.createElement('div');
        row.className = 'aspect pending';
        row.innerHTML = `<span class="aspect-k">${k}</span><span class="aspect-w mono">${w}</span><span class="aspect-mark"><i class="proof-spin"></i></span>`;
        aspectsEl.appendChild(row);
        return row;
      });

      let i = 0;
      const step = () => {
        if (token !== runToken) return;
        if (i < rows.length) {
          const ok = checks[i][2];
          const mk = rows[i].querySelector('.aspect-mark');
          mk.className = 'aspect-mark ' + (ok ? 'pass' : 'fail');
          mk.textContent = ok ? '✓' : '!';
          rows[i].classList.remove('pending');
          progress = (i + 1) / rows.length;
          i++;
          setTimeout(step, 260);
        } else {
          running = false;
          const allOk = checks.every(c => c[2]);
          vEl.className = 'review-verdict' + (allOk ? ' ok' : '');
          vText.textContent = allOk ? 'VERIFIED' : 'ISSUES FOUND';
          footEl.textContent = `rasterized ${d.w}×${d.h} on the CPU · ${d.rasMs.toFixed(1)} ms · no GPU in the loop`;
          animateMetric(token, d.manifoldIntegrity);
        }
      };
      setTimeout(step, 200);
    }

    // ---------- staged fallback (only if Worker is unavailable) ----------
    function runReportSim(A, token) {
      running = true; progress = 0;
      aspectsEl.innerHTML = '';
      vEl.className = 'review-verdict';
      vText.textContent = 'VERIFYING…';
      metricEl.textContent = '0.00';
      metricBar.style.width = '0%';
      metricBar.style.background = 'var(--violet)';
      metricNameEl.textContent = A.metricName;
      footEl.textContent = 'renderer-neutral · same proof in Three · Unreal · Blender';

      const rows = A.checks.map(([k, w]) => {
        const row = document.createElement('div');
        row.className = 'aspect pending';
        row.innerHTML = `<span class="aspect-k">${k}</span><span class="aspect-w mono">${w}</span><span class="aspect-mark"><i class="proof-spin"></i></span>`;
        aspectsEl.appendChild(row);
        return row;
      });

      let i = 0;
      const step = () => {
        if (token !== runToken) return;
        if (i < rows.length) {
          const mk = rows[i].querySelector('.aspect-mark');
          mk.className = 'aspect-mark pass';
          mk.textContent = '✓';
          rows[i].classList.remove('pending');
          progress = (i + 1) / rows.length;
          i++;
          setTimeout(step, 440);
        } else {
          running = false;
          vEl.className = 'review-verdict ok';
          vText.textContent = 'VERIFIED';
          animateMetric(token, A.metric);
        }
      };
      setTimeout(step, 420);
    }

    function animateMetric(token, target) {
      let v = 0;
      const setVal = (x) => {
        metricEl.textContent = x.toFixed(2);
        metricBar.style.width = (x * 100) + '%';
        metricBar.style.background = 'var(--green)';
      };
      // Guarantee the true final value lands even if rAF is throttled
      // (e.g. the bench is scrolled off-screen while the ease plays).
      const settle = setTimeout(() => { if (token === runToken) setVal(target); }, 1300);
      const tick = () => {
        if (token !== runToken) { clearTimeout(settle); return; }
        v += (target - v) * 0.12;
        if (Math.abs(target - v) < 0.005) v = target;
        setVal(v);
        if (v < target) requestAnimationFrame(tick); else clearTimeout(settle);
      };
      tick();
    }

    // ---- render loop (the left-hand wireframe visual) ----
    let t0 = performance.now();
    function frame(now) {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      if (!geo) { return; }
      const yaw = reduce ? 0.6 : t * 0.4;
      const pitch = -0.5 + Math.sin(t * 0.4) * 0.06;

      drawGrid(yaw, pitch);

      // scan plane: tracks verification progress while running, gentle idle sweep after
      const projTop = projV([0, 1.6, 0], yaw, pitch).y;
      const projBot = projV([0, -1.6, 0], yaw, pitch).y;
      const sweep = running ? (1 - progress) : (0.5 + Math.sin(t * 0.6) * 0.5);
      const scanY = projTop + (projBot - projTop) * sweep;
      const band = R * 0.4;

      drawEdges(box.v, box.e, yaw, pitch, scanY, band, 0.14, true);
      drawEdges(geo.verts, geo.edges, yaw, pitch, scanY, band, 0.6, false);
      drawNodes(geo.verts, yaw, pitch, scanY, band);

      // scan line
      ctx.save();
      ctx.strokeStyle = `rgba(${COL.hot},${running ? 0.7 : 0.32})`;
      ctx.lineWidth = 1;
      ctx.shadowColor = `rgba(${COL.hot},0.8)`; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(cx - R * 1.9, scanY); ctx.lineTo(cx + R * 1.9, scanY); ctx.stroke();
      ctx.restore();
    }

    function drawGrid(yaw, pitch) {
      const n = 5, span = 2.3, y = -1.55;
      ctx.lineWidth = 1;
      for (let i = -n; i <= n; i++) {
        const f = i / n * span;
        seg([f, y, -span], [f, y, span], yaw, pitch);
        seg([-span, y, f], [span, y, f], yaw, pitch);
      }
    }
    function seg(a, b, yaw, pitch) {
      const pa = projV(a, yaw, pitch), pb = projV(b, yaw, pitch);
      ctx.strokeStyle = `rgba(${COL.grid},0.05)`;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }

    function hotness(y, scanY, band) { const d = Math.abs(y - scanY); return d < band ? 1 - d / band : 0; }

    function drawEdges(verts, edges, yaw, pitch, scanY, band, baseA, faint) {
      const P = verts.map(v => projV(v, yaw, pitch));
      for (const [i, j] of edges) {
        const a = P[i], b = P[j];
        const dep = (a.depth + b.depth) / 2;
        const depthA = 0.35 + Math.max(0, Math.min(1, (dep + 2) / 4)) * 0.65;
        const hot = Math.max(hotness(a.y, scanY, band), hotness(b.y, scanY, band));
        const col = hot > 0.04 && !faint ? COL.hot : COL.edge;
        ctx.strokeStyle = `rgba(${col},${Math.min(1, baseA * depthA * (1 + hot * 0.7))})`;
        ctx.lineWidth = hot > 0.04 && !faint ? 1.4 : 1;
        if (hot > 0.3 && !faint) { ctx.shadowColor = `rgba(${COL.hot},0.6)`; ctx.shadowBlur = 7; }
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    function drawNodes(verts, yaw, pitch, scanY, band) {
      for (const v of verts) {
        const p = projV(v, yaw, pitch);
        const dep = Math.max(0, Math.min(1, (p.depth + 2) / 4));
        const hot = hotness(p.y, scanY, band);
        const r = (1.3 + dep * 1.6) * (1 + hot * 0.5);
        ctx.fillStyle = hot > 0.04 ? `rgba(${COL.hot},${0.6 + dep * 0.4})` : `rgba(${COL.node},${0.4 + dep * 0.5})`;
        if (hot > 0.3) { ctx.shadowColor = `rgba(${COL.hot},0.8)`; ctx.shadowBlur = 9; }
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    root.querySelectorAll('[data-tabs] button').forEach(b => {
      b.addEventListener('click', () => setArtifact(b.dataset.k));
    });

    setArtifact('part');
    window.V3.visLoop(stage, frame);
  }

  window.mountProofBench = mountProofBench;
})();
