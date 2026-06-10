/* ============================================================
   SWARM — parallel-agent orchestration diagram.
   goal → task DAG → worktree-per-task → best-of-N → judge → merge
   Phased timeline, loops. Streams an event log.
   mountSwarm(rootEl)
   ============================================================ */
(function () {
  const TASKS = [
    { id: 'T1', name: 'parser: add splat intake', model: 'anthropic', n: 3 },
    { id: 'T2', name: 'spatial: AABB collision',  model: 'qwen·local', n: 3 },
    { id: 'T3', name: 'shader: write & validate',  model: 'openai', n: 3 },
    { id: 'T4', name: 'tests: regression suite',   model: 'deepseek', n: 2 },
  ];

  const EVENTS = [
    ['orchestration.decision', 'parallel · earned (fan-out 4)', 'violet'],
    ['orchestration.search', 'best-of-N · population 11', 'teal'],
    ['verifier.verdict', 'T1 · compiles ✓ tests ✓ lint ✓', 'green'],
    ['review.spatial', 'T3 · shader compiles · metric 0.94', 'brass'],
    ['verifier.verdict', 'T2 · candidate b selected (surprisal)', 'teal'],
    ['budget.audit', 'tokens 41.2k / 60k · within branch cap', 'muted'],
    ['merge.apply', '4 worktrees → main · 0 conflicts', 'violet'],
  ];

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function mountSwarm(root) {
    root.classList.add('swarm');
    root.innerHTML = `
      <div class="swarm-stage">
        <div class="swarm-col swarm-goal-col">
          <div class="swarm-label">goal</div>
          <div class="swarm-node goal" data-goal>
            <span class="mono">build the splat viewer</span>
          </div>
        </div>
        <div class="swarm-col swarm-tasks-col">
          <div class="swarm-label">worktree per task · best-of-N</div>
          <div class="swarm-lanes" data-lanes></div>
        </div>
        <div class="swarm-col swarm-merge-col">
          <div class="swarm-label">merge</div>
          <div class="swarm-node main" data-main>
            <span class="mono">main</span>
            <span class="swarm-commits"><b data-commits>128</b> commits</span>
          </div>
        </div>
      </div>
      <svg class="swarm-wires" data-wires preserveAspectRatio="none"></svg>
      <div class="swarm-log">
        <div class="swarm-log-head"><span class="dot-live"></span> event log<span class="mono swarm-phase" data-phase>idle</span></div>
        <div class="swarm-log-body" data-log></div>
      </div>
    `;

    const lanesEl = root.querySelector('[data-lanes]');
    const wires = root.querySelector('[data-wires]');
    const logEl = root.querySelector('[data-log]');
    const phaseEl = root.querySelector('[data-phase]');
    const commitsEl = root.querySelector('[data-commits]');
    let commits = 128;

    // build lanes
    const laneEls = TASKS.map((tk, i) => {
      const lane = el('div', 'swarm-lane');
      lane.dataset.lane = i;
      const cands = Array.from({ length: tk.n }, (_, k) =>
        `<div class="cand" data-cand="${k}"><div class="cand-bar"><i></i></div></div>`).join('');
      lane.innerHTML = `
        <div class="lane-head">
          <span class="lane-id mono">${tk.id}</span>
          <span class="lane-name">${tk.name}</span>
          <span class="lane-model mono">${tk.model}</span>
        </div>
        <div class="lane-cands">${cands}</div>
      `;
      lanesEl.appendChild(lane);
      return lane;
    });

    function drawWires() {
      const rb = root.getBoundingClientRect();
      wires.setAttribute('viewBox', `0 0 ${rb.width} ${rb.height}`);
      const goal = root.querySelector('[data-goal]').getBoundingClientRect();
      const main = root.querySelector('[data-main]').getBoundingClientRect();
      let p = '';
      laneEls.forEach((lane) => {
        const lb = lane.getBoundingClientRect();
        const x1 = goal.right - rb.left, y1 = goal.top + goal.height / 2 - rb.top;
        const x2 = lb.left - rb.left, y2 = lb.top + lb.height / 2 - rb.top;
        const mid = (x1 + x2) / 2;
        p += `<path d="M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}" class="wire wire-in"/>`;
        const x3 = lb.right - rb.left, x4 = main.left - rb.left, y4 = main.top + main.height / 2 - rb.top;
        const mid2 = (x3 + x4) / 2;
        p += `<path d="M${x3},${y2} C${mid2},${y2} ${mid2},${y4} ${x4},${y4}" class="wire wire-out"/>`;
      });
      wires.innerHTML = p;
    }

    function logLine(name, msg, tone) {
      const line = el('div', 'log-line');
      line.innerHTML = `<span class="log-name mono tone-${tone}">${name}</span><span class="log-msg">${msg}</span>`;
      logEl.appendChild(line);
      requestAnimationFrame(() => line.classList.add('in'));
      while (logEl.children.length > 7) logEl.removeChild(logEl.firstChild);
      logEl.scrollTop = logEl.scrollHeight;
    }

    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    let alive = true;

    async function run() {
      while (alive) {
        reset();
        // 1. decompose
        phaseEl.textContent = 'decompose';
        root.querySelector('[data-goal]').classList.add('active');
        wires.classList.add('show-in');
        logLine(...EVENTS[0]);
        await wait(900);

        // 2. spawn
        phaseEl.textContent = 'spawn · worktrees';
        laneEls.forEach((l, i) => setTimeout(() => l.classList.add('spawned'), i * 130));
        await wait(900);
        logLine(...EVENTS[1]);

        // 3. run best-of-N
        phaseEl.textContent = 'run · best-of-N';
        laneEls.forEach(l => l.classList.add('running'));
        await wait(1500);

        // 4. judge — pick winners
        phaseEl.textContent = 'judge · verify';
        laneEls.forEach((l, i) => {
          const cands = l.querySelectorAll('.cand');
          const win = Math.floor(Math.random() * cands.length);
          cands.forEach((c, k) => c.classList.add(k === win ? 'win' : 'lose'));
          l.classList.add('judged');
        });
        logLine(...EVENTS[2]); await wait(500);
        logLine(...EVENTS[3]); await wait(500);
        logLine(...EVENTS[4]); await wait(400);
        logLine(...EVENTS[5]); await wait(500);

        // 5. merge
        phaseEl.textContent = 'merge';
        wires.classList.add('show-out');
        laneEls.forEach(l => l.classList.add('merging'));
        root.querySelector('[data-main]').classList.add('active');
        logLine(...EVENTS[6]);
        // tick commits
        for (let k = 0; k < 4; k++) { commits++; commitsEl.textContent = commits; await wait(180); }
        await wait(1400);
      }
    }

    function reset() {
      root.querySelector('[data-goal]').classList.remove('active');
      root.querySelector('[data-main]').classList.remove('active');
      wires.classList.remove('show-in', 'show-out');
      laneEls.forEach(l => {
        l.classList.remove('spawned', 'running', 'judged', 'merging');
        l.querySelectorAll('.cand').forEach(c => c.classList.remove('win', 'lose'));
      });
    }

    // observe to start only when visible — with a fallback so it never stays idle
    let started = false;
    function begin() { if (started) return; started = true; drawWires(); run(); }
    const io = new IntersectionObserver((ents) => {
      ents.forEach(e => { if (e.isIntersecting) begin(); });
    }, { threshold: 0.15 });
    io.observe(root);
    setTimeout(begin, 1600); // fallback if IO never fires (e.g. headless/background)

    window.addEventListener('resize', () => { if (started) drawWires(); });
    setTimeout(() => { if (started) drawWires(); }, 400);
  }

  window.mountSwarm = mountSwarm;
})();
