#!/usr/bin/env node
/**
 * Plate fetches on the default path.
 *
 * The hero plates have a light and a dark twin, and whichever sits in
 * the markup is the one the preload scanner fetches. If that is the
 * wrong one, the LCP image is downloaded twice: once by the scanner,
 * once by mode.js swapping it. The comment in mode.js claims the
 * markup now carries the dark plate because dark is the default. This
 * counts the requests and settles it.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGE = process.env.PAGE ?? '/';

const browser = await chromium.launch();
const rows = [];

for (const look of ['default (no storage)', 'chose light']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (look === 'chose light') {
    await ctx.addInitScript(() => { try { localStorage.setItem('eph-mode', 'light'); } catch (e) {} });
  }
  const page = await ctx.newPage();
  const plates = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/ephemerent-[a-z]+(-dark)?-\d+\.(avif|webp|png|jpg)/.test(u)) {
      plates.push({ url: u.split('/').pop(), dark: u.includes('-dark-') });
    }
  });
  await page.goto(BASE + PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(1400);        // let any swap settle and fetch
  await ctx.close();

  const dark = plates.filter((p) => p.dark).length;
  const light = plates.length - dark;
  /* Compare the image FAMILY, not the filename. Comparing filenames
     missed the one that mattered: the hero came down as
     ephemerent-network-1600.avif and ephemerent-network-dark-900.avif,
     which are the same photograph at two widths, so a filename-level
     check called them unrelated and reported the default path clean
     while the LCP image was being fetched twice. */
  const family = (n) => n.replace('-dark-', '-').replace(/-\d+\.[a-z]+$/, '');
  const dupes = [...new Set(plates.map((p) => family(p.url)))]
    .filter((f) => plates.some((p) => p.dark && family(p.url) === f) &&
                   plates.some((p) => !p.dark && family(p.url) === f));
  rows.push({ look, total: plates.length, dark, light, dupes,
    names: plates.map((p) => p.url) });
}
await browser.close();

console.log(`check-plates: ${PAGE}\n`);
let bad = 0;
for (const r of rows) {
  /* Only the default path is a failure. The reader who chooses light
     is opting off the preloaded plate, and one extra fetch is the
     deliberate cost of putting the majority's plate in the markup --
     it is the trade that used to run the other way. */
  const isDefault = r.look.startsWith('default');
  const flag = r.dupes.length
    ? `  <-- ${r.dupes.length} fetched in BOTH tones${isDefault ? '' : ' (accepted: opt-in path)'}`
    : '';
  if (r.dupes.length && isDefault) bad++;
  console.log(`  ${r.look.padEnd(22)} ${String(r.total).padStart(2)} plate requests  (${r.dark} dark, ${r.light} light)${flag}`);
  for (const d of r.dupes) console.log(`        ${d}`);
  if (process.env.VERBOSE) for (const n of r.names) console.log(`        · ${n}`);
}
process.exit(bad ? 1 : 0);
