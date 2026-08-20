#!/usr/bin/env node
/**
 * Keyboard focus visibility.
 *
 * The sibling of check-affordance, and the one that actually matters
 * for people who cannot use a pointer. A control with no visible focus
 * state is invisible to keyboard navigation, and like a missing hover
 * it never shows up in a screenshot -- nothing is focused in a
 * screenshot.
 *
 * Forces :focus-visible through the protocol rather than tabbing,
 * because tab order skips anything scrolled out of view and the check
 * would then report the skipped controls as unstyled. It also measures
 * the ring against what sits behind it: an outline drawn in the colour
 * of its own ground changes the computed style and nothing else.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGES = (process.env.PAGES ?? [
  '/', '/research', '/orrery', '/vellum', '/vespera', '/shelterix',
  '/arbiter', '/news', '/journal', '/journal/submit', '/download',
  '/organizations', '/security', '/privacy', '/terms', '/signin', '/cloud',
].join(',')).split(',');

/* Deliberately no outlineOffset, and the outline triplet is collapsed
   in the fingerprint below rather than read raw.

   An offset on an outline that is not drawn paints exactly nothing,
   and the first version of this check counted it: with the ring
   suppressed entirely, outline-offset still moved 0px -> 3px, so every
   nav link came back "has a focus state" while showing the reader
   nothing at all. A fingerprint has to record what paints, not what
   the computed-style table happens to hold. */
const WATCH = ['boxShadow', 'backgroundColor', 'color', 'borderTopColor',
  'borderBottomColor', 'textDecorationColor', 'textDecorationLine',
  'transform', 'filter'];

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');

const invisible = [];
const faint = [];
let checked = 0;

for (const path of PAGES) {
  const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
  if (!res || res.status() >= 400) continue;
  await page.evaluate(() => {
    document.querySelectorAll('.rv, .reveal').forEach((el) => el.classList.add('in'));
  });
  await page.waitForTimeout(220);

  const picks = await page.evaluate(() => {
    const seen = new Set();
    const out = [];
    let n = 0;
    const sel = 'a[href], button, summary, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (r.width < 6 || r.height < 6) continue;
      const cls = typeof el.className === 'string'
        ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      const sig = el.tagName + '|' + cls + '|' + (el.closest('nav,header,footer,main')?.tagName ?? '');
      if (seen.has(sig)) continue;
      seen.add(sig);
      el.setAttribute('data-foc', String(n));
      out.push({ id: n++, sig, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26) });
      if (n >= 26) break;
    }
    return out;
  });

  const { root } = await cdp.send('DOM.getDocument');

  for (const pick of picks) {
    const sel = `[data-foc="${pick.id}"]`;

    const FP = ([s, w]) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const alphaOf = (c) => {
        cv.clearRect(0, 0, 1, 1);
        cv.fillStyle = c;
        cv.fillRect(0, 0, 1, 1);
        return cv.getImageData(0, 0, 1, 1).data[3] / 255;
      };
      /* An outline only exists if it is drawn: a style other than none,
         a width of at least a pixel, and a colour you can see through
         less than completely. Otherwise it contributes nothing to the
         fingerprint, offset included. */
      const outline = (style) => {
        const drawn = style.outlineStyle !== 'none' &&
          (parseFloat(style.outlineWidth) || 0) >= 1 &&
          alphaOf(style.outlineColor) > 0.15;
        return drawn
          ? `${style.outlineStyle}:${style.outlineWidth}:${style.outlineColor}:${style.outlineOffset}`
          : 'none';
      };
      const cs = getComputedStyle(el);
      let k = outline(cs) + '/';
      for (const p of w) k += cs[p] + '/';
      for (const pseudo of ['::before', '::after']) {
        const pc = getComputedStyle(el, pseudo);
        k += outline(pc) + pc.boxShadow + pc.transform + pc.opacity + pc.backgroundColor + '/';
      }
      return k;
    };

    /* content-visibility: auto skips off-screen subtrees, so a forced
       state there recomputes nothing -- the same trap the hover audit
       hit, where every button outside the header came back dead. */
    await page.evaluate((s) => document.querySelector(s)
      ?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
    await page.waitForTimeout(50);

    const before = await page.evaluate(FP, [sel, WATCH]);
    if (!before) continue;

    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel })
      .catch(() => ({ nodeId: 0 }));
    if (!nodeId) continue;

    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus', 'focus-visible'] });
    await page.waitForTimeout(120);
    const after = await page.evaluate(FP, [sel, WATCH]);
    const ring = await page.evaluate(([s]) => {
      const el = document.querySelector(s);
      const cs = getComputedStyle(el);
      const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const rgb = (c) => {
        cv.clearRect(0, 0, 1, 1);
        cv.fillStyle = '#000';
        cv.fillStyle = c;
        cv.fillRect(0, 0, 1, 1);
        const d = cv.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3]];
      };
      let n = el.parentElement;
      let ground = null;
      while (n && !ground) {
        const c = rgb(getComputedStyle(n).backgroundColor);
        if (c[3] > 200) ground = c.slice(0, 3);
        n = n.parentElement;
      }
      return {
        color: rgb(cs.outlineColor).slice(0, 3),
        style: cs.outlineStyle,
        width: parseFloat(cs.outlineWidth) || 0,
        shadow: cs.boxShadow,
        ground: ground || [10, 10, 10],
      };
    }, [sel]);
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    if (!after) continue;
    checked++;

    if (before === after) {
      invisible.push({ path, sig: pick.sig, text: pick.text });
      continue;
    }
    /* Something moved -- but is it visible? An outline the same colour
       as the thing behind it satisfies a computed-style diff and shows
       the reader nothing. */
    if (ring.style !== 'none' && ring.width >= 1 && ring.shadow === 'none') {
      const r = ratio(ring.color, ring.ground);
      if (r < 3) {
        faint.push({
          path, sig: pick.sig, text: pick.text, r,
          detail: `outline rgb(${ring.color}) on rgb(${ring.ground})`,
        });
      }
    }
  }
}
await browser.close();

const group = (list) => {
  const m = new Map();
  for (const d of list) {
    const g = m.get(d.sig) ?? { ...d, paths: [] };
    g.paths.push(d.path);
    m.set(d.sig, g);
  }
  return [...m.values()].sort((a, b) => b.paths.length - a.paths.length);
};

console.log(`check-focus: ${checked} distinct controls focused, ` +
  `${invisible.length} with no focus state, ${faint.length} with a ring under 3:1\n`);
for (const g of group(invisible)) {
  const [tag, cls] = g.sig.split('|');
  console.log(`  NO STATE  ${(tag.toLowerCase() + (cls ? '.' + cls : '')).padEnd(30)} x${g.paths.length}  "${g.text}"`);
  console.log(`            ${[...new Set(g.paths)].join(' ')}`);
}
for (const g of group(faint)) {
  const [tag, cls] = g.sig.split('|');
  console.log(`  FAINT     ${(tag.toLowerCase() + (cls ? '.' + cls : '')).padEnd(30)} ${g.r.toFixed(2)}:1  ${g.detail}`);
  console.log(`            ${[...new Set(g.paths)].join(' ')}`);
}
process.exit(invisible.length ? 1 : 0);
