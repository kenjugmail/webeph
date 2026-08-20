/* Research field map.
   The document remains the source of truth; this canvas only traces its declared relations. */
(function () {
  'use strict';

  const graph = document.querySelector('[data-research-graph]');
  if (!graph || graph.dataset.graphMounted === 'true') return;

  const canvas = graph.querySelector('.research-map-canvas');
  const context = canvas?.getContext('2d');
  const rows = Array.from(graph.querySelectorAll('[data-graph-row]'));
  const cue = document.querySelector('[data-research-graph-cue]');
  const cueItems = Array.from(cue?.querySelectorAll('[data-graph-cue]') || []);
  const cueMeter = Array.from(cue?.querySelectorAll('.research-graph-cue-meter i') || []);
  const cueAccents = ['#3158c8', '#cf503d', '#6b4bb5'];
  if (!canvas || !context || !rows.length) return;

  const compact = window.matchMedia('(max-width: 820px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const relationSchema = [
    { from: 'directions', to: 'frontier', name: 'BELONGS_TO' },
    { from: 'frontier', to: 'products', name: 'EXPRESSED_IN' },
    { from: 'frontier', to: 'artifacts', name: 'TARGETS_RECORD' }
  ];

  let width = 0;
  let height = 0;
  let scale = 1;
  let edges = [];
  let activeRow = -1;
  let interactionRow = -1;
  let chapterStarted = performance.now();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function point(element, side, rootRect) {
    const rect = element.getBoundingClientRect();
    return {
      x: (side === 'left' ? rect.left : rect.right) - rootRect.left,
      y: rect.top - rootRect.top + rect.height / 2
    };
  }

  function nodesFor(group, relationSide) {
    if (!group) return [];
    if (group.matches('[data-graph-node]')) return [group];
    const nodes = Array.from(group.querySelectorAll('[data-graph-node]'));
    if (relationSide === 'from' && group.dataset.graphGroup === 'frontier') return [group];
    return nodes.length ? nodes : [group];
  }

  function rebuild() {
    if (compact.matches) {
      edges = [];
      return;
    }

    const rootRect = graph.getBoundingClientRect();
    width = Math.max(1, Math.round(rootRect.width));
    height = Math.max(1, Math.round(rootRect.height));
    const requestedScale = Math.min(window.devicePixelRatio || 1, 1.5);
    scale = Math.max(.5, Math.min(requestedScale, 4096 / width, 4096 / height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);

    edges = [];
    rows.forEach((row, rowIndex) => {
      const groups = new Map(Array.from(row.querySelectorAll('[data-graph-group]'))
        .map((group) => [group.dataset.graphGroup, group]));
      const accent = getComputedStyle(row).getPropertyValue('--graph-accent').trim() || '#3356c8';

      relationSchema.forEach((relation, relationIndex) => {
        const fromGroup = groups.get(relation.from);
        const toGroup = groups.get(relation.to);
        const sources = nodesFor(fromGroup, 'from');
        const targets = nodesFor(toGroup, 'to');
        if (!sources.length || !targets.length) return;

        if (relation.from === 'directions') {
          sources.forEach((source, index) => edges.push({
            rowIndex,
            relationIndex,
            sequence: index,
            accent,
            from: point(source, 'right', rootRect),
            to: point(toGroup, 'left', rootRect)
          }));
          return;
        }

        targets.forEach((target, index) => edges.push({
          rowIndex,
          relationIndex,
          sequence: index,
          accent,
          from: point(fromGroup, 'right', rootRect),
          to: point(target, 'left', rootRect)
        }));
      });
    });
  }

  function trace(edge) {
    const distance = Math.max(18, edge.to.x - edge.from.x);
    const control = Math.max(14, distance * .48);
    context.beginPath();
    context.moveTo(edge.from.x, edge.from.y);
    context.bezierCurveTo(
      edge.from.x + control, edge.from.y,
      edge.to.x - control, edge.to.y,
      edge.to.x, edge.to.y
    );
  }

  function positionOn(edge, t) {
    const distance = Math.max(18, edge.to.x - edge.from.x);
    const control = Math.max(14, distance * .48);
    const x1 = edge.from.x + control;
    const x2 = edge.to.x - control;
    const inverse = 1 - t;
    return {
      x: inverse ** 3 * edge.from.x + 3 * inverse ** 2 * t * x1 + 3 * inverse * t ** 2 * x2 + t ** 3 * edge.to.x,
      y: inverse ** 3 * edge.from.y + 3 * inverse ** 2 * t * edge.from.y + 3 * inverse * t ** 2 * edge.to.y + t ** 3 * edge.to.y
    };
  }

  function drawArrow(edge, color, alpha) {
    context.save();
    context.strokeStyle = color;
    context.globalAlpha = alpha;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(edge.to.x - 6, edge.to.y - 3.5);
    context.lineTo(edge.to.x, edge.to.y);
    context.lineTo(edge.to.x - 6, edge.to.y + 3.5);
    context.stroke();
    context.restore();
  }

  function draw(now) {
    if (compact.matches || !width || !height) return;
    context.clearRect(0, 0, width, height);
    context.lineCap = 'round';

    edges.forEach((edge) => {
      trace(edge);
      context.strokeStyle = '#202841';
      context.globalAlpha = edge.rowIndex === activeRow ? .14 : .075;
      context.lineWidth = 1;
      context.setLineDash([2, 5]);
      context.stroke();
      drawArrow(edge, '#202841', edge.rowIndex === activeRow ? .22 : .12);
    });

    const activeEdges = edges.filter((edge) => edge.rowIndex === activeRow);
    const elapsed = reduced.matches ? 2400 : Math.max(0, now - chapterStarted);
    activeEdges.forEach((edge) => {
      const delay = edge.relationIndex * 240 + edge.sequence * 46;
      const reveal = smoothstep((elapsed - delay) / 720);
      if (reveal <= 0) return;
      trace(edge);
      context.strokeStyle = edge.accent;
      context.globalAlpha = .78;
      context.lineWidth = 1.35;
      context.setLineDash([reveal * 1800, 1800]);
      context.stroke();
      context.setLineDash([]);
      drawArrow(edge, edge.accent, .9 * reveal);
    });

    if (!reduced.matches && activeEdges.length && elapsed > 1050) {
      const cycle = elapsed - 1050;
      const travelerIndex = Math.floor(cycle / 1450) % activeEdges.length;
      const travelerProgress = smoothstep((cycle % 1450) / 1450);
      const edge = activeEdges[travelerIndex];
      const location = positionOn(edge, travelerProgress);
      context.fillStyle = edge.accent;
      context.globalAlpha = .92;
      context.fillRect(location.x - 2.25, location.y - 2.25, 4.5, 4.5);
    }

    context.globalAlpha = 1;
    context.setLineDash([]);
  }

  function nearestRow() {
    if (interactionRow >= 0) return interactionRow;
    const focus = window.innerHeight * .52;
    let nearest = 0;
    let distance = Infinity;
    rows.forEach((row, index) => {
      const rect = row.getBoundingClientRect();
      const current = Math.abs(rect.top + rect.height / 2 - focus);
      if (current < distance) {
        distance = current;
        nearest = index;
      }
    });
    return nearest;
  }

  function updateChapter(now) {
    const next = nearestRow();
    if (next !== activeRow) {
      activeRow = next;
      chapterStarted = now;
      rows.forEach((row, index) => row.toggleAttribute('data-graph-active', index === activeRow));
      cueItems.forEach((item, index) => {
        if (index === activeRow) item.setAttribute('data-active', 'true');
        else item.removeAttribute('data-active');
      });
      cueMeter.forEach((item, index) => {
        if (index === activeRow) item.setAttribute('data-active', 'true');
        else item.removeAttribute('data-active');
      });
      if (cue) {
        cue.dataset.graphCueActive = rows[activeRow]?.dataset.graphRow || String(activeRow);
        cue.style.setProperty('--graph-cue-accent', cueAccents[activeRow] || cueAccents[0]);
      }
    }
    draw(now);
  }

  rows.forEach((row, index) => {
    row.addEventListener('pointerenter', () => {
      interactionRow = index;
      window.EphemerentMotion?.schedule();
    });
    row.addEventListener('pointerleave', () => {
      interactionRow = -1;
      window.EphemerentMotion?.schedule();
    });
    row.addEventListener('focusin', () => {
      interactionRow = index;
      window.EphemerentMotion?.schedule();
    });
    row.addEventListener('focusout', (event) => {
      if (!row.contains(event.relatedTarget)) interactionRow = -1;
      window.EphemerentMotion?.schedule();
    });
  });

  function updateResearchIndex() {
    const indexLinks = Array.from(document.querySelectorAll('.research-index a[href^="#"]'));
    const focus = window.innerHeight * .34;
    let current = indexLinks[0];
    indexLinks.forEach((link) => {
      const section = document.querySelector(link.getAttribute('href'));
      if (section && section.getBoundingClientRect().top <= focus) current = link;
    });
    indexLinks.forEach((link) => {
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function resize() {
    rebuild();
    window.EphemerentMotion?.schedule();
  }

  graph.dataset.graphMounted = 'true';
  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(graph);
  compact.addEventListener?.('change', resize);
  document.fonts?.ready.then(resize);
  rebuild();

  if (window.EphemerentMotion) {
    window.EphemerentMotion.register(graph, updateChapter, { rate: 8, continuous: true });
    window.EphemerentMotion.register(document.body, updateResearchIndex, { continuous: false });
  } else {
    let queued = false;
    const update = (now) => {
      queued = false;
      updateChapter(now || performance.now());
      updateResearchIndex();
    };
    const schedule = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
  }
})();
