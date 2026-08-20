#!/usr/bin/env node
/**
 * Hover and focus affordance audit.
 *
 * A link that does not answer the pointer feels dead, and it is the
 * kind of dead that never shows up in a screenshot -- every review of
 * a still image passes it. This hovers each distinct interactive
 * element and diffs the computed style before and after, then checks
 * that the same element takes a visible focus ring for the keyboard.
 *
 * Elements are sampled one per selector signature, because a nav with
 * eight links styled by one rule is one affordance, not eight.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGES = (process.env.PAGES ?? [
  '/', '/research', '/orrery', '/vellum', '/vespera', '/shelterix',
  '/arbiter', '/news', '/journal', '/download', '/organizations',
  '/security', '/privacy', '/terms', '/signin', '/cloud',
].join(',')).split(',');

/* The properties a hover can plausibly move. Reading all of them
   avoids assuming the site signals hover one particular way -- some
   surfaces here shift the ground, some the rule, some only the mark. */
const WATCH = ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor',
  'opacity', 'transform', 'boxShadow', 'filter', 'letterSpacing',
  'backgroundImage', 'outlineColor',
  /* The house link idiom animates the underline's colour and offset,
     not whether there is an underline. Watching only
     textDecorationLine reported every link using the site's primary
     affordance as having none. */
  'textDecorationLine', 'textDecorationColor', 'textDecorationThickness',
  'textUnderlineOffset'];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
/* Force :hover through the protocol rather than moving a mouse.
   Driving the pointer looked right and was not: on shelterix and
   orrery the cursor sat dead centre on the link, elementFromPoint
   returned that very link, and :hover still never matched -- so two
   controls whose CSS works perfectly were reported dead. Forcing the
   state tests the stylesheet, which is the actual question. */
const cdp = await context.newCDPSession(page);
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');
const dead = [];
const unreachable = [];
let checked = 0;

for (const path of PAGES) {
  const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
  if (!res || res.status() >= 400) continue;
  await page.evaluate(() => document.querySelectorAll('.rv, .reveal').forEach((e) => e.classList.add('in')));
  await page.waitForTimeout(220);

  /* Tag one representative per signature so the hover loop stays short. */
  const picks = await page.evaluate(() => {
    const seen = new Set(); const out = [];
    const els = document.querySelectorAll('a[href], button, summary, [role="button"], [tabindex]:not([tabindex="-1"])');
    let n = 0;
    for (const el of els) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (r.width < 6 || r.height < 6) continue;
      if (cs.pointerEvents === 'none') continue;
      const sig = el.tagName + '|' + (typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
        + '|' + (el.closest('nav,header,footer,main')?.tagName ?? '');
      if (seen.has(sig)) continue;
      seen.add(sig);
      el.setAttribute('data-aff', String(n));
      out.push({ id: n++, sig, href: el.getAttribute('href') || '',
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) });
      if (n >= 34) break;
    }
    return out;
  });

  /* Re-fetch per page: node ids do not survive a navigation, and a
     stale docId makes every DOM.querySelector return 0 -- which the
     loop below would read as "no response" for the whole page. */
  const { root } = await cdp.send('DOM.getDocument');
  const docId = root.nodeId;
  for (const pick of picks) {
    const sel = `[data-aff="${pick.id}"]`;
    /* Fingerprint the element, its pseudo-elements AND its descendants.
       `a:hover .arrow { transform: translateX(3px) }` is the house
       idiom on this site, and a check that only reads the anchor
       itself would call every one of those links dead. */
    const FP = ([s, w]) => {
      const el = document.querySelector(s); if (!el) return null;
      const one = (n) => {
        const cs = getComputedStyle(n);
        let k = ''; for (const p of w) k += cs[p] + '\u0001';
        for (const pseudo of ['::before', '::after']) {
          const pc = getComputedStyle(n, pseudo);
          k += pc.transform + pc.width + pc.height + pc.opacity +
               pc.backgroundColor + pc.backgroundImage + '\u0001';
        }
        return k;
      };
      let key = one(el);
      const kids = el.querySelectorAll('*');
      for (let i = 0; i < Math.min(kids.length, 12); i++) key += one(kids[i]);
      return key;
    };
    const before = await page.evaluate(FP, [sel, WATCH]);
    if (!before) continue;
    /* Scroll it into view first. tokens.css puts content-visibility:
       auto on the off-screen sections, so their subtrees are skipped
       for style and layout -- forcing :hover on a node inside a
       skipped subtree recomputes nothing and getComputedStyle hands
       back the stale rest values. It reported the .ebtn buttons in
       every section and footer as dead while the identical ones in
       the header moved, which is what gave it away. */
    await page.evaluate((s2) => document.querySelector(s2)
      ?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
    await page.waitForTimeout(60);
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: docId, selector: sel })
      .catch(() => ({ nodeId: 0 }));
    if (!nodeId) { unreachable.push({ path, sig: pick.sig, why: 'no node' }); continue; }
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
    await page.waitForTimeout(160);     // let a transition actually move
    const after = await page.evaluate(FP, [sel, WATCH]);
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    if (!after) continue;
    checked++;
    if (before === after) {
      /* Keep what was measured. Every false positive this check has
         produced looked identical to a true one in the report, and
         each took a separate script to tell apart. */
      const shot = await page.evaluate(([s2, w]) => {
        const el = document.querySelector(s2); const cs = getComputedStyle(el);
        return { color: cs.color, bg: cs.backgroundColor, bc: cs.borderTopColor,
                 td: cs.textDecorationColor, n: document.querySelectorAll(
                   el.tagName + (el.className && typeof el.className === 'string'
                     ? '.' + el.className.trim().split(/\s+/).join('.') : '')).length };
      }, [sel, WATCH]);
      dead.push({ path, sig: pick.sig, text: pick.text, href: pick.href, shot });
    }
  }
}
await browser.close();

