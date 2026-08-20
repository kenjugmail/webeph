#!/usr/bin/env node
/**
 * Glass material sanity.
 *
 * Glass derives its panel tint from the page's own ground:
 *   --glass-tint: color-mix(in srgb, var(--bg, var(--paper, #fff)) 76%, transparent)
 * On a surface that defines neither --bg nor --paper that falls through
 * to #fff, and the material paints white panels over whatever the page
 * actually is. It is a silent failure of exactly the kind the accent
 * audit found: the rule applies, it just resolves to the wrong thing.
 *
 * This turns glass on, then compares each panel's painted tint against
 * the ground behind it. A panel should sit within reach of its own
 * page, not fight it.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGES = (process.env.PAGES ?? [
  '/', '/research', '/orrery', '/vellum', '/vespera', '/shelterix',
  '/arbiter', '/news', '/news/drfsp-robust-compression', '/journal',
  '/journal/policies', '/download', '/cloud', '/signin', '/organizations',
  '/security', '/privacy', '/terms', '/slack', '/genesis-fall',
].join(',')).split(',');

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => {
  try { localStorage.setItem('eph-mode', 'dark'); localStorage.setItem('eph-material', 'glass'); } catch (e) {}
});
const page = await ctx.newPage();
const rows = [];

for (const path of PAGES) {
  const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
  if (!res || res.status() >= 400) continue;
  await page.waitForTimeout(450);        // glass.css is appended, then applies
  const got = await page.evaluate(() => {
    const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgb = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c;
      cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
    const cs = getComputedStyle(document.body);
    const tint = cs.getPropertyValue('--glass-tint').trim();
    const ground = cs.backgroundColor;
    return { on: document.documentElement.dataset.material === 'glass',
      tint, tintRgb: tint ? rgb(tint) : null, groundRgb: rgb(ground),
      ground: cs.getPropertyValue('--glass-ground').trim(),
      hasBg: !!cs.getPropertyValue('--bg').trim(),
      hasPaper: !!cs.getPropertyValue('--paper').trim(),
      hasNw: !!cs.getPropertyValue('--nw-paper').trim(),
      hasJr: !!cs.getPropertyValue('--jr-paper').trim() };
  });
  if (!got.on) { rows.push({ path, note: 'glass not applied' }); continue; }
  if (!got.tintRgb) { rows.push({ path, note: 'no --glass-tint' }); continue; }
  const dl = Math.abs(lum(got.tintRgb) - lum(got.groundRgb));
  /* Name the slot the material actually resolved through, not the two
     it used to guess at -- news and journal route via --nw-/--jr- now
     and reporting them as "fell through" would be a lie. */
  const src = got.hasBg ? '--bg' : got.hasPaper ? '--paper'
    : got.hasNw ? '--nw-paper' : got.hasJr ? '--jr-paper'
    : 'FELL THROUGH TO #fff';
  rows.push({ path, dl, tint: got.tintRgb, ground: got.groundRgb, src });
}
await browser.close();

rows.sort((a, b) => (b.dl ?? 9) - (a.dl ?? 9));
const broken = rows.filter((r) => r.src === 'FELL THROUGH TO #fff' || (r.dl ?? 0) > 0.3);
console.log(`check-glass: ${rows.length} pages, ${broken.length} where the material does not read its own ground\n`);
for (const r of rows) {
  if (r.note) { console.log(`  ${r.path.padEnd(32)} ${r.note}`); continue; }
  const flag = broken.includes(r) ? '  <-- ' + r.src : '';
  console.log(`  ${r.path.padEnd(32)} luminance gap ${r.dl.toFixed(3)}  tint rgb(${r.tint})  from ${r.src}${flag}`);
}
process.exit(broken.length ? 1 : 0);
