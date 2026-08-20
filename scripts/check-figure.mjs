#!/usr/bin/env node
/**
 * Contrast inside illustrations.
 *
 * check-contrast skips anything inside a <figure>, and correctly:
 * text over a photograph cannot be judged against a flat backdrop.
 * But an SVG diagram is not a photograph. It has a solid plate and
 * solid type on it, and both are perfectly measurable.
 *
 * That gap shipped a real defect. The news illustration draws its
 * ground from --nw-ink while every colour inside it is a hardcoded
 * light hex, so on the dark face the plate turned pale and the labels
 * vanished into it -- on the default look, with every gate green.
 *
 * This measures SVG text against the plate actually painted behind it.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const LOOKS = (process.env.LOOKS ?? 'light,dark,glass').split(',');
const PAGES = (process.env.PAGES ?? [
  '/', '/research', '/orrery', '/vellum', '/vespera', '/shelterix',
  '/arbiter', '/news', '/news/drfsp-robust-compression', '/journal',
  '/genesis-fall', '/download', '/organizations',
].join(',')).split(',');

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const browser = await chromium.launch();
const failures = [];
let sampled = 0;

for (const look of LOOKS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((l) => {
    try {
      localStorage.setItem('eph-mode', l === 'glass' ? 'dark' : l);
      localStorage.setItem('eph-material', l === 'glass' ? 'glass' : 'flat');
    } catch (e) {}
  }, look);
  const page = await ctx.newPage();

  for (const path of PAGES) {
    const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
    if (!res || res.status() >= 400) continue;
    await page.evaluate(() => document.querySelectorAll('.rv, .reveal').forEach((e) => e.classList.add('in')));
    await page.waitForTimeout(look === 'glass' ? 420 : 200);

    const found = await page.evaluate(() => {
      const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const rgb = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c;
        cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3]]; };
      const out = [];
      for (const svg of document.querySelectorAll('svg')) {
        const sr = svg.getBoundingClientRect();
        if (sr.width < 80 || sr.height < 60) continue;
        const texts = svg.querySelectorAll('text');
        if (!texts.length) continue;
        /* The plate is the svg's own background, or the largest filled
           rect covering most of it -- which is how this one is drawn. */
        let plate = rgb(getComputedStyle(svg).backgroundColor);
        if (plate[3] < 200) {
          let best = null, bestA = 0;
          for (const r of svg.querySelectorAll('rect')) {
            const b = r.getBoundingClientRect();
            const a = b.width * b.height;
            if (a < sr.width * sr.height * 0.5) continue;
            const f = rgb(getComputedStyle(r).fill);
            if (f[3] > 200 && a > bestA) { bestA = a; best = f; }
          }
          if (best) plate = best;
        }
        if (plate[3] < 200) continue;           // no solid ground to judge against
        const seen = new Set();
        for (const t of texts) {
          const s = (t.textContent || '').trim();
          if (s.length < 2) continue;
          const cs = getComputedStyle(t);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.6) continue;
          const tb = t.getBoundingClientRect();
          if (tb.width < 4 || tb.height < 4) continue;
          const fill = rgb(cs.fill);
          if (fill[3] < 40) continue;
          const size = parseFloat(cs.fontSize) || 11;
          const key = cs.fill + '|' + size;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ fill: fill.slice(0, 3), plate: plate.slice(0, 3), size,
            sample: s.slice(0, 26),
            svg: svg.getAttribute('class') || svg.parentElement?.className || 'svg' });
        }
      }
      return out;
    });

    for (const f of found) {
      sampled++;
      const r = ratio(f.fill, f.plate);
      /* SVG labels are small and decorative-adjacent; hold them to AA
         for normal text, relaxing only for genuinely large type. */
      const min = f.size >= 24 ? 3 : 4.5;
      if (process.env.VERBOSE) {
        console.log(`    ${r.toFixed(2)}:1  ${String(f.svg).slice(0,20).padEnd(21)} @${f.size}px ` +
          `fill=rgb(${f.fill}) plate=rgb(${f.plate})  "${f.sample}"`);
      }
      if (r < min) {
        failures.push(`${look.padEnd(5)} ${path.padEnd(30)} ${r.toFixed(2)}:1 (needs ${min}) ` +
          `${String(f.svg).slice(0, 22).padEnd(23)} @${f.size}px  "${f.sample}"`);
      }
    }
  }
  await ctx.close();
}
await browser.close();

console.log(`check-figure: ${sampled} SVG text samples across ${PAGES.length} pages x ${LOOKS.length} looks`);
if (failures.length) {
  console.error(`\n${failures.length} below AA against their own plate:\n`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('all illustration text reads against its plate');
