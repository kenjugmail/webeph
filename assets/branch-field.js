/* Shared branching trace for product stories.
   Drawn by the site-wide motion scheduler; no independent animation loop. */
(function () {
  'use strict';

  const CYCLE = 10000;
  const ROUTES = {
    orrery: [
      [[.12, .50], [.34, .50], [.49, .31], [.84, .31]],
      [[.12, .50], [.34, .50], [.49, .50], [.84, .50]],
      [[.12, .50], [.34, .50], [.49, .69], [.84, .69]]
    ],
    arbiter: [
      [[.16, .50], [.42, .50], [.55, .25], [.76, .25]],
      [[.16, .50], [.42, .50], [.55, .42], [.76, .42]],
      [[.16, .50], [.42, .50], [.55, .59], [.76, .59]],
      [[.16, .50], [.42, .50], [.55, .76], [.76, .76]]
    ]
  };

  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function ease(value) {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  }

  function mountBranchField(canvas) {
    if (!canvas || canvas.dataset.branchMounted === 'true') return;
    canvas.dataset.branchMounted = 'true';

    const context = canvas.getContext('2d');
    const kind = canvas.dataset.branchField === 'arbiter' ? 'arbiter' : 'orrery';
    const routes = ROUTES[kind];
    const frame = canvas.closest('[data-orrery-frame], [data-arbiter-frame]');
    const scene = canvas.closest('[data-scene], .orrery-story, .arbiter-story') || canvas;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let wasActive = false;
    let color = 'currentColor';
    let routeData = [];
    let activeSince = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      color = getComputedStyle(canvas).color;
      routeData = routes.map((route) => {
        const points = pointsFor(route);
        return { points, measure: metrics(points) };
      });
      draw(performance.now(), true);
    }

    function pointsFor(route) {
      return route.map(([x, y]) => [x * width, y * height]);
    }

    function metrics(points) {
      const lengths = [];
      let total = 0;
      for (let index = 1; index < points.length; index += 1) {
        const length = Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
        lengths.push(length);
        total += length;
      }
      return { lengths, total };
    }

    function trace(route, amount, alpha, lineWidth) {
      const { points, measure } = route;
      let remaining = measure.total * clamp(amount);
      if (remaining <= 0) return;
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      for (let index = 1; index < points.length && remaining > 0; index += 1) {
        const segment = measure.lengths[index - 1];
        const portion = Math.min(1, remaining / Math.max(1, segment));
        context.lineTo(
          points[index - 1][0] + (points[index][0] - points[index - 1][0]) * portion,
          points[index - 1][1] + (points[index][1] - points[index - 1][1]) * portion
        );
        remaining -= segment;
      }
      context.globalAlpha = alpha;
      context.lineWidth = lineWidth;
      context.lineCap = 'square';
      context.lineJoin = 'miter';
      context.stroke();
    }

    function pointAt(route, amount) {
      const { points, measure } = route;
      let remaining = measure.total * clamp(amount);
      for (let index = 1; index < points.length; index += 1) {
        const segment = measure.lengths[index - 1];
        if (remaining <= segment) {
          const portion = remaining / Math.max(1, segment);
          return [
            points[index - 1][0] + (points[index][0] - points[index - 1][0]) * portion,
            points[index - 1][1] + (points[index][1] - points[index - 1][1]) * portion
          ];
        }
        remaining -= segment;
      }
      return points[points.length - 1];
    }

    function node(point, alpha, size) {
      context.globalAlpha = alpha;
      context.fillRect(point[0] - size / 2, point[1] - size / 2, size, size);
    }

    function draw(now, staticState) {
      const active = frame?.dataset.active === 'true' && frame.getAttribute('aria-hidden') !== 'true';
      if (!active && !staticState) {
        if (wasActive) context.clearRect(0, 0, width, height);
        wasActive = false;
        return;
      }
      if (!staticState && !wasActive) activeSince = now;
      if (!staticState) wasActive = true;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = color;
      context.fillStyle = color;

      const cycle = staticState ? .68 : ((now - activeSince) % CYCLE) / CYCLE;
      const reveal = staticState ? 1 : ease(clamp(cycle / .42));
      routeData.forEach((route, index) => {
        const { points } = route;
        trace(route, 1, kind === 'orrery' ? .30 : .34, 1);
        const routeReveal = ease(clamp(reveal * 1.32 - index * .12));
        trace(route, routeReveal, kind === 'orrery' ? .90 : .86, 1.55);

        if (routeReveal > .92) {
          node(points[points.length - 1], kind === 'orrery' ? .88 : .84, kind === 'orrery' ? 6 : 5.5);
        }

        if (cycle > .38) {
          const travel = ((cycle - .38) / .62 + index * .17) % 1;
          node(pointAt(route, travel), .96, kind === 'orrery' ? 7 : 6.5);
        }
      });
      context.globalAlpha = 1;
    }

    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    resize();

    if (window.EphemerentMotion) {
      window.EphemerentMotion.register(scene, (now) => draw(now, false));
    } else {
      draw(performance.now(), true);
    }
  }

  window.mountBranchField = mountBranchField;
  document.querySelectorAll('[data-branch-field]').forEach(mountBranchField);
})();
