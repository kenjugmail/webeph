#!/usr/bin/env node
/**
 * Verify that prefers-reduced-motion actually stops motion.
 *
 * The CSS blocks are easy to write and easy to get wrong -- a rule in a
 * later layer, an inline style, or a JS-driven transform will all survive
 * a @media block. This asks the rendered page instead.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGES = ['/', '/research', '/orrery', '/vellum', '/vespera', '/shelterix', '/journal', '/news'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const problems = [];

for (const p of PAGES) {
  const r = await page.goto(BASE + p, { waitUntil: 'load' }).catch(() => null);
  if (!r || r.status() >= 400) continue;
  await page.waitForTimeout(200);
  const found = await page.evaluate(() => {
    const bad = [];
    let hidden = 0;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      const dur = (s) => s.split(',').map((v) => parseFloat(v) * (v.includes('ms') ? 1 : 1000)).filter((n) => !Number.isNaN(n));
      const moving = [...dur(cs.transitionDuration), ...dur(cs.animationDuration)].some((d) => d > 60);
      if (moving && cs.animationIterationCount !== '0') {
        const name = el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : '');
        if (bad.length < 5) bad.push(`${name} t=${cs.transitionDuration} a=${cs.animationDuration}`);
      }
      /* Content that only becomes visible through an animation must not
         stay hidden when animation is off. */
      if (el.matches('.rv, .reveal') && Number(cs.opacity) < 0.9) hidden++;
    }
    return { bad, hidden };
  });
  if (found.hidden) problems.push(`${p}: ${found.hidden} reveal element(s) still hidden with motion off`);
  if (found.bad.length) problems.push(`${p}: still animating -> ${found.bad.join(' | ')}`);
}
await browser.close();

if (problems.length) {
  console.error(`\ncheck-motion: ${problems.length} problem(s) with prefers-reduced-motion\n`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`check-motion: ${PAGES.length} pages honour prefers-reduced-motion`);
