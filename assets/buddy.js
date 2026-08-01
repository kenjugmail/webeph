/* ============================================================
   BUDDY — a separate-personality avatar that watches the coding
   agent and reacts. States: idle / thinking / concerned / happy / talking.
   mountBuddy(rootEl, { auto: true })
   ============================================================ */
(function () {
  const SCRIPT = [
    { state: 'thinking',  say: 'Reading the repo map… three files touch this.', wait: 2600 },
    { state: 'talking',   say: 'Fanning out four worktrees. Parallelism looks earned here.', wait: 3000 },
    { state: 'concerned', say: 'Heads up — the collision test just went red.', wait: 2800 },
    { state: 'thinking',  say: 'Reflexion loop: candidate b fixed the AABB edge case.', wait: 2800 },
    { state: 'happy',     say: 'Green across the panel. Shader scored 0.94. Shipping it.', wait: 3200 },
    { state: 'idle',      say: 'Standing by. Talk to me whenever.', wait: 2400 },
  ];

  function mountBuddy(root, opts) {
    opts = opts || {};
    root.classList.add('buddy');
    root.innerHTML = `
      <div class="buddy-viz">
        <div class="buddy-halo"></div>
        <div class="buddy-orb" data-orb>
          <div class="buddy-scan"></div>
          <div class="buddy-face">
            <div class="eye eye-l"></div>
            <div class="eye eye-r"></div>
            <div class="mouth"></div>
          </div>
          <div class="buddy-moon"></div>
        </div>
        <div class="buddy-wave" data-wave>
          ${Array.from({ length: 22 }, () => '<i></i>').join('')}
        </div>
      </div>
      <div class="buddy-side">
        <div class="buddy-name">
          <span class="mono buddy-tag">buddy.say</span>
          <span class="buddy-state-pill" data-pill>idle</span>
        </div>
        <div class="buddy-bubble" data-bubble>…</div>
        <div class="buddy-controls" data-controls>
          <button data-set="thinking">thinking</button>
          <button data-set="concerned">red tests</button>
          <button data-set="happy">green tests</button>
          <button data-set="talking">talking</button>
        </div>
        <div class="buddy-meta mono">separate model · out-of-band · kept separate from coding context</div>
      </div>
    `;

    const orb = root.querySelector('[data-orb]');
    const bubble = root.querySelector('[data-bubble]');
    const pill = root.querySelector('[data-pill]');
    const states = ['idle', 'thinking', 'concerned', 'happy', 'talking'];
    let typing = null, autoTimer = null, autoIdx = 0, autoOn = !!opts.auto;

    const eyeL = root.querySelector('.eye-l');
    const eyeR = root.querySelector('.eye-r');
    const mouth = root.querySelector('.mouth');
    function setState(s) {
      states.forEach(x => orb.classList.remove('s-' + x));
      orb.classList.add('s-' + s);
      pill.textContent = s === 'talking' ? 'talking' : s;
      pill.className = 'buddy-state-pill tone-' + s;
      // drive eyes/mouth with DIRECT classes (descendant selectors proved unreliable here)
      eyeL.className = 'eye eye-l mood-' + s;
      eyeR.className = 'eye eye-r mood-' + s;
      mouth.className = 'mouth mood-' + s;
    }

    function say(text) {
      if (typing) clearInterval(typing);
      bubble.textContent = '';
      bubble.classList.add('typing');
      let i = 0;
      typing = setInterval(() => {
        bubble.textContent = text.slice(0, ++i);
        if (i >= text.length) { clearInterval(typing); typing = null; bubble.classList.remove('typing'); }
      }, 22);
    }

    function manual(s) {
      autoOn = false;
      if (autoTimer) clearTimeout(autoTimer);
      const map = {
        thinking:  'Hmm. Let me trace where this symbol is used…',
        concerned: 'That regression is on me — rolling back candidate a.',
        happy:     'Clean run. Tests, typecheck, lint, review — all green.',
        talking:   'I narrate what the coding agent is doing, in my own voice.'
      };
      setState(s);
      say(map[s] || '…');
    }

    root.querySelectorAll('[data-set]').forEach(b =>
      b.addEventListener('click', () => manual(b.dataset.set)));

    function loop() {
      const step = SCRIPT[autoIdx % SCRIPT.length];
      setState(step.state);
      say(step.say);
      autoIdx++;
      autoTimer = setTimeout(loop, step.wait);
    }

    // start auto when visible — with a fallback so it animates even headless
    const io = new IntersectionObserver((ents) => {
      ents.forEach(e => {
        if (e.isIntersecting && autoOn && !autoTimer) loop();
      });
    }, { threshold: 0.3 });
    io.observe(root);
    setTimeout(() => { if (autoOn && !autoTimer) loop(); }, 1800);

    setState('idle');
    if (opts.startSay !== false) bubble.textContent = SCRIPT[SCRIPT.length - 1].say;
  }

  window.mountBuddy = mountBuddy;
})();
