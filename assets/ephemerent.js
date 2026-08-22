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
  const STORY_CAMERA = [
    { from: [-1.6, .5, 1.054], to: [.8, -.6, 1.022], origin: '43% 50%' },
    { from: [1.7, .3, 1.058], to: [-.8, -.7, 1.024], origin: '55% 48%' },
    { from: [-1.5, .5, 1.052], to: [.7, -.6, 1.021], origin: '62% 52%' },
    { from: [.8, .1, 1.034], to: [0, -.5, 1.017], origin: '68% 50%' }
  ];

  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function ease(value) {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  }
  function lerp(from, to, amount) { return from + (to - from) * amount; }

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
    const glossary = scene.querySelector('[data-story-glossary]');
    const glossaryTerms = Array.from(glossary?.querySelectorAll('[data-story-term]') || []);
    const glossaryMeter = glossary?.querySelector('.ehero-glossary-progress i');
    let width = 1;
    let height = 1;
    let dpr = 1;
    let activeStep = -1;
    let lastStepProgress = .62;
    let lastFramePosition = -1;
    let lastCameraProgress = -1;
    let lastDrawPosition = -1;
    let lastGlossaryProgress = -1;

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

    function updateFrameBlend(raw, selected, local, reduced) {
      if (reduced) {
        frames.forEach((frame) => {
          frame.style.removeProperty('opacity');
          frame.style.removeProperty('transform');
          frame.style.removeProperty('z-index');
          frame.style.removeProperty('--story-camera-x');
          frame.style.removeProperty('--story-camera-y');
          frame.style.removeProperty('--story-camera-scale');
          frame.style.removeProperty('--story-camera-origin');
        });
        lastFramePosition = raw;
        lastCameraProgress = local;
        return;
      }
      if (Math.abs(raw - lastFramePosition) < .0005 && Math.abs(local - lastCameraProgress) < .001) return;
      lastFramePosition = raw;
      lastCameraProgress = local;
      frames.forEach((frame, index) => {
        const distance = Math.min(1, Math.abs(raw - index));
        const opacity = clamp(1 - distance);
        const shift = (index - raw) * 12;
        const scale = 1 + distance * .006;
        const camera = STORY_CAMERA[index] || STORY_CAMERA[0];
        const cameraProgress = index === selected ? ease(local) : (raw > index ? 1 : 0);
        frame.style.opacity = opacity.toFixed(3);
        frame.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
        frame.style.zIndex = opacity > 0 ? String(Math.round(opacity * 10) + 1) : '0';
        frame.style.setProperty('--story-camera-x', `${lerp(camera.from[0], camera.to[0], cameraProgress).toFixed(3)}%`);
        frame.style.setProperty('--story-camera-y', `${lerp(camera.from[1], camera.to[1], cameraProgress).toFixed(3)}%`);
        frame.style.setProperty('--story-camera-scale', lerp(camera.from[2], camera.to[2], cameraProgress).toFixed(4));
        frame.style.setProperty('--story-camera-origin', camera.origin);
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

        glossaryTerms.forEach((term, termIndex) => {
          if (termIndex === index) {
            term.setAttribute('data-active', 'true');
            term.setAttribute('aria-current', 'step');
          } else {
            term.removeAttribute('data-active');
            term.removeAttribute('aria-current');
          }
        });
        if (glossary) glossary.dataset.glossaryCurrent = String(index);

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
      updateFrameBlend(position.raw, position.selected, position.local, reduced);
      const total = clamp(position.raw / Math.max(1, steps.length - 1));
      scene.style.setProperty('--story-progress', total.toFixed(4));
      scene.style.setProperty('--story-local', position.local.toFixed(4));
      if (glossaryMeter && Math.abs(total - lastGlossaryProgress) >= .0005) {
        glossaryMeter.style.transform = `scaleY(${total.toFixed(4)})`;
        lastGlossaryProgress = total;
      }

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

  function mountHomeChapterRail() {
    const rail = document.querySelector('[data-home-chapter-rail]');
    const glossary = document.querySelector('[data-story-glossary]');
    const story = document.querySelector('[data-emergence-scene]');
    if ((!rail && !glossary) || rail?.dataset.chapterRailMounted === 'true') return;

    const links = Array.from(rail?.querySelectorAll('[data-home-chapter-link]') || []);
    const chapters = links.map((link) => document.querySelector(`[data-home-chapter="${link.dataset.homeChapterLink}"]`));
    if (rail && (!links.length || chapters.some((chapter) => !chapter))) return;

    if (rail) rail.dataset.chapterRailMounted = 'true';
    let activeIndex = -1;

    function update() {
      if (glossary && story) {
        const storyRect = story.getBoundingClientRect();
        const glossaryVisible = storyRect.top < window.innerHeight * .76 && storyRect.bottom > window.innerHeight * .24;
        glossary.toggleAttribute('data-visible', glossaryVisible);
      }

      if (!rail) return;
      const focus = window.innerHeight * .42;
      let nextIndex = 0;
      chapters.forEach((chapter, index) => {
        if (chapter.getBoundingClientRect().top <= focus) nextIndex = index;
      });

      if (nextIndex !== activeIndex) {
        activeIndex = nextIndex;
        links.forEach((link, index) => {
          if (index === activeIndex) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
        chapters.forEach((chapter, index) => {
          if (index === activeIndex) chapter.setAttribute('data-home-active', 'true');
          else chapter.removeAttribute('data-home-active');
        });
        document.body.dataset.homeChapter = links[activeIndex].dataset.homeChapterLink;
      }

      const firstRect = chapters[0].getBoundingClientRect();
      const lastRect = chapters[chapters.length - 1].getBoundingClientRect();
      const visible = firstRect.top < window.innerHeight * .4 && lastRect.bottom > window.innerHeight * .2;
      if (visible) rail.setAttribute('data-active', 'true');
      else rail.removeAttribute('data-active');

      const scrollPosition = window.scrollY;
      const start = scrollPosition + firstRect.top - window.innerHeight * .55;
      const end = scrollPosition + lastRect.bottom - window.innerHeight * .45;
      const progress = clamp((scrollPosition - start) / Math.max(1, end - start));
      rail.style.setProperty('--home-register-progress', progress.toFixed(4));
    }

    if (window.EphemerentMotion) {
      window.EphemerentMotion.register(document.body, update, { continuous: false });
    } else {
      let queued = false;
      const schedule = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          update();
        });
      };
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
      schedule();
    }
  }

  function mountInstitutionalMotion() {
    mountFieldPlate(document.querySelector('[data-emergence-plate]'));
    mountEmergence(document.getElementById('fig'));
    mountHomeChapterRail();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountInstitutionalMotion, { once: true });
  } else {
    mountInstitutionalMotion();
  }
})();
