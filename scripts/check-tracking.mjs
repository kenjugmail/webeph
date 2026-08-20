#!/usr/bin/env node
/**
 * Optical tracking audit.
 *
 * A face is drawn with sidebearings that suit one optical size. Much
 * smaller and the letters crowd; much larger and they drift apart. The
 * correction is to open the small sizes and tighten the large ones, and
 * this reports where the rendered site runs against that curve.
 *
 * It reads what the browser actually painted, so a value inherited
 * from three stylesheets away is judged the same as a local one.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGES = ['/','/research','/orrery','/vellum','/vespera','/shelterix','/journal','/news','/download','/organizations','/arbiter','/genesis-fall'];

/**
 * Target tracking in em for a size, and the slack allowed.
 *
 * Case matters more than size does at the small end. Capitals have no
 * ascenders or descenders to separate them and were never drawn to sit
 * side by side as words, so uppercase set small wants far more air than
 * the same size in lowercase -- 0.12 to 0.2em is normal for a caps
 * micro-label and is exactly the voice this site uses. A curve that
 * ignores case reports every one of those as an error, which is what
 * the first version of this script did.
 */
function target(px, upper, mono) {
  if (upper) {
    if (px <= 12) return [0.15, 0.09];
    if (px <= 16) return [0.10, 0.07];
    if (px <= 24) return [0.06, 0.06];
    return [0.02, 0.05];
  }
  /* Monospace is drawn on a fixed advance, so it needs less help than a
     proportional face at the same size. */
  const give = mono ? 0.02 : 0;
  if (px <= 10) return [0.03 + give, 0.07];
  if (px <= 12) return [0.015 + give, 0.06];
  if (px <= 13) return [0.005 + give, 0.05];
  if (px <= 16) return [-0.005, 0.03];
  if (px <= 20) return [-0.012, 0.02];
  if (px <= 28) return [-0.022, 0.018];
  if (px <= 44) return [-0.03, 0.022];
  return [-0.04, 0.026];
}

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:900} })).newPage();
const rows = new Map();

for (const path of PAGES) {
  const res = await page.goto(BASE + path, { waitUntil:'load' }).catch(()=>null);
  if (!res || res.status() >= 400) continue;
  await page.evaluate(()=>document.querySelectorAll('.rv,.reveal').forEach(e=>e.classList.add('in')));
  await page.waitForTimeout(200);
  const found = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,a,li,strong,small,button,td,th,label')) {
      const text = (el.textContent||'').trim();
      if (!text || el.children.length) continue;
      /* Tracking is a relationship between letters. On one or two of
         them there is nothing to judge. */
      if (text.replace(/\s/g,'').length < 5) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.visibility==='hidden'||cs.display==='none'||r.width<8||r.height<6) continue;
      const size = parseFloat(cs.fontSize);
      const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing)/size;
      const key = `${el.tagName}|${size}|${ls.toFixed(4)}|${(typeof el.className==='string'?el.className:'').split(' ')[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const upper = cs.textTransform === 'uppercase' || text === text.toUpperCase() && /[A-Z]/.test(text);
      const mono = /mono|courier/i.test(cs.fontFamily);
      out.push({ size, ls, upper, mono,
        sel: el.tagName.toLowerCase()+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):''),
        sample: text.slice(0,26) });
    }
    return out;
  });
  for (const f of found) {
    const [want, slack] = target(f.size, f.upper, f.mono);
    const off = f.ls - want;
    if (Math.abs(off) <= slack) continue;
    const key = `${f.sel}|${f.size}`;
    const prev = rows.get(key);
    if (!prev || Math.abs(off) > Math.abs(prev.off)) {
      rows.set(key, { ...f, want, off, path, dir: off > 0 ? 'loose' : 'tight' });
    }
  }
}
await browser.close();

const list = [...rows.values()].sort((a,b)=>Math.abs(b.off)-Math.abs(a.off));
console.log(`check-tracking: ${list.length} run against the optical curve\n`);
for (const r of list.slice(0, 30)) {
  const kind = (r.upper ? 'caps' : 'mixed') + (r.mono ? '/mono' : '');
  console.log(`  ${r.dir.padEnd(5)} ${String(r.size).padStart(5)}px ${kind.padEnd(10)} is ${r.ls>=0?'+':''}${r.ls.toFixed(3)}em, want ${r.want>=0?'+':''}${r.want.toFixed(3)}em  ${r.sel.slice(0,28).padEnd(28)} ${r.path}`);
  console.log(`        "${r.sample}"`);
}
