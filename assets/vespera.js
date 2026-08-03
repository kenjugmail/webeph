/* Vespera dusk reel — product-owned scroll animation.
   Aperture → score → framed scene → sealed master.
   Drawn in a side stage so type stays clear. */
(function () {
  'use strict';

  const STORY = [
    { phase: 'Brief', caption: 'Direction named · constraints visible' },
    { phase: 'Beat', caption: 'Script rhythm · purpose per beat' },
    { phase: 'Scene', caption: 'Program monitor · locked framing' },
    { phase: 'Master', caption: 'Browser encode · evidence attached' }
  ];
  const SIGNAL = '201, 164, 106';
  const INK = '242, 235, 225';
  const CYCLE = 8400;

  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function ease(value) {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  }

  function mountVesperaStory(root) {
    if (!root) return;

    const stage = root.querySelector('.vespera-story-stage');
    const viewport = root.querySelector('.vespera-story-viewport');
    const steps = Array.from(root.querySelectorAll('[data-vespera-step]'));
    const frames = Array.from(root.querySelectorAll('[data-vespera-frame]'));
    const beatCells = Array.from(root.querySelectorAll('[data-vespera-beat]'));
    const indexLabel = root.querySelector('[data-vespera-index]');
    const phaseLabel = root.querySelector('[data-vespera-phase]');
    const caption = root.querySelector('[data-vespera-caption]');
    const canvas = root.querySelector('.vespera-reel');
    const context = canvas ? canvas.getContext('2d') : null;

    let activeStep = -1;
    let lastFramePosition = -1;
    let lastDrawPosition = -1;
    let width = 1;
    let height = 1;
    let dpr = 1;

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

    function resize() {
      if (!canvas || !context) return;
      const rect = canvas.getBoundingClientRect();
      const nextW = Math.max(1, rect.width);
      const nextH = Math.max(1, rect.height);
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (nextW === width && nextH === height && nextDpr === dpr && canvas.width) return;
      width = nextW;
      height = nextH;
      dpr = nextDpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastDrawPosition = -1;
      if (width > 2 && height > 2) {
        const reduced = window.EphemerentMotion?.reduced() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        draw(performance.now(), 0.55, reduced);
      }
    }

    function reelBox() {
      const stacked = window.innerWidth <= 900;
      if (stacked) {
        return {
          x: width * 0.06,
          y: height * 0.08,
          w: width * 0.88,
          h: height * 0.84
        };
      }
      /* Canvas is already clipped to the right stage in CSS. */
      return {
        x: width * 0.08,
        y: height * 0.12,
        w: width * 0.84,
        h: height * 0.76
      };
    }

    function clearFrameMotionStyles() {
      frames.forEach((frame) => {
        frame.style.removeProperty('opacity');
        frame.style.removeProperty('transform');
        frame.style.removeProperty('z-index');
        frame.style.removeProperty('visibility');
        frame.style.removeProperty('pointer-events');
      });
    }

    function updateFrameBlend(raw, reduced) {
      const stacked = window.innerWidth <= 900;
      /* Hard-cut only — crossfading stacked sheets caused ghosted copy. */
      if (reduced || stacked || Math.abs(raw - lastFramePosition) < 0.0005) {
        if (reduced || stacked) clearFrameMotionStyles();
        lastFramePosition = raw;
        return;
      }
      lastFramePosition = raw;
      clearFrameMotionStyles();
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

    function drawAperture(progress, alpha) {
      const box = reelBox();
      const cx = box.x + box.w * 0.5;
      const cy = box.y + box.h * 0.46;
      const open = ease(clamp((progress - 0.05) / 0.75));
      const maxR = Math.min(box.w, box.h) * 0.38;

      context.save();
      context.beginPath();
      context.rect(box.x, box.y, box.w, box.h);
      context.clip();

      for (let ring = 0; ring < 4; ring += 1) {
        const r = maxR * (0.28 + ring * 0.22) * (0.55 + open * 0.45);
        context.beginPath();
        context.arc(cx, cy, r, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${SIGNAL}, ${alpha * (0.22 + open * 0.28 - ring * 0.04)})`;
        context.lineWidth = 1.2;
        context.stroke();
      }

      const blades = 6;
      for (let i = 0; i < blades; i += 1) {
        const angle = (Math.PI * 2 * i) / blades - Math.PI / 2 + open * 0.35;
        const inner = maxR * 0.12;
        const outer = maxR * (0.55 + open * 0.35);
        context.beginPath();
        context.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        context.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.55})`;
        context.lineWidth = 1.35;
        context.stroke();
      }

      const horizonY = box.y + box.h * (0.62 - open * 0.04);
      context.beginPath();
      context.moveTo(box.x + box.w * 0.12, horizonY);
      context.lineTo(box.x + box.w * (0.12 + 0.76 * open), horizonY);
      context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.7})`;
      context.lineWidth = 1.5;
      context.stroke();

      context.beginPath();
      context.arc(cx, cy, 3.2, 0, Math.PI * 2);
      context.fillStyle = `rgba(${SIGNAL}, ${alpha})`;
      context.fill();
      context.restore();
    }

    function drawScore(progress, alpha, now, staticState) {
      const box = reelBox();
      const reveal = ease(clamp(progress));
      const y = box.y + box.h * 0.55;
      const left = box.x + box.w * 0.1;
      const right = box.x + box.w * 0.9;
      const span = right - left;

      context.save();
      context.beginPath();
      context.rect(box.x, box.y, box.w, box.h);
      context.clip();

      context.strokeStyle = `rgba(${INK}, ${alpha * 0.12})`;
      context.lineWidth = 1;
      context.strokeRect(box.x + 10, box.y + 10, box.w - 20, box.h - 20);

      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(left + span * reveal, y);
      context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.75})`;
      context.lineWidth = 1.6;
      context.stroke();

      const marks = 4;
      for (let index = 0; index < marks; index += 1) {
        const t = index / (marks - 1);
        if (t > reveal) break;
        const x = left + span * t;
        const tall = index % 2 === 0 ? 16 : 10;
        context.beginPath();
        context.moveTo(x, y - tall);
        context.lineTo(x, y + tall);
        context.strokeStyle = `rgba(${SIGNAL}, ${alpha * (0.4 + t * 0.45)})`;
        context.lineWidth = 1.4;
        context.stroke();
      }

      const head = staticState ? 0.58 : ((now % CYCLE) / CYCLE);
      const headX = left + span * (reveal * (0.15 + head * 0.7));
      if (reveal > 0.08) {
        context.beginPath();
        context.moveTo(headX, y - 22);
        context.lineTo(headX, y + 22);
        context.strokeStyle = `rgba(${INK}, ${alpha * 0.85})`;
        context.lineWidth = 1.2;
        context.stroke();
        context.beginPath();
        context.arc(headX, y, 4, 0, Math.PI * 2);
        context.fillStyle = `rgba(${SIGNAL}, ${alpha})`;
        context.fill();
      }
      context.restore();
    }

    function drawFramedScene(progress, alpha) {
      const box = reelBox();
      const reveal = ease(clamp((progress - 0.04) / 0.8));
      const pad = 18;
      const frameW = box.w * (0.72 + reveal * 0.08);
      const frameH = frameW * 0.56;
      const x = box.x + (box.w - frameW) * 0.5;
      const y = box.y + (box.h - frameH) * 0.42;

      context.save();
      context.beginPath();
      context.rect(box.x, box.y, box.w, box.h);
      context.clip();

      context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.75})`;
      context.lineWidth = 1.5;
      context.strokeRect(x, y, frameW, frameH);

      const corner = 12;
      [
        [x, y],
        [x + frameW, y],
        [x, y + frameH],
        [x + frameW, y + frameH]
      ].forEach(([cx, cy], index) => {
        const sx = index % 2 === 0 ? 1 : -1;
        const sy = index < 2 ? 1 : -1;
        context.beginPath();
        context.moveTo(cx + sx * corner, cy);
        context.lineTo(cx, cy);
        context.lineTo(cx, cy + sy * corner);
        context.strokeStyle = `rgba(${SIGNAL}, ${alpha})`;
        context.lineWidth = 1.8;
        context.stroke();
      });

      const horizon = y + frameH * (0.58 - reveal * 0.05);
      context.beginPath();
      context.moveTo(x + pad, horizon);
      context.lineTo(x + frameW - pad, horizon);
      context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.45})`;
      context.lineWidth = 1.2;
      context.stroke();

      if (reveal > 0.35) {
        const sunX = x + frameW * (0.68 - reveal * 0.05);
        const sunY = y + frameH * 0.34;
        context.beginPath();
        context.arc(sunX, sunY, 5 + reveal * 3, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.8})`;
        context.lineWidth = 1.4;
        context.stroke();
      }
      context.restore();
    }

    function drawMaster(progress, alpha) {
      const box = reelBox();
      const reveal = ease(clamp((progress - 0.06) / 0.78));
      const frameW = box.w * 0.78;
      const frameH = frameW * 0.56;
      const x = box.x + (box.w - frameW) * 0.5;
      const y = box.y + (box.h - frameH) * 0.38;

      context.save();
      context.beginPath();
      context.rect(box.x, box.y, box.w, box.h);
      context.clip();

      context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.8})`;
      context.lineWidth = 1.6;
      context.strokeRect(x, y, frameW, frameH);

      const lineY = y + frameH * 0.5;
      context.beginPath();
      context.moveTo(x + 22, lineY);
      context.lineTo(x + 22 + (frameW - 70) * reveal, lineY);
      context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.85})`;
      context.lineWidth = 1.7;
      context.stroke();

      if (reveal > 0.7) {
        const tick = ease((reveal - 0.7) / 0.3);
        const tx = x + frameW - 34;
        const ty = lineY;
        context.beginPath();
        context.moveTo(tx - 8, ty);
        context.lineTo(tx - 2, ty + 6 * tick);
        context.lineTo(tx + 11 * tick, ty - 8 * tick);
        context.strokeStyle = `rgba(${SIGNAL}, ${alpha})`;
        context.lineWidth = 2.1;
        context.stroke();
      }

      context.fillStyle = `rgba(${SIGNAL}, ${alpha * 0.9})`;
      context.font = `500 10px ${getComputedStyle(document.body).getPropertyValue('--mono') || 'ui-monospace'}`;
      context.fillText('MASTER', x + 22, y + frameH - 18);
      context.restore();
    }

    function drawStageChrome(alpha) {
      const box = reelBox();
      context.fillStyle = `rgba(${SIGNAL}, ${alpha * 0.035})`;
      context.fillRect(box.x, box.y, box.w, box.h);
      context.strokeStyle = `rgba(${INK}, ${alpha * 0.14})`;
      context.lineWidth = 1;
      context.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);

      const tooth = 5;
      const gap = 11;
      for (let x = box.x + 8; x < box.x + box.w - 8; x += gap) {
        context.fillStyle = `rgba(${INK}, ${alpha * 0.1})`;
        context.fillRect(x, box.y + 3, tooth, 2);
        context.fillRect(x, box.y + box.h - 5, tooth, 2);
      }
    }

    function draw(now, stepProgress, staticState) {
      if (!context || width < 2 || height < 2) return;
      context.clearRect(0, 0, width, height);
      const progress = staticState ? 1 : stepProgress;
      const alpha = 0.95;
      drawStageChrome(alpha * 0.9);

      if (activeStep === 0) drawAperture(progress, alpha);
      else if (activeStep === 1) drawScore(progress, alpha, now, staticState);
      else if (activeStep === 2) drawFramedScene(progress, alpha);
      else if (activeStep === 3) drawMaster(progress, alpha);
    }

    function update(now) {
      const position = storyPosition();
      const reduced = window.EphemerentMotion?.reduced() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      showStep(position.selected, reduced);
      updateFrameBlend(position.raw, reduced);
      updateBeatRail(position.selected, position.local, reduced);
      const total = clamp(position.raw / Math.max(1, steps.length - 1));
      root.style.setProperty('--vespera-progress', total.toFixed(4));
      root.style.setProperty('--vespera-local', position.local.toFixed(4));
      root.style.setProperty('--story-progress', total.toFixed(4));
      root.dataset.reelStep = String(position.selected);

      const needsPulse = position.selected === 1 && position.local > 0.1 && !reduced;
      if (needsPulse || Math.abs(position.raw - lastDrawPosition) >= 0.0005 || reduced) {
        draw(now, position.local, reduced);
        lastDrawPosition = position.raw;
      }
    }

    if (canvas && window.ResizeObserver) {
      new ResizeObserver(resize).observe(canvas);
    }
    showStep(0, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    resize();
    update(performance.now());

    if (window.EphemerentMotion) {
      window.EphemerentMotion.register(root, update);
    } else {
      root.dataset.motion = 'static';
      frames.forEach((frame) => frame.removeAttribute('aria-hidden'));
      draw(performance.now(), 0.72, true);
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
