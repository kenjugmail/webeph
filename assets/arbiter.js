/* Arbiter route story.
   Native scroll controls a truthful route → evidence → review sequence. */
(function () {
  'use strict';

  const STORY = [
    { phase: 'Scope', caption: 'Workspace · route · review boundary' },
    { phase: 'Route', caption: 'Subscriber access · beta availability' },
    { phase: 'Evidence', caption: 'Summary · usage · proof · boundary' },
    { phase: 'Review', caption: 'Keep · revise · discard' }
  ];

  function clamp(value) { return Math.max(0, Math.min(1, value)); }

  function mountArbiterStory(root) {
    if (!root) return;

    const stage = root.querySelector('.arbiter-story-stage');
    const steps = Array.from(root.querySelectorAll('[data-arbiter-step]'));
    const frames = Array.from(root.querySelectorAll('[data-arbiter-frame]'));
    const indexLabel = root.querySelector('[data-arbiter-index]');
    const phaseLabel = root.querySelector('[data-arbiter-phase]');
    const caption = root.querySelector('[data-arbiter-caption]');
    let activeStep = -1;

    function storyAnchor() {
      if (window.innerWidth > 900) return window.innerHeight * .51;
      const stageBottom = stage?.getBoundingClientRect().bottom || window.innerHeight * .48;
      return Math.min(window.innerHeight * .82, stageBottom + 142);
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
      const selectedRect = steps[selected]?.getBoundingClientRect();
      const local = selectedRect ? clamp((anchor - selectedRect.top) / Math.max(1, selectedRect.height)) : .5;
      return { raw, selected, local };
    }

    function showStep(index, reduced) {
      if (index !== activeStep) {
        activeStep = index;
        root.dataset.arbiterCurrent = String(index);
        steps.forEach((step, stepIndex) => {
          if (stepIndex === index) step.setAttribute('data-active', 'true');
          else step.removeAttribute('data-active');
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
      root.style.setProperty('--arbiter-progress', clamp(position.raw / Math.max(1, steps.length - 1)).toFixed(4));
      root.style.setProperty('--arbiter-local', position.local.toFixed(4));
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

  mountArbiterStory(document.querySelector('.arbiter-story'));
})();
