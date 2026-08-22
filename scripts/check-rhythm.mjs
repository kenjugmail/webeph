#!/usr/bin/env node
/**
 * Vertical rhythm audit.
 *
 * Nothing on a page looks wrong because one section has 84px of air
 * above it and the next has 91px. The page just feels unresolved, and
 * the reason is unnameable from a screenshot -- which is exactly the
 * kind of defect that survives every review.
 *
 * This measures the real painted gap between consecutive top-level
 * sections, and the padding-block of every section, then reports how
 * many distinct values a page uses and which fall off the space scale.
 * A page using nine different section rhythms does not have a rhythm.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGES = (process.env.PAGES ?? [
  '/', '/research', '/orrery', '/vellum', '/vespera', '/shelterix',
  '/arbiter', '/news', '/journal', '/download', '/organizations',
  '/security', '/privacy', '/terms',
].join(',')).split(',');
/* Scale adherence turned out to be the wrong question. The home page
   computes 115px for its section rhythm and that is correct -- it is
   clamp(92px, 9vw, 138px), a fluid rhythm resolving at this viewport,
   and no fixed scale can contain it.

   What the eye actually catches is inconsistency WITHIN one page: the
   reader never sees two pages at once, but they do see section three
   sitting closer to section two than section four does. So report the
   spread of distinct rhythms per page, and treat values within a few
   px of each other as one rhythm rather than as evidence. */
const CLUSTER = 6;   // px; below this two rhythms read as the same one

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const rows = [];

for (const path of PAGES) {
  const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
  if (!res || res.status() >= 400) continue;
  await page.evaluate(() => document.querySelectorAll('.rv, .reveal').forEach((e) => e.classList.add('in')));
  await page.waitForTimeout(220);

  const data = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const secs = [...main.children].filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && r.height > 40;
    });
    const pads = [], gaps = [];
    for (let i = 0; i < secs.length; i++) {
      const cs = getComputedStyle(secs[i]);
      const pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
      if (pt > 12) pads.push(Math.round(pt));
      if (pb > 12) pads.push(Math.round(pb));
      if (i) {
        /* The painted gap is what the eye sees: previous bottom edge to
           this top edge, which margin collapsing already resolved. */
        const g = Math.round(secs[i].getBoundingClientRect().top -
                             secs[i - 1].getBoundingClientRect().bottom);
        if (g > 0) gaps.push(g);
      }
    }
    return { pads, gaps, n: secs.length };
  });

  const all = [...data.pads, ...data.gaps];
  if (!all.length) continue;
  /* Cluster near-identical values: 84 and 86 are one rhythm, not two. */
  const sorted = [...all].sort((a, b) => a - b);
  const groups = [];
  for (const v of sorted) {
    const g = groups[groups.length - 1];
    if (g && v - g.max <= CLUSTER) { g.max = v; g.count++; }
    else groups.push({ min: v, max: v, count: 1 });
  }
  rows.push({ path, n: data.n, groups });
}
await browser.close();

/* Counting distinct rhythms was still the wrong question. Orrery uses
   four, and it is fine: 130 twenty times, with a taller hero and two
   deliberately small sections. A page has a rhythm when one value
   carries the majority of its gaps; it lacks one when no value does,
   which is what a reader perceives as the page not settling. */
for (const r of rows) {
  const top = r.groups.reduce((a, b) => (b.count > a.count ? b : a));
  const total = r.groups.reduce((s, g) => s + g.count, 0);
  r.dominance = total ? top.count / total : 1;
  r.top = top;
  r.total = total;
}
rows.sort((a, b) => a.dominance - b.dominance);
const weak = rows.filter((r) => r.dominance < 0.5 && r.total >= 4);
console.log(`check-rhythm: ${rows.length} pages, ${weak.length} without a dominant vertical rhythm\n`);
for (const r of rows) {
  const show = r.groups.map((g) => (g.min === g.max ? `${g.min}` : `${g.min}-${g.max}`) + `x${g.count}`);
  const pct = Math.round(r.dominance * 100);
  const flag = weak.includes(r) ? '  <-- no dominant rhythm' : '';
  console.log(`  ${String(pct).padStart(3)}%  ${r.path.padEnd(18)} ${show.join('  ')}${flag}`);
}
