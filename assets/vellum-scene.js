/* ============================================================
   VELLUM — Engine editor + play mode. A believable game-engine
   editor: hierarchy · viewport · inspector. Press play and an
   agent runs the level while the playtest proves it (navmesh,
   collision, goal) — all CPU, no GPU. mountScene(rootEl)
   ============================================================ */
(function () {
  function mountScene(root) {
    root.classList.add('engine');
    root.innerHTML = `
      <div class="engine-bar">
        <div class="grp eb-tabs">
          <button class="eb-tab on" data-mode="scene">Scene</button>
          <button class="eb-tab" data-mode="game">Game</button>
        </div>
        <div class="grp eb-tools" aria-hidden="true">
          <span class="eb-tool">↖</span><span class="eb-tool">✥</span><span class="eb-tool">⟲</span><span class="eb-tool">⤢</span>
        </div>
        <div class="eb-spacer"></div>
        <div class="grp eb-transport">
          <button class="eb-play" data-play>▶ Play</button>
          <button class="eb-prove" data-prove>Run playtest</button>
        </div>
      </div>
      <div class="engine-body">
        <aside class="engine-hier">
          <div class="hier-h mono">Hierarchy</div>
          <div class="hier-row root"><span class="tw">▾</span>Level_03</div>
          <div class="hier-row l2"><span class="ic">▦</span>Floor</div>
          <div class="hier-row l2"><span class="ic">◫</span>Walls</div>
          <div class="hier-row l2"><span class="ic">◇</span>Props</div>
          <div class="hier-row l2"><span class="ic">⏣</span>NavMesh</div>
          <div class="hier-row l2 sel"><span class="ic">◉</span>Agent</div>
          <div class="hier-row l2"><span class="ic">✦</span>Goal</div>
          <div class="hier-row l2"><span class="ic">☀</span>Sun</div>
          <div class="hier-foot mono">8 entities · 1 selected</div>
        </aside>
        <div class="engine-view" data-stage>
          <canvas data-canvas></canvas>
          <span class="view-badge mono" data-badge>● scene</span>
          <span class="view-stats mono" data-stats>—</span>
          <span class="view-gizmo mono">x·y·z</span>
          <span class="view-toast mono" data-toast></span>
        </div>
        <aside class="engine-insp">
          <div class="insp-h mono">Inspector · Agent</div>
          <div class="insp-block">
            <div class="insp-k mono">Transform</div>
            <div class="insp-xform">
              <span>P</span><b class="mono" data-px>0.0</b><b class="mono" data-py>0.0</b><b class="mono" data-pz>0.0</b>
            </div>
            <div class="insp-xform"><span>R</span><b class="mono">0</b><b class="mono" data-ry>0</b><b class="mono">0</b></div>
          </div>
          <div class="insp-block">
            <div class="insp-k mono">Playtest proof</div>
            <div class="review-aspects insp-aspects" data-aspects></div>
          </div>
          <div class="insp-metric">
            <div class="metric-row"><span>scene health</span><b class="mono" data-metric>—</b></div>
            <div class="metric-track"><i data-metricbar></i></div>
            <div class="metric-foot mono">headless playtest · no GPU</div>
          </div>
        </aside>
      </div>
    `;

    const stage = root.querySelector('[data-stage]');
    const canvas = root.querySelector('[data-canvas]');
    const ctx = canvas.getContext('2d');
    const badge = root.querySelector('[data-badge]');
    const stats = root.querySelector('[data-stats]');
    const toast = root.querySelector('[data-toast]');
    const playBtn = root.querySelector('[data-play]');
    const proveBtn = root.querySelector('[data-prove]');
    const aspectsEl = root.querySelector('[data-aspects]');
    const metricEl = root.querySelector('[data-metric]');
    const metricBar = root.querySelector('[data-metricbar]');
    const pxEl = root.querySelector('[data-px]'), pyEl = root.querySelector('[data-py]'), pzEl = root.querySelector('[data-pz]'), ryEl = root.querySelector('[data-ry]');

    const COL = { edge: '255,182,39', hot: '255,240,207', node: '255,210,122', grid: '233,227,214', goal: '115,186,108' };
    function readPalette() {
      const cs = getComputedStyle(canvas);
      const g = (n, fb) => { const v = cs.getPropertyValue(n).trim(); return v || fb; };
      COL.edge = g('--wf-edge', COL.edge); COL.hot = g('--wf-hot', COL.hot);
      COL.node = g('--wf-node', COL.node); COL.grid = g('--wf-grid', COL.grid);
    }
    readPalette();
    window.addEventListener('vellum-palette', readPalette);

    // ---- level ----
    const blocks = [
      { c: [-1.6, 0.35, -1.2], s: [1.0, 0.7, 1.0] },
      { c: [-1.6, 0.85, -1.2], s: [0.5, 0.3, 0.5] },
      { c: [1.5, 0.5, -1.4], s: [1.2, 1.0, 0.6] },
      { c: [1.8, 0.3, 0.9], s: [0.7, 0.6, 0.7] },
      { c: [0.1, 0.25, 1.6], s: [1.4, 0.5, 0.5] },
      { c: [-1.9, 0.2, 1.4], s: [0.5, 0.4, 0.5] }
    ];
    const goal = [2.0, 0.0, 1.9];
    const path = [[-2.1, -1.9], [-0.4, -1.7], [-0.2, -0.1], [1.0, 0.4], [1.0, 1.5], [2.0, 1.9]];
    // cumulative lengths
    const seglen = [], pathPts = path.map(p => [p[0], p[1]]);
    let total = 0;
    for (let i = 0; i < pathPts.length - 1; i++) {
      const dx = pathPts[i + 1][0] - pathPts[i][0], dz = pathPts[i + 1][1] - pathPts[i][1];
      const l = Math.hypot(dx, dz); seglen.push(l); total += l;
    }
    function posAt(s) {
      s = ((s % total) + total) % total;
      for (let i = 0; i < seglen.length; i++) {
        if (s <= seglen[i]) { const f = s / seglen[i]; const a = pathPts[i], b = pathPts[i + 1]; return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, head: Math.atan2(b[0] - a[0], b[1] - a[1]) }; }
        s -= seglen[i];
      }
      const last = pathPts[pathPts.length - 1]; return { x: last[0], z: last[1], head: 0 };
    }

    let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2), cx = 0, cy = 0, R = 1;
    function size() {
      const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W * 0.5; cy = H * 0.62; R = Math.min(W, H) * 0.27;
    }
    size(); window.addEventListener('resize', size);
    if (window.ResizeObserver) new ResizeObserver(size).observe(stage);

    const DIST = 6.2, FOV = 4.2;
    function proj(p, yaw, pitch) {
      const r = window.V3.rot(p, yaw, pitch);
      const z = r[2] + DIST; const s = (FOV / (z <= 0.01 ? 0.01 : z)) * R;
      return { x: cx + r[0] * s, y: cy - r[1] * s, depth: r[2] };
    }
    function depthA(d) { return 0.4 + Math.max(0, Math.min(1, (d + 2.5) / 5)) * 0.6; }

    let playing = false, agentS = 0, t0 = performance.now(), last = t0, fps = 60;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      fps = fps * 0.92 + (1 / Math.max(dt, 0.001)) * 0.08;
      const t = (now - t0) / 1000;
      const yaw = 0.6 + Math.sin(t * 0.12) * 0.16;
      const pitch = -0.62;
      if (playing) agentS += dt * 1.5;
      ctx.clearRect(0, 0, W, H);

      // floor grid
      const n = 6, span = 2.6;
      ctx.lineWidth = 1;
      for (let i = -n; i <= n; i++) {
        const f = i / n * span;
        seg([f, 0, -span], [f, 0, span], yaw, pitch, COL.grid, 0.06);
        seg([-span, 0, f], [span, 0, f], yaw, pitch, COL.grid, 0.06);
      }

      // blocks
      for (const b of blocks) {
        const ge = window.V3.boxEdges(b.c[0], b.c[1], b.c[2], b.s[0], b.s[1], b.s[2]);
        drawEdges(ge.v, ge.e, yaw, pitch, COL.edge, 0.7);
      }

      // path (navmesh route)
      const P = pathPts.map(p => proj([p[0], 0.02, p[1]], yaw, pitch));
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = `rgba(${COL.hot},0.5)`; ctx.lineWidth = 1.2;
      ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
      ctx.setLineDash([]);
      P.forEach(p => { ctx.fillStyle = `rgba(${COL.hot},0.5)`; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 6.2832); ctx.fill(); });

      // goal marker (pulsing)
      const gp = proj([goal[0], 0.5 + Math.sin(t * 2) * 0.08, goal[2]], yaw, pitch);
      ctx.save();
      ctx.strokeStyle = `rgba(${COL.goal},0.95)`; ctx.fillStyle = `rgba(${COL.goal},0.9)`;
      ctx.shadowColor = `rgba(${COL.goal},0.8)`; ctx.shadowBlur = 12; ctx.lineWidth = 1.4;
      const gs = 8; ctx.beginPath(); ctx.moveTo(gp.x, gp.y - gs); ctx.lineTo(gp.x + gs, gp.y); ctx.lineTo(gp.x, gp.y + gs); ctx.lineTo(gp.x - gs, gp.y); ctx.closePath(); ctx.stroke();
      ctx.restore();

      // agent
      const a = posAt(agentS);
      const foot = proj([a.x, 0.02, a.z], yaw, pitch);
      const head = proj([a.x, 0.62, a.z], yaw, pitch);
      ctx.strokeStyle = `rgba(${COL.grid},0.25)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(foot.x, foot.y, 10, 4, 0, 0, 6.2832); ctx.stroke(); // shadow ring
      ctx.strokeStyle = `rgba(${COL.hot},0.9)`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(foot.x, foot.y); ctx.lineTo(head.x, head.y); ctx.stroke();
      ctx.fillStyle = `rgba(${COL.hot},1)`; ctx.shadowColor = `rgba(${COL.hot},0.9)`; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(head.x, head.y, 4.5, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;

      // HUD
      stats.textContent = `${Math.min(120, Math.round(fps))} fps · 6 draws · 312 tris`;
      pxEl.textContent = a.x.toFixed(1); pyEl.textContent = '0.0'; pzEl.textContent = a.z.toFixed(1);
      ryEl.textContent = Math.round((a.head * 180 / Math.PI + 360) % 360);

      requestAnimationFrame(frame);
    }
    function seg(p, q, yaw, pitch, col, al) {
      const a = proj(p, yaw, pitch), b = proj(q, yaw, pitch);
      ctx.strokeStyle = `rgba(${col},${al})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    function drawEdges(verts, edges, yaw, pitch, col, baseA) {
      const Pp = verts.map(v => proj(v, yaw, pitch));
      for (const [i, j] of edges) {
        const a = Pp[i], b = Pp[j];
        ctx.strokeStyle = `rgba(${col},${baseA * depthA((a.depth + b.depth) / 2)})`;
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    // ---- play + playtest ----
    function setPlaying(p) {
      playing = p;
      playBtn.classList.toggle('on', p);
      playBtn.innerHTML = p ? '⏸ Pause' : '▶ Play';
      badge.innerHTML = p ? '● play' : '● scene';
      badge.classList.toggle('live', p);
      if (p) runPlaytest();
    }
    playBtn.addEventListener('click', () => setPlaying(!playing));
    root.querySelectorAll('.eb-tab').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('.eb-tab').forEach(x => x.classList.remove('on')); b.classList.add('on');
      setPlaying(b.dataset.mode === 'game');
    }));

    const CHECKS = [['navmesh connected', '1 island'], ['collision-free', 'swept'], ['reaches goal', '4.2 s'], ['frame budget', '≤ 16 ms'], ['no orphan refs', 'clean']];
    let runToken = 0;
    function runPlaytest() {
      const token = ++runToken;
      toast.classList.remove('show');
      aspectsEl.innerHTML = ''; metricEl.textContent = '—'; metricBar.style.width = '0%'; metricBar.style.background = 'var(--violet)';
      const rows = CHECKS.map(([k, w]) => {
        const r = document.createElement('div'); r.className = 'aspect pending';
        r.innerHTML = `<span class="aspect-k">${k}</span><span class="aspect-w mono">${w}</span><span class="aspect-mark"><i class="proof-spin"></i></span>`;
        aspectsEl.appendChild(r); return r;
      });
      let i = 0;
      const step = () => {
        if (token !== runToken) return;
        if (i < rows.length) {
          const mk = rows[i].querySelector('.aspect-mark'); mk.className = 'aspect-mark pass'; mk.textContent = '✓';
          rows[i].classList.remove('pending'); i++; setTimeout(step, 460);
        } else {
          let v = 0; const target = 0.94;
          const tick = () => { if (token !== runToken) return; v += (target - v) * 0.12; if (Math.abs(target - v) < 0.005) v = target; metricEl.textContent = v.toFixed(2); metricBar.style.width = (v * 100) + '%'; metricBar.style.background = 'var(--green)'; if (v < target) requestAnimationFrame(tick); };
          tick();
          toast.textContent = '✓ playtest passed · goal reached'; toast.classList.add('show');
        }
      };
      setTimeout(step, 480);
    }
    proveBtn.addEventListener('click', runPlaytest);

    frame(performance.now());
    runPlaytest();
  }

  window.mountScene = mountScene;
})();
