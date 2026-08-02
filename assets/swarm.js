/* Orrery supervised-run story.
   A native-scroll lifecycle diagram: goal → worktrees → verification → decision. */
(function () {
  'use strict';

  const STEPS = [
    {
      phase: 'Scope',
      caption: 'Workspace · route · approval boundary',
      title: 'Name the goal and its boundary.',
      copy: 'Nexus makes the workspace, requested route, permissions, and approval boundary visible before work starts.',
      evidence: 'Goal received · boundary explicit'
    },
    {
      phase: 'Worktrees',
      caption: 'Three attempts · isolated changes',
      title: 'Separate the attempts.',
      copy: 'Bounded work can run in isolated worktrees so proposals remain independent, reviewable, and reversible.',
      evidence: 'W1 inspect · W2 propose · W3 check'
    },
    {
      phase: 'Verification',
      caption: 'Tests · diagnostics · review',
      title: 'Request evidence before selection.',
      copy: 'Configured checks produce evidence for the result. The receipt records what was requested without pretending that every check passed.',
      evidence: 'Evidence requested · outcome not assumed'
    },
    {
      phase: 'Decision',
      caption: 'Keep · revise · discard',
      title: 'Keep the final decision human.',
      copy: 'A selected candidate arrives with its available evidence and boundary record. You decide what happens to it.',
      evidence: 'Candidate selected · acceptance remains yours'
    }
  ];

  function clamp(value) { return Math.max(0, Math.min(1, value)); }

  function mountSwarm(root) {
    if (!root) return;

    root.classList.add('orrery-story');
    root.setAttribute('data-scene', 'orrery-lifecycle');
    root.innerHTML = `
      <div class="orrery-story-stage">
        <div class="orrery-story-head">
          <span>Supervised run 001</span>
          <span><b data-orrery-index>01 / 04</b><i data-orrery-phase>Scope</i></span>
        </div>

        <div class="orrery-story-viewport">
          <article class="orrery-story-frame orrery-scope-frame" data-orrery-frame="0" data-active="true">
            <div class="orrery-boundary-sheet">
              <span class="orrery-frame-kicker">01 / goal</span>
              <strong>Fix the failing form tests</strong>
              <small>The request is bounded before execution.</small>
              <dl>
                <div><dt>Workspace</dt><dd>named</dd></div>
                <div><dt>Route</dt><dd>selected</dd></div>
                <div><dt>Permissions</dt><dd>reviewed</dd></div>
              </dl>
            </div>
            <span class="orrery-boundary-corner" aria-hidden="true"></span>
          </article>

          <article class="orrery-story-frame orrery-worktree-frame" data-orrery-frame="1" aria-hidden="true">
            <canvas class="story-branch-field" data-branch-field="orrery" aria-hidden="true"></canvas>
            <div class="orrery-worktree-origin">
              <span>Goal</span><strong>Scoped task</strong>
            </div>
            <div class="orrery-worktree-branches">
              <article><span>W1</span><strong>Inspect</strong><small>read project context</small></article>
              <article><span>W2</span><strong>Propose</strong><small>prepare a bounded patch</small></article>
              <article><span>W3</span><strong>Check</strong><small>run configured checks</small></article>
            </div>
          </article>

          <article class="orrery-story-frame orrery-verify-frame" data-orrery-frame="2" aria-hidden="true">
            <div class="orrery-verify-title">
              <span class="orrery-frame-kicker">03 / verification</span>
              <strong>Evidence requested</strong>
              <small>Requirements describe the run contract—not a fabricated pass.</small>
            </div>
            <ul>
              <li><span>tests</span><i aria-hidden="true"></i><b>required</b></li>
              <li><span>diagnostics</span><i aria-hidden="true"></i><b>required</b></li>
              <li><span>review</span><i aria-hidden="true"></i><b>required</b></li>
            </ul>
          </article>

          <article class="orrery-story-frame orrery-decision-frame" data-orrery-frame="3" aria-hidden="true">
            <div class="orrery-candidates" aria-hidden="true">
              <span>candidate 01 · compared</span>
              <span>candidate 02 · compared</span>
              <span>candidate 03 · compared</span>
            </div>
            <div class="orrery-selected-result">
              <span class="orrery-frame-kicker">04 / selected candidate</span>
              <strong>Selected merge</strong>
              <small>Presented with available evidence and boundary receipt.</small>
            </div>
            <div class="orrery-human-gate"><span>You decide</span><strong>Keep · revise · discard</strong></div>
          </article>
        </div>

        <div class="orrery-story-foot">
          <span>System diagram · no simulated output</span>
          <span data-orrery-caption>Workspace · route · approval boundary</span>
        </div>
      </div>

      <ol class="orrery-story-steps" aria-label="Orrery supervised run lifecycle">
        ${STEPS.map((step, index) => `
          <li data-orrery-step="${index}"${index === 0 ? ' data-active="true"' : ''}>
            <span class="orrery-story-number">0${index + 1}</span>
            <div>
              <h3>${step.title}</h3>
              <p>${step.copy}</p>
              <span class="orrery-story-evidence">${step.evidence}</span>
            </div>
          </li>
        `).join('')}
      </ol>
    `;

    const stage = root.querySelector('.orrery-story-stage');
    const steps = Array.from(root.querySelectorAll('[data-orrery-step]'));
    const frames = Array.from(root.querySelectorAll('[data-orrery-frame]'));
    const indexLabel = root.querySelector('[data-orrery-index]');
    const phaseLabel = root.querySelector('[data-orrery-phase]');
    const caption = root.querySelector('[data-orrery-caption]');
    const branchCanvas = root.querySelector('[data-branch-field="orrery"]');
    let activeStep = -1;

    function storyAnchor() {
      if (window.innerWidth > 900) return window.innerHeight * .51;
      const stageBottom = stage?.getBoundingClientRect().bottom || window.innerHeight * .48;
      return Math.min(window.innerHeight * .82, stageBottom + 138);
    }

    function storyPosition() {
      const anchor = storyAnchor();
      const centers = steps.map((step) => {
        const rect = step.getBoundingClientRect();
        return rect.top + rect.height * .5;
      });
      let raw = 0;
      if (centers.length > 1 && anchor >= centers[centers.length - 1]) {
        raw = centers.length - 1;
      } else {
        for (let index = 0; index < centers.length - 1; index += 1) {
          if (anchor < centers[index] || anchor > centers[index + 1]) continue;
          raw = index + clamp((anchor - centers[index]) / Math.max(1, centers[index + 1] - centers[index]));
          break;
        }
      }
      const selected = Math.min(steps.length - 1, Math.round(raw));
      const rect = steps[selected]?.getBoundingClientRect();
      const local = rect ? clamp((anchor - rect.top) / Math.max(1, rect.height)) : .5;
      return { raw, selected, local };
    }

    function showStep(index, reduced) {
      if (index !== activeStep) {
        activeStep = index;
        root.dataset.orreryCurrent = String(index);
        steps.forEach((step, stepIndex) => {
          if (stepIndex === index) step.setAttribute('data-active', 'true');
          else step.removeAttribute('data-active');
        });
        frames.forEach((frame, frameIndex) => {
          if (frameIndex === index) frame.setAttribute('data-active', 'true');
          else frame.removeAttribute('data-active');
        });
        const step = STEPS[index] || STEPS[0];
        if (indexLabel) indexLabel.textContent = `${String(index + 1).padStart(2, '0')} / 04`;
        if (phaseLabel) phaseLabel.textContent = step.phase;
        if (caption) caption.textContent = step.caption;
      }

      frames.forEach((frame, frameIndex) => {
        if (reduced || frameIndex === index) frame.removeAttribute('aria-hidden');
        else frame.setAttribute('aria-hidden', 'true');
      });
    }

    function update() {
      const position = storyPosition();
      const reduced = window.EphemerentMotion?.reduced() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      showStep(position.selected, reduced);
      root.style.setProperty('--orrery-progress', clamp(position.raw / Math.max(1, steps.length - 1)).toFixed(4));
      root.style.setProperty('--orrery-local', position.local.toFixed(4));
    }

    window.mountBranchField?.(branchCanvas);
    showStep(0, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    update();
    if (window.EphemerentMotion) {
      window.EphemerentMotion.register(root, update);
    } else {
      root.dataset.motion = 'static';
      showStep(STEPS.length - 1, true);
    }
  }

  window.mountSwarm = mountSwarm;
})();
