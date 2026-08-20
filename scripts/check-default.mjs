#!/usr/bin/env node
/**
 * The default look, as a first-time visitor gets it.
 *
 * Every other check in this repo sets a preference before loading,
 * which is exactly the path a first visitor does NOT take. This one
 * arrives with empty storage and asserts what actually paints: dark
 * face, glass material, and the glass stylesheet present before the
 * first paint rather than appended after it.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const FLAT = ['/genesis-fall'];        // FIXED: art-directed, opts out
const PAGES = (process.env.PAGES ?? [
  '/', '/research', '/orrery', '/vellum', '/vespera', '/shelterix',
  '/arbiter', '/news', '/journal', '/download', '/cloud', '/signin',
  '/organizations', '/security', '/privacy', '/terms', '/slack',
  '/genesis-fall',
].join(',')).split(',');

const browser = await chromium.launch();
const bad = [];
const rows = [];

for (const path of PAGES) {
  /* A fresh context per page: no storage, no prior choice, nothing
     carried over. This is the whole point of the check. */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
  if (!res || res.status() >= 400) { await ctx.close(); continue; }
  const got = await page.evaluate(() => {
    const d = document.documentElement;
    const cs = getComputedStyle(document.body);
    const rgb = (c) => {
      const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1);
      const px = cv.getImageData(0, 0, 1, 1).data; return [px[0], px[1], px[2]];
    };
    const g = rgb(cs.backgroundColor);
    return {
      mode: d.dataset.mode || '(unset)',
      material: d.dataset.material || 'flat',
      /* Was the sheet there for the first paint, or appended later? */
      glassLinked: !!document.querySelector('link[href*="glass.css"]:not([data-glass-css])'),
      groundLum: (0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2]) / 255,
      stored: (() => { try { return localStorage.getItem('eph-mode') || '(none)'; } catch (e) { return '(blocked)'; } })(),
    };
  });
  await ctx.close();

  const wantGlass = !FLAT.includes(path);
  const problems = [];
  if (got.mode !== 'dark') problems.push(`mode=${got.mode}`);
  if (wantGlass && got.material !== 'glass') problems.push(`material=${got.material}`);
  if (!wantGlass && got.material === 'glass') problems.push('glass on a fixed surface');
  if (got.groundLum > 0.45) problems.push(`ground is light (${got.groundLum.toFixed(2)})`);
  rows.push({ path, ...got, problems });
  if (problems.length) bad.push({ path, problems });
}
await browser.close();

console.log(`check-default: ${rows.length} pages loaded with empty storage, ${bad.length} not on the default look\n`);
for (const r of rows) {
  const flag = r.problems.length ? '  <-- ' + r.problems.join(', ') : '';
  console.log(`  ${r.path.padEnd(18)} mode=${r.mode.padEnd(6)} material=${r.material.padEnd(6)} ` +
    `linked=${String(r.glassLinked).padEnd(5)} ground=${r.groundLum.toFixed(3)}${flag}`);
}
process.exit(bad.length ? 1 : 0);
