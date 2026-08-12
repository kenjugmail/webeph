/* Temporary minds: a scroll-directed field sequence for the physical studies.
   The shared scheduler handles visibility; this module only draws while its scene is active. */
(function () {
  'use strict';

  const SIGNAL_CYCLE = 10000;
  const MAX_CANVAS_DPR = 2;
  const MAX_CANVAS_EDGE = 2048;
  const ROUTES = [
    [[.135, .51], [.22, .44], [.36, .31], [.47, .18], [.58, .14], [.72, .20]],
    [[.135, .51], [.24, .49], [.35, .49], [.43, .49], [.53, .52], [.64, .48], [.75, .51]],
    [[.135, .51], [.24, .59], [.35, .69], [.44, .68], [.56, .81], [.70, .79], [.82, .83]]
  ];
  const STORY = [
    { label: 'Assemble', caption: 'Goal received · scope made explicit' },
    { label: 'Isolate', caption: 'Independent paths · boundaries preserved' },
    { label: 'Verify', caption: 'Evidence compared · one result selected' },
    { label: 'Release', caption: 'Workers released · trace retained' }
  ];

  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function ease(value) {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  }

  function reducedMotion() {
    return window.EphemerentMotion?.reduced() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function updatePlate(plate, index, reduced) {
    if (!plate) return;
    const item = STORY[index] || STORY[0];
    const frames = Array.from(plate.querySelectorAll('[data-plate-frame]'));
    const phase = plate.querySelector('[data-ehero-plate-phase]');
    const detail = plate.querySelector('[data-plate-detail]');

    plate.dataset.plateCurrent = String(index);
    plate.classList.toggle('is-static', reduced);
    frames.forEach((frame, frameIndex) => {
      const active = frameIndex === index;
      if (active) frame.setAttribute('data-active', 'true');
      else frame.removeAttribute('data-active');
      frame.setAttribute('aria-hidden', String(!active));
    });
    if (phase) phase.textContent = item.label.toUpperCase();
    if (detail) detail.textContent = item.caption;
  }

  function mountFieldPlate(plate) {
    if (!plate || plate.dataset.plateMounted === 'true') return;
    plate.dataset.plateMounted = 'true';
    updatePlate(plate, Number(plate.dataset.plateCurrent || 0), reducedMotion());

    const firstImage = plate.querySelector('[data-plate-frame="0"] img');
    const markReady = () => requestAnimationFrame(() => { plate.dataset.plateReady = 'true'; });
    if (!firstImage || firstImage.complete) markReady();
    else {
      firstImage.addEventListener('load', markReady, { once: true });
      firstImage.addEventListener('error', markReady, { once: true });
    }

    const setVisible = (visible) => {
      plate.dataset.plateActive = String(visible && !document.hidden);
    };
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => setVisible(entry.isIntersecting));
      }, { threshold: .06, rootMargin: '80px 0px' });
      observer.observe(plate);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) setVisible(false);
        else setVisible(plate.getBoundingClientRect().bottom > 0 && plate.getBoundingClientRect().top < innerHeight);
      });
    } else {
      setVisible(true);
    }

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    preference.addEventListener?.('change', () => {
      updatePlate(plate, Number(plate.dataset.plateCurrent || 0), reducedMotion());
    });
  }

  function mountEmergence(canvas) {
    if (!canvas || canvas.dataset.emergenceMounted === 'true') return;
    canvas.dataset.emergenceMounted = 'true';

    const context = canvas.getContext('2d');
    if (!context) return;
    const scene = canvas.closest('[data-emergence-scene]') || canvas;
    const steps = Array.from(scene.querySelectorAll('[data-story-step]'));
    const frames = Array.from(scene.querySelectorAll('[data-story-frame]'));
    const plate = document.querySelector('[data-emergence-plate]');
    const indexLabel = scene.querySelector('[data-story-index]');
    const nameLabel = scene.querySelector('[data-story-label]');
    const caption = scene.querySelector('[data-story-caption]');
    let width = 1;
    let height = 1;
    let dpr = 1;
    let activeStep = -1;
    let lastStepProgress = .62;
    let lastFramePosition = -1;
    let lastDrawPosition = -1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.max(1, Math.min(
        window.devicePixelRatio || 1,
        MAX_CANVAS_DPR,
        MAX_CANVAS_EDGE / width,
        MAX_CANVAS_EDGE / height
      ));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastDrawPosition = -1;
      draw(performance.now(), lastStepProgress, true);
    }

    function scaled(point) { return [point[0] * width, point[1] * height]; }

    function pathMetrics(points) {
      const lengths = [];
      let total = 0;
      for (let index = 1; index < points.length; index += 1) {
        const dx = points[index][0] - points[index - 1][0];
        const dy = points[index][1] - points[index - 1][1];
        const length = Math.hypot(dx, dy);
        lengths.push(length);
        total += length;
      }
      return { lengths, total };
    }

    function traceRoute(route, amount, alpha, lineWidth, color) {
      const points = route.map(scaled);
      const metrics = pathMetrics(points);
      let remaining = metrics.total * clamp(amount);
      if (remaining <= 0) return;

      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      for (let index = 1; index < points.length && remaining > 0; index += 1) {
        const segment = metrics.lengths[index - 1];
        const portion = Math.min(1, remaining / segment);
        const x = points[index - 1][0] + (points[index][0] - points[index - 1][0]) * portion;
        const y = points[index - 1][1] + (points[index][1] - points[index - 1][1]) * portion;
        context.lineTo(x, y);
        remaining -= segment;
      }
      context.strokeStyle = `rgba(${color || '21, 96, 84'}, ${alpha})`;
      context.lineWidth = lineWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
    }

    function pointOnRoute(route, amount) {
      const points = route.map(scaled);
      const metrics = pathMetrics(points);
      let remaining = metrics.total * clamp(amount);
      for (let index = 1; index < points.length; index += 1) {
        const segment = metrics.lengths[index - 1];
        if (remaining <= segment) {
          const portion = remaining / segment;
          return [
            points[index - 1][0] + (points[index][0] - points[index - 1][0]) * portion,
            points[index - 1][1] + (points[index][1] - points[index - 1][1]) * portion
          ];
        }
        remaining -= segment;
      }
      return points[points.length - 1];
    }

    function drawGoalFrame(progress, alpha) {
      const [x, y] = scaled(ROUTES[0][0]);
      const size = 46 - ease(progress) * 15;
      const corner = 9;
      context.beginPath();
      context.moveTo(x - size, y - size + corner);
      context.lineTo(x - size, y - size);
      context.lineTo(x - size + corner, y - size);
      context.moveTo(x + size - corner, y - size);
      context.lineTo(x + size, y - size);
      context.lineTo(x + size, y - size + corner);
      context.moveTo(x - size, y + size - corner);
      context.lineTo(x - size, y + size);
      context.lineTo(x - size + corner, y + size);
      context.moveTo(x + size - corner, y + size);
      context.lineTo(x + size, y + size);
      context.lineTo(x + size, y + size - corner);
      context.strokeStyle = `rgba(21, 96, 84, ${alpha * .92})`;
      context.lineWidth = 1.8;
      context.stroke();
    }

    function drawSignal(route, amount, alpha, index) {
      const point = pointOnRoute(route, amount);
      const boxWidth = width < 540 ? 22 : 27;
      const boxHeight = width < 540 ? 14 : 17;
      context.fillStyle = `rgba(243, 240, 232, ${alpha * .96})`;
      context.fillRect(point[0] - boxWidth / 2, point[1] - boxHeight / 2, boxWidth, boxHeight);
      context.strokeStyle = `rgba(21, 96, 84, ${alpha})`;
      context.lineWidth = 1.6;
      context.strokeRect(point[0] - boxWidth / 2 + .8, point[1] - boxHeight / 2 + .8, boxWidth - 1.6, boxHeight - 1.6);
      context.fillStyle = `rgba(21, 96, 84, ${alpha})`;
      context.font = `${width < 540 ? 7 : 8}px "IBM Plex Mono", ui-monospace, monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(`0${index + 1}`, point[0], point[1] + .4);
    }

    function drawCornerBox(bounds, progress, alpha) {
      const [left, top] = scaled(bounds[0]);
      const [right, bottom] = scaled(bounds[1]);
      const amount = ease(progress);
      const corner = Math.min(18, Math.max(9, width * .018)) * amount;
      if (corner <= 0) return;
      context.beginPath();
      context.moveTo(left, top + corner);
      context.lineTo(left, top);
      context.lineTo(left + corner, top);
      context.moveTo(right - corner, top);
      context.lineTo(right, top);
      context.lineTo(right, top + corner);
      context.moveTo(left, bottom - corner);
      context.lineTo(left, bottom);
      context.lineTo(left + corner, bottom);
      context.moveTo(right - corner, bottom);
      context.lineTo(right, bottom);
      context.lineTo(right, bottom - corner);
      context.strokeStyle = `rgba(21, 96, 84, ${alpha * .86})`;
      context.lineWidth = 1.45;
      context.stroke();
    }

    function drawIsolation(progress, alpha) {
      const reveal = ease(clamp((progress - .05) / .74));
      const [railX, railTop] = scaled([.35, .17]);
      const [, railBottom] = scaled([.35, .83]);
      context.beginPath();
      context.moveTo(railX, railTop);
      context.lineTo(railX, railTop + (railBottom - railTop) * reveal);
      context.strokeStyle = `rgba(21, 96, 84, ${alpha * .5})`;
      context.lineWidth = 1.25;
      context.stroke();

      const lanes = [
        [[.72, .12], [.88, .30]],
        [[.75, .42], [.94, .64]],
        [[.72, .70], [.90, .89]]
      ];
      lanes.forEach((bounds, index) => {
        const laneProgress = clamp(reveal * 1.35 - index * .16);
        drawCornerBox(bounds, laneProgress, alpha * (.62 + index * .1));
      });
    }

    function drawVerification(progress, alpha) {
      const reveal = ease(clamp((progress - .08) / .68));
      drawCornerBox([[.63, .47], [.96, .79]], reveal, alpha * .9);

      const [startX, lineY] = scaled([.49, .62]);
      const [endX] = scaled([.64, .62]);
      context.beginPath();
      context.moveTo(startX, lineY);
      context.lineTo(startX + (endX - startX) * reveal, lineY);
      context.strokeStyle = `rgba(21, 96, 84, ${alpha * .86})`;
      context.lineWidth = 1.75;
      context.stroke();

      if (reveal > .72) {
        const [tickX, tickY] = scaled([.66, .62]);
        const tick = ease((reveal - .72) / .28);
        context.beginPath();
        context.moveTo(tickX - 7, tickY);
        context.lineTo(tickX - 2, tickY + 5 * tick);
        context.lineTo(tickX + 9 * tick, tickY - 7 * tick);
        context.strokeStyle = `rgba(21, 96, 84, ${alpha})`;
        context.lineWidth = 2.05;
        context.stroke();
      }
    }

    function storyAnchor() {
      if (window.innerWidth > 900) return window.innerHeight * .51;
      const pin = scene.querySelector('.ehero-story-pin');
      const pinBottom = pin?.getBoundingClientRect().bottom || window.innerHeight * .48;
      return Math.min(window.innerHeight * .82, pinBottom + 145);
    }

    function currentStoryPosition() {
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
      return { selected, local, raw };
    }

    function updateFrameBlend(raw, reduced) {
      if (reduced) {
        frames.forEach((frame) => {
          frame.style.removeProperty('opacity');
          frame.style.removeProperty('transform');
          frame.style.removeProperty('z-index');
        });
        lastFramePosition = raw;
        return;
      }
      if (Math.abs(raw - lastFramePosition) < .0005) return;
      lastFramePosition = raw;
      frames.forEach((frame, index) => {
        const distance = Math.min(1, Math.abs(raw - index));
        const opacity = clamp(1 - distance);
        const shift = (index - raw) * 12;
        const scale = 1 + distance * .006;
        frame.style.opacity = opacity.toFixed(3);
        frame.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
        frame.style.zIndex = opacity > 0 ? String(Math.round(opacity * 10) + 1) : '0';
      });
    }

    function setStep(index, reduced) {
      if (index !== activeStep) {
        activeStep = index;
        scene.dataset.storyCurrent = String(index);

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

        const item = STORY[index] || STORY[0];
        if (indexLabel) indexLabel.textContent = `${String(index + 1).padStart(2, '0')} / 04`;
        if (nameLabel) nameLabel.textContent = item.label;
        if (caption) caption.textContent = item.caption;
        updatePlate(plate, index, reduced);
      }

      frames.forEach((frame, frameIndex) => {
        if (reduced || frameIndex === index) frame.removeAttribute('aria-hidden');
        else frame.setAttribute('aria-hidden', 'true');
      });
    }

    function draw(now, stepProgress, staticState) {
      context.clearRect(0, 0, width, height);
      const progress = staticState ? 1 : stepProgress;

      if (activeStep === 0) {
        const reveal = staticState ? 1 : ease(clamp((progress - .08) / .72));
        drawGoalFrame(reveal, .28 + reveal * .58);
        ROUTES.forEach((route, index) => {
          const routeProgress = ease(clamp(reveal * 1.30 - index * .14));
          traceRoute(route, routeProgress, .96, 2.45);
        });
        if (reveal > .5) {
          const cycle = staticState ? .72 : (now % SIGNAL_CYCLE) / SIGNAL_CYCLE;
          ROUTES.forEach((route, index) => {
            drawSignal(route, (cycle + index * .21) % 1, staticState ? .86 : .98, index);
          });
        }
      } else if (activeStep === 1) {
        drawIsolation(progress, .88);
      } else if (activeStep === 2) {
        drawVerification(progress, .94);
      } else if (activeStep === 3) {
        drawVerification(1, 1 - ease(clamp((progress - .42) / .42)));
      }
    }

    function update(now) {
      const position = currentStoryPosition();
      lastStepProgress = position.local;
      const reduced = reducedMotion();
      setStep(position.selected, reduced);
      updateFrameBlend(position.raw, reduced);
      const total = clamp(position.raw / Math.max(1, steps.length - 1));
      scene.style.setProperty('--story-progress', total.toFixed(4));

      const hasTimedSignal = position.selected === 0 && position.local > .34 && !reduced;
      if (hasTimedSignal || Math.abs(position.raw - lastDrawPosition) >= .0005 || reduced) {
        draw(now, position.local, reduced);
        lastDrawPosition = position.raw;
      }
    }

    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    setStep(0, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    resize();

    if (window.EphemerentMotion) {
      window.EphemerentMotion.register(scene, update);
    } else {
      frames.forEach((frame) => frame.removeAttribute('aria-hidden'));
      draw(performance.now(), .72, true);
    }
  }

  window.mountEmergence = mountEmergence;

  function mountInstitutionalMotion() {
    mountFieldPlate(document.querySelector('[data-emergence-plate]'));
    mountEmergence(document.getElementById('fig'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountInstitutionalMotion, { once: true });
  } else {
    mountInstitutionalMotion();
  }
})();
