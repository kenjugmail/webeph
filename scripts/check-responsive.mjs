#!/usr/bin/env node
/**
 * Horizontal-overflow and tap-target audit at phone and tablet widths.
 *
 * A page that scrolls sideways on a phone is broken in a way no
 * desktop check notices, and the usual cause is one long word in
 * display type set at a fixed size rather than a layout fault.
 *
 *   node scripts/check-responsive.mjs
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGES = ['/','/research','/orrery','/vellum','/vespera','/shelterix','/genesis-fall','/arbiter','/news','/news/drfsp-robust-compression','/journal','/journal/submit','/journal/policies','/journal/editor','/journal/article/x','/signin','/cloud','/vellum/connect','/download','/organizations','/security','/slack','/privacy','/terms','/404.html'];
const browser = await chromium.launch();
const failures = [];
for (const width of [375, 768]) {
  const ctx = await browser.newContext({ viewport: { width, height: 812 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  console.log(`\n=== ${width}px`);
  for (const p of PAGES) {
    const r = await page.goto(BASE + p, { waitUntil: 'load' }).catch(() => null);
    if (!r || r.status() >= 400) { console.log(`  ?? ${p}`); continue; }
    await page.waitForTimeout(120);
    const res = await page.evaluate((w) => {
      const de = document.documentElement;
      const over = de.scrollWidth > w + 1;
      const culprits = [];
      if (over) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > w + 1 && getComputedStyle(el).position !== 'fixed') {
            culprits.push(`${el.tagName.toLowerCase()}.${(typeof el.className==='string'?el.className:'').split(' ').slice(0,2).join('.')} right=${Math.round(r.right)}`);
            if (culprits.length >= 3) break;
          }
        }
      }
      // tap targets below the 24px minimum
      let small = 0;
      for (const el of document.querySelectorAll('a,button,[role=button],input,select')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24)) small++;
      }
      return { scrollWidth: de.scrollWidth, over, culprits, small };
    }, width);
    const flag = res.over ? `OVERFLOW ${res.scrollWidth}px` : 'ok      ';
    console.log(`  ${flag} ${p.padEnd(32)} smallTargets=${res.small}${res.culprits.length ? '\n        ' + res.culprits.join('\n        ') : ''}`);
    if (res.over) failures.push(`${width}px ${p} is ${res.scrollWidth}px wide`);
  }
  await ctx.close();
}
await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} responsive overflow failure(s):`);
  failures.forEach((failure) => console.error(`  ${failure}`));
  process.exit(1);
}
