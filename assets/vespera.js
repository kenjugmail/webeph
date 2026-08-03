/* Vespera pipeline story — scroll blend + beat rail, no canvas-over-type. */
(function () {
  'use strict';

  const STORY = [
    { phase: 'Brief', caption: 'Direction named · constraints visible' },
    { phase: 'Beat', caption: 'Script rhythm · purpose per beat' },
    { phase: 'Scene', caption: 'Program monitor · locked framing' },
    { phase: 'Master', caption: 'Browser encode · evidence attached' }
  ];

  function clamp(value) { return Math.max(0, Math.min(1, value)); }

  function mountVesperaStory(root) {
    if (!root) return;

    const stage = root.querySelector('.vespera-story-stage');
    const steps = Array.from(root.querySelectorAll('[data-vespera-step]'));
    const frames = Array.from(root.querySelectorAll('[data-vespera-frame]'));
    const beatCells = Array.from(root.querySelectorAll('[data-vespera-beat]'));
    const indexLabel = root.querySelector('[data-vespera-index]');
    const phaseLabel = root.querySelector('[data-vespera-phase]');
    const caption = root.querySelector('[data-vespera-caption]');
    let activeStep = -1;
    let lastFramePosition = -1;

    function storyAnchor() {
      if (window.innerWidth > 900) return window.innerHeight * 0.51;
      const stageBottom = stage?.getBoundingClientRect().bottom || window.innerHeight * 0.48;
      return Math.min(window.innerHeight * 0.82, stageBottom + 145);
    }

    function storyPosition() {
      const anchor = storyAnchor();
      const centers = steps.map((step) => {
        const rect = step.getBoundingClientRect();
        return rect.top + rect.height * 0.5;
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
      const selectedRect = steps[selected]?.getBoundingClientRect();
      const local = selectedRect ? clamp((anchor - selectedRect.top) / Math.max(1, selectedRect.height)) : 0.5;
      return { raw, selected, local };
    }

    function updateFrameBlend(raw, reduced) {
      const stacked = window.innerWidth <= 900;
      if (reduced || stacked) {
        frames.forEach((frame) => {
          frame.style.removeProperty('opacity');
          frame.style.removeProperty('transform');
          frame.style.removeProperty('z-index');
        });
        lastFramePosition = raw;
        return;
      }
      if (Math.abs(raw - lastFramePosition) < 0.0005) return;
      lastFramePosition = raw;
      frames.forEach((frame, index) => {
        const distance = Math.min(1, Math.abs(raw - index));
        const opacity = clamp(1 - distance);
        const shift = (index - raw) * 10;
        frame.style.opacity = opacity.toFixed(3);
        frame.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
        frame.style.zIndex = opacity > 0 ? String(Math.round(opacity * 10) + 1) : '0';
      });
    }

    function updateBeatRail(step, local, reduced) {
      if (!beatCells.length) return;
      const activeBeat = reduced || step !== 1
        ? (step === 1 ? 0 : -1)
        : Math.min(beatCells.length - 1, Math.floor(clamp(local) * beatCells.length));
      beatCells.forEach((cell, index) => {
        if (index === activeBeat) cell.setAttribute('data-on', 'true');
        else cell.removeAttribute('data-on');
      });
    }

    function showStep(index, reduced) {
      if (index !== activeStep) {
        activeStep = index;
        root.dataset.vesperaCurrent = String(index);
        steps.forEach((stepEl, stepIndex) => {
          if (stepIndex === index) stepEl.setAttribute('data-active', 'true');
          else stepEl.removeAttribute('data-active');
        });
        frames.forEach((frame, frameIndex) => {
          if (frameIndex === index) frame.setAttribute('data-active', 'true');
          else frame.removeAttribute('data-active');
        });
        const chapter = STORY[index] || STORY[0];
        if (indexLabel) indexLabel.textContent = `${String(index + 1).padStart(2, '0')} / 04`;
        if (phaseLabel) phaseLabel.textContent = chapter.phase;
        if (caption) caption.textContent = chapter.caption;
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
      updateFrameBlend(position.raw, reduced);
      updateBeatRail(position.selected, position.local, reduced);
      const total = clamp(position.raw / Math.max(1, steps.length - 1));
      root.style.setProperty('--vespera-progress', total.toFixed(4));
      root.style.setProperty('--vespera-local', position.local.toFixed(4));
      root.style.setProperty('--story-progress', total.toFixed(4));
    }

    showStep(0, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    update();

    if (window.EphemerentMotion) {
      window.EphemerentMotion.register(root, update);
    } else {
      root.dataset.motion = 'static';
      frames.forEach((frame) => frame.removeAttribute('aria-hidden'));
    }
  }

  function boot() {
    mountVesperaStory(document.querySelector('.vespera-story'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