/* One dead affordance on eight pages is one rule, not eight defects. */
const bySig = new Map();
for (const d of dead) {
  const g = bySig.get(d.sig) ?? { sig: d.sig, text: d.text, paths: [] };
  g.paths.push(d.path); bySig.set(d.sig, g);
}
const groups = [...bySig.values()].sort((a, b) => b.paths.length - a.paths.length);
/* Guard the instrument. Every failure mode found while building this
   one -- a pointer that never landed, a DOM.getDocument depth that
   returns node ids CSS.forcePseudoState silently ignores -- presents
   identically: everything looks dead. A real site does not have 80%
   dead controls, so if the ratio says otherwise, the check is broken
   and must say so rather than file 130 findings. */
if (checked && dead.length / checked > 0.5) {
  console.error(`check-affordance: ${dead.length} of ${checked} controls reported unresponsive.`);
  console.error('That ratio means the forced-state mechanism is not working, not that the site is dead.');
  process.exit(2);
}
console.log(`check-affordance: ${checked} distinct controls hovered, ${dead.length} with no response (${groups.length} rules)\n`);
if (unreachable.length) {
  console.log(`  (${unreachable.length} not hoverable, excluded: ` +
    `${[...new Set(unreachable.map((u) => u.sig.split('|').slice(0, 2).join('.')))].slice(0, 6).join(', ')})\n`);
}
for (const g of groups) {
  const [tag, cls] = g.sig.split('|');
  console.log(`  ${(tag.toLowerCase() + (cls ? '.' + cls : '')).padEnd(38)} x${String(g.paths.length).padStart(2)}  "${g.text}"`);
  console.log(`      ${[...new Set(g.paths)].join(' ')}`);
}

if (process.env.VERBOSE) {
  console.log('\n--- every unresponsive control');
  for (const d of dead) {
    const [tag, cls] = d.sig.split('|');
    console.log(`  ${d.path.padEnd(16)} ${(tag.toLowerCase() + (cls ? '.' + cls : '')).padEnd(26)} "${d.text}"`);
    console.log(`      color=${d.shot.color} bg=${d.shot.bg} border=${d.shot.bc} (${d.shot.n} on page)`);
  }
}
