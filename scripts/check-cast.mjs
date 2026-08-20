#!/usr/bin/env node
/**
 * Colour cast in the page ground.
 *
 * The glass material lays a wide accent wash behind everything so the
 * panels have something to refract. As an opt-in third look that was a
 * choice a reader made; as the default it is the first thing everyone
 * sees, and a wash tuned to be visible can read as a tint over the
 * whole page rather than as light in the room.
 *
 * This screenshots each page, samples the ground away from content, and
 * reports how far it drifts from neutral in LAB chroma and how much it
 * varies across the frame.
 */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGES = (process.env.PAGES ?? '/,/research,/orrery,/vellum,/shelterix,/news,/journal,/privacy').split(',');
const CAP = Number(process.env.CAP ?? 22);      // max acceptable mean chroma

/* sRGB -> LAB, enough of it to get chroma. */
function chroma([r, g, b]) {
  const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)];
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const k = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [k(x), k(y), k(z)];
  const A = 500 * (x - y), B2 = 200 * (y - z);
  return Math.sqrt(A * A + B2 * B2);
}

const browser = await chromium.launch();
const rows = [];
for (const path of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
  if (!res || res.status() >= 400) { await ctx.close(); continue; }
  await page.waitForTimeout(900);
  const buf = await page.screenshot();
  await ctx.close();

  const png = PNG.sync.read(buf);
  const at = (x, y) => {
    const i = (png.width * y + x) << 2;
    return [png.data[i], png.data[i + 1], png.data[i + 2]];
  };
  /* Sample a grid, keep only near-ground pixels: dark, and matching
     their neighbours, so type and imagery drop out. */
  const samples = [];
  for (let y = 90; y < png.height - 20; y += 17) {
    for (let x = 10; x < png.width - 10; x += 19) {
      const p = at(x, y), q = at(x + 4, y), r = at(x, y + 4);
      const flat = Math.abs(p[0] - q[0]) + Math.abs(p[0] - r[0]) +
                   Math.abs(p[1] - q[1]) + Math.abs(p[1] - r[1]) < 6;
      const lum = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
      if (flat && lum < 120) samples.push({ p, c: chroma(p), x });
    }
  }
  if (samples.length < 40) { rows.push({ path, note: 'too little ground' }); continue; }
  const cs = samples.map((s) => s.c).sort((a, b) => a - b);
  const mean = cs.reduce((a, b) => a + b, 0) / cs.length;
  rows.push({ path, n: cs.length, mean, p95: cs[Math.floor(cs.length * 0.95)] });
}
await browser.close();

rows.sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));
const over = rows.filter((r) => r.mean > CAP);
console.log(`check-cast: ${rows.length} pages, ${over.length} whose ground carries more than ${CAP} chroma\n`);
for (const r of rows) {
  if (r.note) { console.log(`  ${r.path.padEnd(14)} ${r.note}`); continue; }
  const bar = '#'.repeat(Math.min(30, Math.round(r.mean))).padEnd(30, '.');
  console.log(`  ${r.path.padEnd(14)} ${bar} mean ${r.mean.toFixed(1)}  p95 ${r.p95.toFixed(1)}  (${r.n} ground px)${r.mean > CAP ? '  <-- tinted' : ''}`);
}
