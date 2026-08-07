/* Shelterix mobility reel — product-owned scroll animation.
   Recruit → Stabilize → Train → Work → Reinvest.
   Drawn in a side stage so type stays clear. Hard cuts only. */
(function () {
  'use strict';

  const STORY = [
    { phase: 'Recruit', caption: 'Meet where people are · no résumé gate' },
    { phase: 'Stabilize', caption: 'Runway cleared · next action ranked' },
    { phase: 'Train', caption: 'Ladder visible · credential sealed' },
    { phase: 'Work', caption: 'Task claimed · QA before wallet' },
    { phase: 'Reinvest', caption: 'Buckets purposed · flywheel turns' }
  ];
  const SIGNAL = '244, 201, 138';
  const ACCENT = '217, 138, 74';
  const INK = '243, 237, 225';
  const TOTAL = String(STORY.length).padStart(2, '0');
  const CYCLE = 7200;

  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function ease(value) {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  }

  function mountShelterixStory(root) {
    if (!root) return;

    const stage = root.querySelector('.shelterix-story-stage');
    const steps = Array.from(root.querySelectorAll('[data-sx-step]'));
    const frames = Array.from(root.querySelectorAll('[data-sx-frame]'));
    const indexLabel = root.querySelector('[data-sx-index]');
    const phaseLabel = root.querySelector('[data-sx-phase]');
    const caption = root.querySelector('[data-sx-caption]');
    const canvas = root.querySelector('.shelterix-reel');
    const context = canvas ? canvas.getContext('2d') : null;

    let activeStep = -1;
    let lastFramePosition = -1;
    let lastDrawKey = '';
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
      let local = selectedRect ? clamp((anchor - selectedRect.top) / Math.max(1, selectedRect.height)) : 0.5;
      /* While the active chapter still sits mostly below the pin, keep the reel readable. */
      if (selectedRect && selectedRect.top > anchor - selectedRect.height * 0.15) {
        local = Math.max(local, 0.55);
      }
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
      lastDrawKey = '';
      if (width > 2 && height > 2) {
        const reduced = window.EphemerentMotion?.reduced() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        draw(performance.now(), 0.72, reduced);
      }
    }

    function reelBox() {
      const stacked = window.innerWidth <= 900;
      if (stacked) {
        return {
          x: width * 0.05,
          y: height * 0.07,
          w: width * 0.9,
          h: height * 0.86
        };
      }
      return {
        x: width * 0.07,
        y: height * 0.1,
        w: width * 0.86,
        h: height * 0.8
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
      if (reduced || stacked || Math.abs(raw - lastFramePosition) < 0.0005) {
        if (reduced || stacked) clearFrameMotionStyles();
        lastFramePosition = raw;
        return;
      }
      lastFramePosition = raw;
      clearFrameMotionStyles();
    }

    function showStep(index, reduced) {
      if (index !== activeStep) {
        activeStep = index;
        root.dataset.sxCurrent = String(index);
        steps.forEach((stepEl, stepIndex) => {
          if (stepIndex === index) stepEl.setAttribute('data-active', 'true');
          else stepEl.removeAttribute('data-active');
        });
        frames.forEach((frame, frameIndex) => {
          if (frameIndex === index) frame.setAttribute('data-active', 'true');
          else frame.removeAttribute('data-active');
        });
        const chapter = STORY[index] || STORY[0];
        if (indexLabel) indexLabel.textContent = `${String(index + 1).padStart(2, '0')} / ${TOTAL}`;
        if (phaseLabel) phaseLabel.textContent = chapter.phase;
        if (caption) caption.textContent = chapter.caption;
        lastDrawKey = '';
      }

      frames.forEach((frame, frameIndex) => {
        if (reduced || frameIndex === index) frame.removeAttribute('aria-hidden');
        else frame.setAttribute('aria-hidden', 'true');
      });
    }

    function drawStageChrome(alpha) {
      const box = reelBox();
      const grad = context.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
      grad.addColorStop(0, `rgba(${ACCENT}, ${alpha * 0.07})`);
      grad.addColorStop(1, `rgba(${SIGNAL}, ${alpha * 0.02})`);
      context.fillStyle = grad;
      context.fillRect(box.x, box.y, box.w, box.h);
      context.strokeStyle = `rgba(${INK}, ${alpha * 0.16})`;
      context.lineWidth = 1;
      context.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);

      const tooth = 4;
      const gap = 10;
      for (let x = box.x + 8; x < box.x + box.w - 8; x += gap) {
        context.fillStyle = `rgba(${INK}, ${alpha * 0.1})`;
        context.fillRect(x, box.y + 3, tooth, 2);
        context.fillRect(x, box.y + box.h - 5, tooth, 2);
      }
    }

    function drawRecruit(progress, alpha, now, staticState) {
      const box = reelBox();
      const reveal = ease(Math.max(0.4, clamp(progress)));
      const cx = box.x + box.w * 0.5;
      const cy = box.y + box.h * 0.46;
      const nodes = [
        [0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5]
      ];
      const pulse = staticState ? 0.5 : (0.5 + 0.5 * Math.sin((now % CYCLE) / CYCLE * Math.PI * 2));
      const r = Math.min(box.w, box.h) * (0.26 + pulse * 0.02);

      context.save();
      context.beginPath();
      context.rect(box.x, box.y, box.w, box.h);
      context.clip();

      context.beginPath();
      context.arc(cx, cy, 18 + pulse * 4, 0, Math.PI * 2);
      context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.18})`;
      context.lineWidth = 1;
      context.stroke();

      context.beginPath();
      context.arc(cx, cy, 5, 0, Math.PI * 2);
      context.fillStyle = `rgba(${SIGNAL}, ${alpha})`;
      context.fill();

      nodes.forEach(([nx, ny], index) => {
        const t = clamp((reveal - index * 0.06) / 0.5);
        if (t <= 0) return;
        const x = cx + nx * r * t;
        const y = cy + ny * r * t;
        context.beginPath();
        context.moveTo(cx, cy);
        context.lineTo(x, y);
        context.strokeStyle = `rgba(${SIGNAL}, ${alpha * (0.28 + t * 0.45)})`;
        context.lineWidth = 1.35;
        context.stroke();
        context.beginPath();
        context.arc(x, y, 3.4, 0, Math.PI * 2);
        context.fillStyle = `rgba(${SIGNAL}, ${alpha * (0.55 + t * 0.45)})`;
        context.fill();
        if (t > 0.85) {
          context.beginPath();
          context.arc(x, y, 8 + pulse * 2, 0, Math.PI * 2);
          context.strokeStyle = `rgba(${ACCENT}, ${alpha * 0.22})`;
          context.stroke();
        }
      });
      context.restore();
    }

    function drawStabilize(progress, alpha) {
      const box = reelBox();
      const reveal = ease(Math.max(0.35, clamp(progress)));
      const houseW = box.w * 0.46;
      const houseH = box.h * 0.4;
      const x = box.x + (box.w - houseW) * 0.5;
      const y = box.y + box.h * 0.22;
      const roofPeak = y + houseH * 0.06;
      const eave = y + houseH * 0.34;

      context.save();
      context.beginPath();
      context.rect(box.x, box.y, box.w, box.h);
      context.clip();

      context.beginPath();
      context.moveTo(x + houseW * 0.5, roofPeak);
      context.lineTo(x + houseW * 0.04, eave);
      context.lineTo(x + houseW * 0.96, eave);
      context.closePath();
      context.strokeStyle = `rgba(${SIGNAL}, ${alpha * (0.45 + reveal * 0.5)})`;
      context.lineWidth = 1.7;
      context.stroke();

      const wallH = houseH * 0.55 * reveal;
      context.strokeRect(x + houseW * 0.16, eave, houseW * 0.68, wallH);
      if (reveal > 0.45) {
        const doorH = wallH * 0.55;
        context.strokeRect(
          x + houseW * 0.42,
          eave + wallH - doorH,
          houseW * 0.16,
          doorH
        );
      }

      const barY = box.y + box.h * 0.78;
      const barX = box.x + box.w * 0.14;
      const barW = box.w * 0.72;
      context.strokeStyle = `rgba(${INK}, ${alpha * 0.22})`;
      context.lineWidth = 1;
      context.strokeRect(barX, barY, barW, 10);
      context.fillStyle = `rgba(${SIGNAL}, ${alpha * 0.88})`;
      context.fillRect(barX, barY, barW * reveal, 10);
      context.fillStyle = `rgba(${SIGNAL}, ${alpha * 0.75})`;
      context.font = '500 9px ui-monospace, monospace';
      context.fillText('RUNWAY', barX, barY - 8);
      context.restore();
    }

    function drawTrain(progress, alpha) {
      const box = reelBox();
      const reveal = ease(Math.max(0.35, clamp(progress)));
      const left = box.x + box.w * 0.18;
      const bottom = box.y + box.h * 0.74;
      const rise = box.h * 0.46;
      const stepsN = 5;

      context.save();
      context.beginPath();
      context.rect(box.x, box.y, box.w, box.h);
      context.clip();

      for (let i = 0; i < stepsN; i += 1) {
        const t = clamp((reveal - i * 0.1) / 0.45);
        if (t <= 0) continue;
        const y = bottom - (rise * (i + 1)) / stepsN;
        const w = box.w * (0.26 + i * 0.07);
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(left + w * t, y);
        context.strokeStyle = `rgba(${SIGNAL}, ${alpha * (0.35 + t * 0.5)})`;
        context.lineWidth = 1.6;
        context.stroke();
        context.beginPath();
        context.moveTo(left + w * t, y);
        context.lineTo(left + w * t, y + 10);
        context.strokeStyle = `rgba(${ACCENT}, ${alpha * 0.45})`;
        context.stroke();
      }

      if (reveal > 0.5) {
        const seal = ease((reveal - 0.5) / 0.5);
        const sx = box.x + box.w * 0.72;
        const sy = box.y + box.h * 0.3;
        context.beginPath();
        context.arc(sx, sy, 18 * seal, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.92})`;
        context.lineWidth = 1.8;
        context.stroke();
        context.beginPath();
        context.moveTo(sx - 7 * seal, sy);
        context.lineTo(sx - 1 * seal, sy + 6 * seal);
        context.lineTo(sx + 9 * seal, sy - 7 * seal);
        context.stroke();
        context.fillStyle = `rgba(${SIGNAL}, ${alpha * 0.8})`;
        context.font = '500 9px ui-monospace, monospace';
        context.fillText('AI OP I', sx - 16, sy + 32);
      }
      context.restore();
    }

    function drawWork(progress, alpha, now, staticState) {
      const box = reelBox();
      const reveal = ease(Math.max(0.35, clamp(progress)));
      const chipW = box.w * 0.6;
      const chipH = box.h * 0.24;
      const x = box.x + (box.w - chipW) * 0.5;
      const y = box.y + box.h * 0.3;
      const head = staticState ? 0.62 : ((now % CYCLE) / CYCLE);

      context.save();
      context.beginPath();
      context.rect(box.x, box.y, box.w, box.h);
      context.clip();

      context.strokeStyle = `rgba(${SIGNAL}, ${alpha * (0.45 + reveal * 0.5)})`;
      context.lineWidth = 1.6;
      context.strokeRect(x, y, chipW, chipH);

      context.fillStyle = `rgba(${SIGNAL}, ${alpha * 0.8})`;
      context.font = '500 9px ui-monospace, monospace';
      context.fillText('TASK', x + 16, y + 18);

      const lineY = y + chipH * 0.62;
      context.beginPath();
      context.moveTo(x + 16, lineY);
      context.lineTo(x + 16 + (chipW - 70) * reveal, lineY);
      context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.78})`;
      context.lineWidth = 1.5;
      context.stroke();

      if (reveal > 0.2) {
        const hx = x + 16 + (chipW - 70) * reveal * (0.2 + head * 0.7);
        context.beginPath();
        context.arc(hx, lineY, 3.5, 0, Math.PI * 2);
        context.fillStyle = `rgba(${INK}, ${alpha * 0.9})`;
        context.fill();
      }

      if (reveal > 0.62) {
        const tick = ease((reveal - 0.62) / 0.38);
        const tx = x + chipW - 28;
        const ty = lineY;
        context.beginPath();
        context.moveTo(tx - 8, ty);
        context.lineTo(tx - 1, ty + 6 * tick);
        context.lineTo(tx + 11 * tick, ty - 8 * tick);
        context.strokeStyle = `rgba(${SIGNAL}, ${alpha})`;
        context.lineWidth = 2.1;
        context.stroke();
      }

      context.fillStyle = `rgba(${SIGNAL}, ${alpha * 0.85})`;
      context.fillText('HUMAN QA', x + 16, y + chipH + 26);
      context.restore();
    }

    function drawReinvest(progress, alpha, now, staticState) {
      const box = reelBox();
      const reveal = ease(Math.max(0.35, clamp(progress)));
      const cx = box.x + box.w * 0.5;
      const cy = box.y + box.h * 0.42;
      const r = Math.min(box.w, box.h) * 0.27;
      const spin = staticState ? reveal : Math.min(1, reveal * 0.85 + ((now % CYCLE) / CYCLE) * 0.15);

      context.save();
      context.beginPath();
      context.rect(box.x, box.y, box.w, box.h);
      context.clip();

      context.beginPath();
      context.arc(cx, cy, r, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * spin);
      context.strokeStyle = `rgba(${SIGNAL}, ${alpha * 0.88})`;
      context.lineWidth = 1.8;
      context.stroke();

      context.beginPath();
      context.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      context.strokeStyle = `rgba(${ACCENT}, ${alpha * 0.35})`;
      context.lineWidth = 1;
      context.stroke();

      const tipAngle = -Math.PI * 0.5 + Math.PI * 2 * spin;
      const ax = cx + Math.cos(tipAngle) * r;
      const ay = cy + Math.sin(tipAngle) * r;
      context.beginPath();
      context.arc(ax, ay, 4, 0, Math.PI * 2);
      context.fillStyle = `rgba(${SIGNAL}, ${alpha})`;
      context.fill();

      const labels = ['REC', 'RSV', 'TRN'];
      const buckets = 3;
      const baseY = box.y + box.h * 0.78;
      const gap = box.w * 0.06;
      const bw = (box.w * 0.64 - gap * (buckets - 1)) / buckets;
      const startX = box.x + box.w * 0.18;
      for (let i = 0; i < buckets; i += 1) {
        const t = clamp((reveal - 0.2 - i * 0.1) / 0.4);
        if (t <= 0) continue;
        const bx = startX + i * (bw + gap);
        const bh = 16 + i * 7;
        context.strokeStyle = `rgba(${SIGNAL}, ${alpha * (0.4 + t * 0.5)})`;
        context.strokeRect(bx, baseY - bh * t, bw, bh * t);
        context.fillStyle = `rgba(${SIGNAL}, ${alpha * 0.7})`;
        context.font = '500 8px ui-monospace, monospace';
        context.fillText(labels[i], bx + 4, baseY + 14);
      }
      context.restore();
    }

    function draw(now, stepProgress, staticState) {
      if (!context || width < 2 || height < 2) return;
      context.clearRect(0, 0, width, height);
      const progress = staticState ? 1 : Math.max(0.35, stepProgress);
      const alpha = 0.95;
      drawStageChrome(alpha * 0.95);

      if (activeStep <= 0) drawRecruit(progress, alpha, now, staticState);
      else if (activeStep === 1) drawStabilize(progress, alpha);
      else if (activeStep === 2) drawTrain(progress, alpha);
      else if (activeStep === 3) drawWork(progress, alpha, now, staticState);
      else if (activeStep === 4) drawReinvest(progress, alpha, now, staticState);
    }

    function update(now) {
      const position = storyPosition();
      const reduced = window.EphemerentMotion?.reduced() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      showStep(position.selected, reduced);
      updateFrameBlend(position.raw, reduced);
      const total = clamp(position.raw / Math.max(1, steps.length - 1));
      root.style.setProperty('--shelterix-progress', total.toFixed(4));
      root.style.setProperty('--shelterix-local', position.local.toFixed(4));
      root.style.setProperty('--story-progress', total.toFixed(4));
      root.dataset.reelStep = String(position.selected);

      const pulse = !reduced && (position.selected === 0 || position.selected === 3 || position.selected === 4);
      const key = `${position.selected}:${position.local.toFixed(3)}:${pulse ? Math.floor((now || 0) / 80) : 0}`;
      if (key !== lastDrawKey || reduced) {
        draw(now || performance.now(), position.local, reduced);
        lastDrawKey = key;
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
      draw(performance.now(), 0.85, true);
    }
  }

  function boot() {
    mountShelterixStory(document.querySelector('.shelterix-story'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
