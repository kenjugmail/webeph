#!/usr/bin/env node
/**
 * Mode responsiveness audit.
 *
 * A page built from hardcoded hex cannot answer the mode toggle. It
 * does not look broken in a screenshot of its own default -- it looks
 * broken next to the rest of the site, and only once someone flips the
 * switch. news.css alone carries 116 literal colours.
 *
 * For every page this samples the painted colour of a wide spread of
 * real elements in light and in dark, and reports what fraction of
 * them actually moved. A page in the low percentages is not themed;
 * it is painted.
 *
 *   node scripts/check-modes.mjs
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
/* genesis-fall is FIXED in mode.js -- a single art-directed teaser
   with no counterpart palette, so it is supposed to ignore the
   toggle. Every other page must answer it. */
const FIXED = ['/genesis-fall'];
const PAGES = (process.env.PAGES ?? [
  '/', '/research', '/orrery', '/vellum', '/vespera', '/shelterix',
  '/genesis-fall', '/arbiter', '/news', '/news/drfsp-robust-compression',
  '/journal', '/journal/submit', '/journal/policies', '/journal/editor',
  '/signin', '/cloud', '/vellum/connect', '/download', '/organizations',
  '/security', '/slack', '/privacy', '/terms',
].join(',')).split(',');

const SAMPLE = `() => {
  const out = [];
  const els = document.querySelectorAll('body, header, nav, main, section, article, aside, footer, div, p, h1, h2, h3, a, li, span, button');
  let i = 0;
  for (const el of els) {
    if (i++ % 3) continue;                     // every third, enough spread
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    out.push(cs.color + '|' + cs.backgroundColor + '|' + cs.borderTopColor);
    if (out.length > 700) break;
  }
  return out;
}`;

const browser = await chromium.launch();
const read = async (mode, path) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((m) => {
    try { localStorage.setItem('eph-mode', m); localStorage.setItem('eph-material', 'flat'); } catch (e) {}
  }, mode);
  const page = await ctx.newPage();
  const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
  if (!res || res.status() >= 400) { await ctx.close(); return null; }
  await page.evaluate(() => document.querySelectorAll('.rv, .reveal').forEach((e) => e.classList.add('in')));
  await page.waitForTimeout(200);
  const v = await page.evaluate(`(${SAMPLE})()`);
  await ctx.close();
  return v;
};

const rows = [];
for (const path of PAGES) {
  const [light, dark] = [await read('light', path), await read('dark', path)];
  if (!light || !dark) continue;
  const n = Math.min(light.length, dark.length);
  if (!n) continue;
  let moved = 0;
  for (let i = 0; i < n; i++) if (light[i] !== dark[i]) moved++;
  rows.push({ path, pct: Math.round((moved / n) * 100), n });
}
await browser.close();

rows.sort((a, b) => a.pct - b.pct);
console.log(`check-modes: ${rows.length} pages, share of sampled elements that repaint light -> dark\n`);
let unthemed = 0;
for (const r of rows) {
  if (r.pct < 40 && !FIXED.includes(r.path)) unthemed++;
  const bar = '#'.repeat(Math.round(r.pct / 4)).padEnd(25, '.');
  const flag = r.pct < 40 && !FIXED.includes(r.path) ? '  <-- not themed' : '';
  console.log(`  ${String(r.pct).padStart(3)}%  ${bar}  ${r.path}  (${r.n})${flag}`);
}
process.exit(unthemed ? 1 : 0);
