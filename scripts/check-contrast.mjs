#!/usr/bin/env node
/**
 * Contrast audit across every page in both faces.
 *
 * Adding a counterpart palette per surface doubled the number of
 * colour pairs on the site, and the muted/faint tones are the ones that
 * drift below AA first. This walks real rendered text rather than the
 * token values, so it catches a tone that only fails once it lands on a
 * panel rather than the page ground.
 *
 *   node scripts/check-contrast.mjs            # both modes, all pages
 *   BASE=http://localhost:3111 node scripts/check-contrast.mjs
 *
 * Exits non-zero if any normal-size text falls below WCAG AA (4.5:1),
 * or large text below 3:1.
 */

import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3111';

const PAGES = [
  '/', '/research', '/journal', '/journal/policies', '/news', '/vespera',
  '/orrery', '/vellum', '/shelterix', '/download', '/cloud', '/signin',
  '/organizations', '/privacy', '/terms', '/security', '/slack',
];
const MODES = ['light', 'dark'];

/** WCAG relative luminance. */
function luminance([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const failures = [];
let sampled = 0;

for (const mode of MODES) {
  for (const path of PAGES) {
    const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
    if (!res || res.status() >= 400) continue;

    await page.evaluate((m) => {
      document.documentElement.dataset.mode = m;
      document.querySelectorAll('.rv, .reveal').forEach((el) => el.classList.add('in'));
    }, mode);
    await page.waitForTimeout(120);

    const found = await page.evaluate(() => {
      /* Resolve through a canvas rather than by parsing the string.
         color-mix() computes to `color(srgb 0.80 0.81 0.82)`, whose
         components are 0-1 floats; reading those as 0-255 reports a
         near-black and invents failures that are not there. Painting a
         pixel handles every format the browser itself accepts. */
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const parse = (c) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      const alpha = (c) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        return ctx.getImageData(0, 0, 1, 1).data[3] / 255;
      };
      /** Walk up until an actually-painted background is found. */
      /* Composite the whole chain of translucent layers, not just the
         first one that looks opaque enough. A nav at 92% alpha over a
         pale page is nearly white; treating it as 92% over transparent
         black reports a mid grey and invents failures. */
      const composite = (fg, a, bg) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
      const backdrop = (el) => {
        const layers = [];
        let n = el;
        while (n && n !== document.documentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          const a = alpha(bg);
          if (a > 0.001) {
            const src = n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
            layers.push({ rgb: parse(bg), a, src, raw: bg });
            if (a >= 0.999) break;
          }
          n = n.parentElement;
        }
        /* When nothing in the chain paints opaquely, the canvas the
           browser actually paints on is white. Falling back to a
           transparent html element parses as black and invents
           failures on pages that colour a wrapper rather than body. */
        const canvasOf = (el) => {
          const c = getComputedStyle(el).backgroundColor;
          return alpha(c) > 0.5 ? parse(c) : null;
        };
        let acc = layers.length && layers[layers.length - 1].a >= 0.999
          ? layers.pop().rgb
          : (canvasOf(document.body) ?? canvasOf(document.documentElement) ?? [255, 255, 255]);
        for (let i = layers.length - 1; i >= 0; i--) acc = composite(layers[i].rgb, layers[i].a, acc);
        const top = layers[0];
        return Object.assign(acc, { src: top ? top.src : 'body', raw: top ? top.raw : '' });
      };

      const out = [];
      const seen = new Set();
      for (const el of document.querySelectorAll('p, li, a, h1, h2, h3, h4, span, button, td, th, label, figcaption, small')) {
        const text = (el.textContent ?? '').trim();
        if (!text || el.children.length > 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.6) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        /* Skip links and other clipped affordances are only painted on
           focus, so their resting colours are not a contrast question. */
        if (cs.clip !== 'auto' || cs.clipPath !== 'none') continue;
        if (r.bottom < 0 || r.right < 0) continue;
        /* Text sitting on a photograph cannot be measured against a
           flat backdrop; those need a human eye, not this script. */
        let over = el, onImage = false;
        while (over && over !== document.documentElement) {
          const ocs = getComputedStyle(over);
          if (ocs.backgroundImage && ocs.backgroundImage !== 'none' && !ocs.backgroundImage.startsWith('linear-gradient')) { onImage = true; break; }
          if (over.querySelector && over.tagName === 'FIGURE') { onImage = true; break; }
          over = over.parentElement;
        }
        if (onImage) continue;
        /* Text carrying its own shadow is scrimmed against imagery,
           which is the accepted technique there and not something a
           flat-backdrop ratio can judge. */
        if (cs.textShadow && cs.textShadow !== 'none') continue;

        const size = parseFloat(cs.fontSize);
        const weight = Number(cs.fontWeight) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const key = cs.color + '|' + size + '|' + el.tagName;
        if (seen.has(key)) continue;
        seen.add(key);

        const bg = backdrop(el);
        out.push({
          fg: composite(parse(cs.color), alpha(cs.color), bg), bg, large, size,
          bgSrc: bg.src, bgRaw: bg.raw, fgRaw: cs.color,
          sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''),
          sample: text.slice(0, 28),
        });
      }
      return out;
    });

    for (const f of found) {
      sampled++;
      const r = ratio(f.fg, f.bg);
      const min = f.large ? 3 : 4.5;
      if (r < min) {
        failures.push(
          `${mode.padEnd(5)} ${path.padEnd(22)} ${r.toFixed(2)}:1 (needs ${min}) ` +
          `${f.sel.slice(0, 30)} @${f.size}px on ${String(f.bgSrc).slice(0, 26)} [${String(f.bgRaw).slice(0, 22)}] fg=${String(f.fgRaw).slice(0, 24)}`,
        );
      }
    }
  }
}

await browser.close();

console.log(`check-contrast: ${sampled} text samples across ${PAGES.length} pages x ${MODES.length} modes`);
if (failures.length) {
  console.error(`\n${failures.length} below WCAG AA:\n`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('all sampled text meets WCAG AA');
