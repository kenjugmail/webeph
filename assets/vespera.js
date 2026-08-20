/* Vespera studio motion.
   One shared visual grammar for the opening board and the production story:
   image → rhythm → scene → master. Copy stays hard-cut; the art carries the
   cinematic movement. */
(function () {
  'use strict';

  const STORY = [
    {
      phase: 'Brief',
      word: 'IMAGE',
      caption: 'Find the frame that makes the idea visible.',
      storyCaption: 'Direction chosen · frame ready',
      color: '#2f55ff',
      rgb: '47, 85, 255',
      textColor: '#2446c7',
      textColorDark: '#5d7bff',
      imagePosition: 0.22,
      imageScale: 1.035,
      imageOrigin: '38% 48%',
      cameraX: -0.4,
      cameraY: -0.25,
      cropX: 4,
      cropY: 2
    },
    {
      phase: 'Beat',
      word: 'RHYTHM',
      caption: 'Give the image somewhere to go.',
      storyCaption: 'Beats shaped · pace visible',
      color: '#f2675b',
      rgb: '242, 103, 91',
      textColor: '#b84538',
      textColorDark: '#f2675b',
      imagePosition: 0.42,
      imageScale: 1.065,
      imageOrigin: '48% 52%',
      cameraX: -1.1,
      cameraY: 0.35,
      cropX: 10,
      cropY: 5
    },
    {
      phase: 'Scene',
      word: 'SCENE',
      caption: 'Let framing and motion answer each other.',
      storyCaption: 'Scene linked · camera composed',
      color: '#9abf38',
      rgb: '154, 191, 56',
      textColor: '#63781b',
      textColorDark: '#9abf38',
      imagePosition: 0.66,
      imageScale: 1.08,
      imageOrigin: '62% 48%',
      cameraX: 0.8,
      cameraY: -0.45,
      cropX: 15,
      cropY: -2
    },
    {
      phase: 'Master',
      word: 'MASTER',
      caption: 'Leave a cut worth replaying.',
      storyCaption: 'Master encoded · source retained',
      color: '#8b67e8',
      rgb: '139, 103, 232',
      textColor: '#6949b7',
      textColorDark: '#9270e9',
      imagePosition: 0.82,
      imageScale: 1.045,
      imageOrigin: '68% 54%',
      cameraX: 1.35,
      cameraY: 0.2,
      cropX: 8,
      cropY: 4
    }
  ];

  const INK = '23, 33, 45';
  const PAPER = '247, 243, 235';
  const BOARD_PHASE_MS = 7600;
  let plateImage = null;
  let plateImageReady = false;

  function clamp(value) {
    return Math.max(0, Math.min(1, value));
  }

  function ease(value) {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  }

  function lerp(from, to, amount) {
    return from + (to - from) * clamp(amount);
  }

  function reducedMotion() {
    return window.EphemerentMotion?.reduced()
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb}, ${alpha})`;
  }

  function stageFor(index) {
    return STORY[Math.max(0, Math.min(STORY.length - 1, index))];
  }

  /* The story tints are set from here rather than from CSS, so the dark
     face needs its own set: a tint darkened for paper is unreadable on a
     dark ground, and vice versa. */
  function darkFace() {
    const forced = document.documentElement.dataset.mode;
    if (forced) return forced === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /* Re-tint on a face change. The stage colours are written as inline
     styles by setSignal, so a CSS-only mode switch leaves them behind;
     these are the two elements that carry a current stage index. */
  window.addEventListener('ephemerent:modechange', () => {
    document.querySelectorAll('[data-vespera-current], [data-vespera-board-step]')
      .forEach((el) => {
        const raw = el.dataset.vesperaCurrent ?? el.dataset.vesperaBoardStep;
        const i = Number(raw);
        if (!Number.isNaN(i)) setSignal(el, stageFor(i));
      });
  });

  function setSignal(element, stage) {
    const text = darkFace()
      ? (stage.textColorDark || stage.color)
      : (stage.textColor || stage.color);
    element.style.setProperty('--vespera-signal', text);
    element.style.setProperty('--vespera-mark', stage.color);
  }

  function loadPlateImage() {
    if (plateImage) return plateImage;
    plateImage = new Image();
    plateImage.decoding = 'async';
    plateImage.onload = () => {
      plateImageReady = true;
      window.EphemerentMotion?.schedule?.();
    };
    plateImage.src = 'assets/vespera-plate.jpg';
    return plateImage;
  }

  function drawImageCover(context, image, x, y, width, height, position = 0.5) {
    if (!image || !image.naturalWidth || !image.naturalHeight) return false;
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    if (sourceRatio > targetRatio) {
      sourceWidth = image.naturalHeight * targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) * clamp(position);
    } else {
      sourceHeight = image.naturalWidth / targetRatio;
      sourceY = (image.naturalHeight - sourceHeight) * 0.48;
    }

    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
    return true;
  }

  function drawPlate(context, box, stage, position = 0.5, options = {}) {
    const pad = Math.max(12, Math.min(24, box.w * 0.07));
    const x = box.x + pad;
    const y = box.y + pad * 0.8;
    const width = box.w - pad * 2;
    const height = box.h - pad * 1.6;
    const image = loadPlateImage();

    context.save();
    context.beginPath();
    context.rect(box.x, box.y, box.w, box.h);
    context.clip();
    context.fillStyle = rgba(PAPER, 0.96);
    context.fillRect(x, y, width, height);
    context.globalAlpha = 0.97;
    if (!drawImageCover(context, image, x, y, width, height, position)) {
      context.globalAlpha = 1;
      context.fillStyle = rgba(stage.rgb, 0.14);
      context.fillRect(x, y, width, height);
    }
    context.globalAlpha = 1;

    context.strokeStyle = rgba(INK, 0.5);
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    if (typeof options.focus === 'number') {
      const focusWidth = width * 0.30;
      const focusHeight = height * 0.48;
      const focusX = x + width * (0.18 + clamp(options.focus) * 0.44);
      const focusY = y + height * 0.24;
      drawCropFrame(context, focusX, focusY, focusWidth, focusHeight, stage, 0.74);
      context.fillStyle = rgba(stage.rgb, 0.96);
      context.fillRect(focusX - 2, focusY - 2, 4, 4);
    }

    context.restore();
  }

  function drawCropFrame(context, x, y, width, height, stage, alpha = 0.8) {
    const corner = Math.max(8, Math.min(18, width * 0.16));
    context.save();
    context.strokeStyle = rgba(stage.rgb, alpha);
    context.lineWidth = 1.1;
    [[x, y, 1, 1], [x + width, y, -1, 1],
      [x, y + height, 1, -1], [x + width, y + height, -1, -1]]
      .forEach(([pointX, pointY, sx, sy]) => {
        context.beginPath();
        context.moveTo(pointX + sx * corner, pointY);
        context.lineTo(pointX, pointY);
        context.lineTo(pointX, pointY + sy * corner);
        context.stroke();
      });
    context.restore();
  }

  function drawStageChrome(context, box, stage, strength, fill = true) {
    context.save();
    if (fill) {
      context.fillStyle = rgba(stage.rgb, 0.055 * strength);
      context.fillRect(box.x, box.y, box.w, box.h);
    }
    context.strokeStyle = rgba(INK, 0.16 * strength);
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(box.x, box.y + 0.5);
    context.lineTo(box.x + box.w, box.y + 0.5);
    context.moveTo(box.x, box.y + box.h - 0.5);
    context.lineTo(box.x + box.w, box.y + box.h - 0.5);
    context.stroke();

    const markGap = Math.max(12, Math.min(18, box.w / 28));
    for (let x = box.x + 8; x < box.x + box.w - 8; x += markGap) {
      context.fillStyle = rgba(INK, 0.12 * strength);
      context.fillRect(x, box.y + 3, 4, 1);
      context.fillRect(x, box.y + box.h - 4, 4, 1);
    }

    drawCropFrame(context, box.x, box.y, box.w, box.h, stage, 0.56 * strength);
    context.restore();
  }

  function reelBox(width, height, variant) {
    const board = variant === 'board';
    return {
      x: width * (board ? 0.07 : 0.08),
      y: height * (board ? 0.10 : 0.12),
      w: width * (board ? 0.86 : 0.84),
      h: height * (board ? 0.80 : 0.76)
    };
  }

  function drawAperture(context, box, stage, progress, now) {
    const reveal = ease(clamp(progress));
    drawPlate(context, box, stage, stage.imagePosition * 0.7 + reveal * 0.18, { focus: reveal });

    const lineY = box.y + box.h * (0.78 - reveal * 0.08);
    context.save();
    context.beginPath();
    context.moveTo(box.x + box.w * 0.08, lineY);
    context.lineTo(box.x + box.w * (0.24 + reveal * 0.58), lineY);
    context.strokeStyle = rgba(stage.rgb, 0.9);
    context.lineWidth = 1.4;
    context.stroke();
    context.beginPath();
    context.arc(box.x + box.w * (0.24 + reveal * 0.58), lineY, 3, 0, Math.PI * 2);
    context.fillStyle = rgba(stage.rgb, 0.98);
    context.fill();
    context.restore();
  }

  function drawRhythm(context, box, stage, progress, now, staticState) {
    const reveal = ease(clamp(progress));
    const gap = box.w * 0.035;
    const left = box.x + box.w * 0.06;
    const top = box.y + box.h * 0.16;
    const frameWidth = (box.w * 0.88 - gap * 3) / 4;
    const frameHeight = box.h * 0.50;

    context.save();
    context.beginPath();
    context.rect(box.x, box.y, box.w, box.h);
    context.clip();

    for (let index = 0; index < 4; index += 1) {
      const local = clamp((reveal - index * 0.14) / 0.72);
      if (local <= 0) continue;
      const frameBox = {
        x: left + index * (frameWidth + gap),
        y: top + (1 - local) * 10,
        w: frameWidth,
        h: frameHeight
      };
      drawPlate(context, frameBox, stage, index / 3, { focus: 0.42 + index * 0.12 });
    }

    const timelineY = box.y + box.h * 0.84;
    const span = box.w * 0.88;
    const head = staticState ? 0.54 : (now % BOARD_PHASE_MS) / BOARD_PHASE_MS;
    const headX = left + span * clamp(head * 0.86 + 0.05);
    context.beginPath();
    context.moveTo(left, timelineY);
    context.lineTo(left + span * reveal, timelineY);
    context.strokeStyle = rgba(stage.rgb, 0.84);
    context.lineWidth = 1.7;
    context.stroke();
    context.beginPath();
    context.moveTo(headX, timelineY - 16);
    context.lineTo(headX, timelineY + 16);
    context.strokeStyle = rgba(INK, 0.82);
    context.lineWidth = 1.2;
    context.stroke();
    context.beginPath();
    context.arc(headX, timelineY, 3.4, 0, Math.PI * 2);
    context.fillStyle = rgba(stage.rgb, 0.98);
    context.fill();
    context.restore();
  }

  function drawScene(context, box, stage, progress) {
    const reveal = ease(clamp((progress - 0.04) / 0.8));
    drawPlate(context, box, stage, stage.imagePosition, { focus: reveal });

    const horizon = box.y + box.h * (0.61 - reveal * 0.06);
    context.save();
    context.beginPath();
    context.moveTo(box.x + box.w * 0.12, horizon);
    context.lineTo(box.x + box.w * (0.30 + reveal * 0.52), horizon);
    context.strokeStyle = rgba(stage.rgb, 0.78);
    context.lineWidth = 1.3;
    context.stroke();
    context.beginPath();
    context.arc(box.x + box.w * (0.30 + reveal * 0.52), horizon, 4, 0, Math.PI * 2);
    context.strokeStyle = rgba(stage.rgb, 0.92);
    context.lineWidth = 1.3;
    context.stroke();
    context.restore();
  }

  function drawMaster(context, box, stage, progress) {
    const reveal = ease(clamp((progress - 0.06) / 0.78));
    const plateBox = {
      x: box.x + box.w * 0.10,
      y: box.y + box.h * 0.10,
      w: box.w * 0.80,
      h: box.h * 0.54
    };
    drawPlate(context, plateBox, stage, stage.imagePosition, { focus: 0.78 });

    const lineY = box.y + box.h * 0.83;
    context.save();
    context.beginPath();
    context.moveTo(box.x + box.w * 0.10, lineY);
    context.lineTo(box.x + box.w * (0.10 + 0.70 * reveal), lineY);
    context.strokeStyle = rgba(stage.rgb, 0.9);
    context.lineWidth = 1.8;
    context.stroke();
    if (reveal > 0.7) {
      const tick = ease((reveal - 0.7) / 0.3);
      const tx = box.x + box.w * 0.82;
      context.beginPath();
      context.moveTo(tx - 9, lineY);
      context.lineTo(tx - 3, lineY + 6 * tick);
      context.lineTo(tx + 10 * tick, lineY - 8 * tick);
      context.strokeStyle = rgba(stage.rgb, 0.98);
      context.lineWidth = 2.1;
      context.stroke();
    }
    context.restore();
  }

  function drawStoryCanvas(context, width, height, activeStep, local, now, staticState) {
    const stage = stageFor(activeStep);
    const box = reelBox(width, height, 'story');
    context.clearRect(0, 0, width, height);
    drawStageChrome(context, box, stage, 1);
    if (activeStep === 0) drawAperture(context, box, stage, staticState ? 1 : local, now);
    if (activeStep === 1) drawRhythm(context, box, stage, staticState ? 1 : local, now, staticState);
    if (activeStep === 2) drawScene(context, box, stage, staticState ? 1 : local);
    if (activeStep === 3) drawMaster(context, box, stage, staticState ? 1 : local);
  }

  function drawBoardCanvas(context, width, height, activeStep, local, staticState) {
    const stage = stageFor(activeStep);
    const box = reelBox(width, height, 'board');
    context.clearRect(0, 0, width, height);
    drawStageChrome(context, box, stage, 1, false);

    const reveal = ease(clamp(local));
    const focusX = box.x + box.w * (0.12 + reveal * 0.20);
    const focusY = box.y + box.h * 0.16;
    const focusW = box.w * 0.54;
    const focusH = box.h * 0.58;
    drawCropFrame(context, focusX, focusY, focusW, focusH, stage, 0.92);
    context.beginPath();
    context.moveTo(focusX, focusY + focusH * 0.72);
    context.lineTo(focusX + focusW, focusY + focusH * 0.72);
    context.strokeStyle = rgba(stage.rgb, 0.54);
    context.lineWidth = 1;
    context.stroke();

    context.fillStyle = rgba(stage.rgb, 0.95);
    context.fillRect(focusX - 2, focusY - 2, 4, 4);
    context.fillRect(focusX + focusW - 2, focusY + focusH - 2, 4, 4);

    const playhead = staticState ? 0.54 : local;
    const playX = box.x + box.w * (0.08 + playhead * 0.84);
    context.beginPath();
    context.moveTo(playX, box.y + box.h * 0.08);
    context.lineTo(playX, box.y + box.h * 0.90);
    context.strokeStyle = rgba(INK, 0.62);
    context.lineWidth = 1;
    context.stroke();
    context.beginPath();
    context.arc(playX, box.y + box.h * 0.90, 3.5, 0, Math.PI * 2);
    context.fillStyle = rgba(stage.rgb, 0.98);
    context.fill();
  }

  function createCanvas(canvas, draw) {
    if (!canvas) return null;
    const context = canvas.getContext('2d');
    if (!context) return null;
    let width = 1;
    let height = 1;
    let dpr = 1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, rect.width);
      const nextHeight = Math.max(1, rect.height);
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (nextWidth === width && nextHeight === height && nextDpr === dpr && canvas.width) return;
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(context, width, height, performance.now(), true);
    }

    const observer = window.ResizeObserver ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    resize();
    return {
      resize,
      draw(now, staticState) { draw(context, width, height, now, staticState); },
      disconnect() { observer?.disconnect(); }
    };
  }

  function mountStory(root) {
    if (!root) return;
    const stageElement = root.querySelector('.vespera-story-stage');
    const steps = Array.from(root.querySelectorAll('[data-vespera-step]'));
    const frames = Array.from(root.querySelectorAll('[data-vespera-frame]'));
    const beatCells = Array.from(root.querySelectorAll('[data-vespera-beat]'));
    const indexLabel = root.querySelector('[data-vespera-index]');
    const phaseLabel = root.querySelector('[data-vespera-phase]');
    const caption = root.querySelector('[data-vespera-caption]');
    const canvas = root.querySelector('.vespera-reel');
    let activeStep = -1;

    function storyAnchor() {
      if (window.innerWidth > 900) return window.innerHeight * 0.51;
      const stageBottom = stageElement?.getBoundingClientRect().bottom || window.innerHeight * 0.48;
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
      const selected = Math.max(0, Math.min(steps.length - 1, Math.round(raw)));
      const selectedRect = steps[selected]?.getBoundingClientRect();
      const local = selectedRect ? clamp((anchor - selectedRect.top) / Math.max(1, selectedRect.height)) : 0.5;
      return { raw, selected, local };
    }

    function setActive(index, isReduced) {
      if (index !== activeStep) {
        activeStep = index;
        const stage = stageFor(index);
        setSignal(root, stage);
        root.dataset.vesperaCurrent = String(index);
        root.dataset.vesperaPhase = stage.phase;
        steps.forEach((step, stepIndex) => {
          if (stepIndex === index) {
            step.setAttribute('data-active', 'true');
            step.setAttribute('aria-current', 'step');
          } else {
            step.removeAttribute('data-active');
            step.removeAttribute('aria-current');
          }
        });
        frames.forEach((frame, frameIndex) => {
          if (frameIndex === index) frame.setAttribute('data-active', 'true');
          else frame.removeAttribute('data-active');
        });
        if (indexLabel) indexLabel.textContent = `${String(index + 1).padStart(2, '0')} / 04`;
        if (phaseLabel) phaseLabel.textContent = stage.phase;
        if (caption) caption.textContent = stage.storyCaption;
      }

      frames.forEach((frame, frameIndex) => {
        if (isReduced || frameIndex === index) frame.removeAttribute('aria-hidden');
        else frame.setAttribute('aria-hidden', 'true');
      });
    }

    function updateBeatRail(step, local, isReduced) {
      const activeBeat = isReduced || step !== 1
        ? (step === 1 ? 0 : -1)
        : Math.min(beatCells.length - 1, Math.floor(clamp(local) * beatCells.length));
      beatCells.forEach((cell, index) => {
        if (index === activeBeat) cell.setAttribute('data-on', 'true');
        else cell.removeAttribute('data-on');
      });
    }

    const renderer = createCanvas(canvas, (context, width, height, now, staticState) => {
      drawStoryCanvas(context, width, height, activeStep < 0 ? 0 : activeStep, 0.56, now, staticState);
    });

    function update(now) {
      const position = storyPosition();
      const isReduced = reducedMotion();
      setActive(position.selected, isReduced);
      updateBeatRail(position.selected, position.local, isReduced);
      const total = clamp(position.raw / Math.max(1, steps.length - 1));
      root.style.setProperty('--vespera-progress', total.toFixed(4));
      root.style.setProperty('--vespera-local', position.local.toFixed(4));
      root.style.setProperty('--story-progress', total.toFixed(4));
      root.dataset.reelStep = String(position.selected);
      renderer?.draw(now, isReduced);
    }

    setActive(0, reducedMotion());
    renderer?.resize();
    update(performance.now());
    if (window.EphemerentMotion) {
      window.EphemerentMotion.register(root, update);
    } else {
      root.dataset.motion = 'static';
      frames.forEach((frame) => frame.removeAttribute('aria-hidden'));
      renderer?.draw(performance.now(), true);
    }
  }

  function mountBoard(root) {
    if (!root) return;
    const canvas = root.querySelector('.vespera-board-reel');
    const phaseLabel = root.querySelector('[data-vespera-board-phase]');
    const wordLabel = root.querySelector('[data-vespera-board-word]');
    const captionLabel = root.querySelector('[data-vespera-board-caption]');
    const contactFrames = Array.from(root.querySelectorAll('[data-vespera-contact]'));
    let activeStep = 0;
    let renderedStep = -1;

    function setPlateMotion(stage, nextStage, local, isReduced) {
      if (!stage) return;
      const transition = isReduced ? 0 : ease(clamp((local - 0.74) / 0.26));
      const drift = isReduced ? 0 : Math.sin(local * Math.PI) * 0.18;
      const scale = lerp(stage.imageScale || 1.02, nextStage.imageScale || 1.02, transition);
      const cameraX = lerp(stage.cameraX || 0, nextStage.cameraX || 0, transition) + drift;
      const cameraY = lerp(stage.cameraY || 0, nextStage.cameraY || 0, transition) - drift * 0.35;
      const cropX = lerp(stage.cropX || 0, nextStage.cropX || 0, transition);
      const cropY = lerp(stage.cropY || 0, nextStage.cropY || 0, transition);

      root.style.setProperty('--vespera-plate-scale', scale.toFixed(4));
      root.style.setProperty('--vespera-plate-origin', stage.imageOrigin || '50% 50%');
      root.style.setProperty('--vespera-plate-x', `${cameraX.toFixed(3)}%`);
      root.style.setProperty('--vespera-plate-y', `${cameraY.toFixed(3)}%`);
      root.style.setProperty('--vespera-crop-x', `${cropX.toFixed(2)}px`);
      root.style.setProperty('--vespera-crop-y', `${cropY.toFixed(2)}px`);
      root.style.setProperty('--vespera-crop-x-inverse', `${(-cropX).toFixed(2)}px`);
      root.style.setProperty('--vespera-crop-y-inverse', `${(-cropY).toFixed(2)}px`);
    }

    const renderer = createCanvas(canvas, (context, width, height, now, staticState) => {
      const phaseSpan = BOARD_PHASE_MS * STORY.length;
      const elapsed = staticState ? BOARD_PHASE_MS * 0.52 : now % phaseSpan;
      activeStep = Math.min(STORY.length - 1, Math.floor(elapsed / BOARD_PHASE_MS));
      const local = staticState ? 0.52 : (elapsed % BOARD_PHASE_MS) / BOARD_PHASE_MS;
      drawBoardCanvas(context, width, height, activeStep, local, staticState);
    });

    function update(now) {
      const isReduced = reducedMotion();
      const phaseSpan = BOARD_PHASE_MS * STORY.length;
      const elapsed = isReduced ? BOARD_PHASE_MS * 0.52 : now % phaseSpan;
      const index = isReduced ? 0 : Math.min(STORY.length - 1, Math.floor(elapsed / BOARD_PHASE_MS));
      const stage = stageFor(index);
      const nextStage = stageFor((index + 1) % STORY.length);
      const local = isReduced ? 0.52 : (elapsed % BOARD_PHASE_MS) / BOARD_PHASE_MS;
      activeStep = index;
      setPlateMotion(stage, nextStage, local, isReduced);
      root.style.setProperty('--vespera-contact-progress', String((index + local) / STORY.length));

      if (index !== renderedStep) {
        renderedStep = index;
        setSignal(root, stage);
        root.dataset.vesperaBoardStep = String(index);
        if (phaseLabel) phaseLabel.textContent = stage.phase;
        if (wordLabel) wordLabel.textContent = stage.word;
        if (captionLabel) captionLabel.textContent = stage.caption;
        contactFrames.forEach((frame, frameIndex) => {
          if (frameIndex === index) frame.setAttribute('data-active', 'true');
          else frame.removeAttribute('data-active');
        });
      }
      renderer?.draw(now, isReduced);
    }

    renderer?.resize();
    update(performance.now());
    if (window.EphemerentMotion) {
      window.EphemerentMotion.register(root, update);
    } else {
      root.dataset.motion = 'static';
      renderer?.draw(performance.now(), true);
    }
  }

  function boot() {
    mountBoard(document.querySelector('.vespera-studio-board'));
    mountStory(document.querySelector('.vespera-story'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
