#!/usr/bin/env node
/**
 * Layout defect hunt across every page and every look.
 *
 * The other checks answer questions about colour, motion and width. This
 * one looks for the things that actually make a page look broken: text
 * clipped by its own box, elements sitting on top of each other, a line
 * measure nobody can read, a heading whose last line is one orphaned
 * word, an image stretched off its aspect ratio.
 *
 *   node scripts/check-layout.mjs                 # all pages, all looks
 *   PAGES=/,/orrery node scripts/check-layout.mjs # narrow it
 *
 * Reports rather than fails: several of these are judgement calls, and a
 * check that cries wolf gets ignored. Exit code is 0 unless something is
 * unambiguous (clipped text, a broken image).
 */

import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3111';
const LOOKS = (process.env.LOOKS ?? 'light,dark,glass').split(',');
const PAGES = (process.env.PAGES ?? [
  '/', '/research', '/orrery', '/vellum', '/vespera', '/shelterix',
  '/genesis-fall', '/arbiter', '/news', '/news/drfsp-robust-compression',
  '/journal', '/journal/submit', '/journal/policies', '/journal/editor',
  '/journal/article/x', '/signin', '/cloud', '/vellum/connect', '/download',
  '/organizations', '/security', '/slack', '/privacy', '/terms', '/404.html',
].join(',')).split(',');

const browser = await chromium.launch();
const findings = [];
let hard = 0;

for (const look of LOOKS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((l) => {
    try {
      localStorage.setItem('eph-mode', l === 'glass' ? 'dark' : l);
      if (l === 'glass') localStorage.setItem('eph-material', 'glass');
      else localStorage.removeItem('eph-material');
    } catch (e) { /* ignore */ }
  }, look);
  const page = await ctx.newPage();

  for (const path of PAGES) {
    const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
    if (!res || res.status() >= 400) continue;
    await page.evaluate(() => {
      document.querySelectorAll('.rv, .reveal').forEach((el) => el.classList.add('in'));
    });
    await page.waitForTimeout(look === 'glass' ? 450 : 250);

    const found = await page.evaluate(() => {
      const out = [];
      const name = (el) => el.tagName.toLowerCase() +
        (typeof el.className === 'string' && el.className
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
      const visible = (el, cs, r) =>
        cs.visibility !== 'hidden' && cs.display !== 'none' &&
        Number(cs.opacity) > 0.05 && r.width > 1 && r.height > 1;

      /* --- text clipped by its own box ---------------------------
         scrollHeight past clientHeight on a non-scrolling box means
         the words are there and nobody can read them. */
      for (const el of document.querySelectorAll('p, li, h1, h2, h3, h4, span, a, td, th, button, label, small, strong')) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (!visible(el, cs, r)) continue;
        if (!(el.textContent || '').trim()) continue;
        const scrolls = /auto|scroll/.test(cs.overflowY + cs.overflowX);
        const clipped = /hidden|clip/.test(cs.overflow + cs.overflowY + cs.overflowX);
        if (scrolls || !clipped) continue;
        if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none') continue;
        const vBleed = el.scrollHeight - el.clientHeight;
        const hBleed = el.scrollWidth - el.clientWidth;
        if (vBleed > 2 || hBleed > 2) {
          out.push({ kind: 'clipped', hard: true, sel: name(el),
            note: `${vBleed > 2 ? vBleed + 'px below' : hBleed + 'px beyond'} its box`,
            sample: (el.textContent || '').trim().slice(0, 34) });
        }
      }

      /* --- images off their intrinsic aspect --------------------- */
      for (const img of document.querySelectorAll('img')) {
        const r = img.getBoundingClientRect();
        const cs = getComputedStyle(img);
        if (!visible(img, cs, r)) continue;
        if (!img.complete || !img.naturalWidth) {
          /* A lazy image below the fold has not loaded because it was
             not asked to. Only an image the reader can actually see is
             a broken image. */
          const lazy = img.loading === 'lazy';
          const onscreen = r.top < window.innerHeight * 1.5 && r.bottom > -200;
          if (lazy && !onscreen) continue;
          out.push({ kind: 'image', hard: true, sel: name(img),
            note: 'did not load', sample: img.getAttribute('src') || '' });
          continue;
        }
        if (cs.objectFit !== 'fill' && cs.objectFit !== '') continue;
        const want = img.naturalWidth / img.naturalHeight;
        const got = r.width / r.height;
        if (Math.abs(want - got) / want > 0.04) {
          out.push({ kind: 'aspect', hard: false, sel: name(img),
            note: `drawn ${got.toFixed(2)} against ${want.toFixed(2)}`,
            sample: (img.getAttribute('src') || '').split('/').pop() });
        }
      }

      /* --- reading measure ---------------------------------------
         Past about 90 characters the eye loses the line on the way
         back. Only paragraphs of real prose are worth judging. */
      for (const el of document.querySelectorAll('p, li, blockquote, dd')) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (!visible(el, cs, r)) continue;
        const text = (el.textContent || '').trim();
        if (text.length < 120) continue;
        const size = parseFloat(cs.fontSize) || 16;
        const mono = /mono|courier/i.test(cs.fontFamily);
        const ch = r.width / (size * (mono ? 0.6 : 0.5));
        if (ch > 92) {
          out.push({ kind: 'measure', hard: false, sel: name(el),
            note: `~${Math.round(ch)} characters per line`, sample: text.slice(0, 34) });
        }
      }

      /* --- orphaned last word in a heading ------------------------
         A display line that wraps to one short word reads as a
         mistake. text-wrap: balance is the fix and most headings here
         already have it. */
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
      document.body.appendChild(probe);
      for (const el of document.querySelectorAll('h1, h2')) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (!visible(el, cs, r)) continue;
        if (cs.textWrap === 'balance' || cs.textWrapStyle === 'balance') continue;
        const words = (el.textContent || '').trim().split(/\s+/);
        if (words.length < 4) continue;
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
        if (r.height < lh * 1.6) continue;            // single line
        probe.style.font = cs.font;
        probe.textContent = words[words.length - 1];
        if (probe.getBoundingClientRect().width < r.width * 0.18) {
          out.push({ kind: 'orphan', hard: false, sel: name(el),
            note: `last line is "${words[words.length - 1]}"`,
            sample: (el.textContent || '').trim().slice(0, 34) });
        }
      }
      probe.remove();

      /* --- text overlapping text ---------------------------------
         Two painted leaf nodes sharing pixels is nearly always a
         layout fault rather than a design. */
      const leaves = [...document.querySelectorAll('h1, h2, h3, p, span, a, li, td, button')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return visible(el, cs, r) && (el.textContent || '').trim() &&
            el.children.length === 0 && cs.position !== 'fixed' &&
            r.top > -50 && r.top < 4000;
        }).slice(0, 400);
      /* Compare the boxes an element actually paints, not the union of
         them. A wrapped inline link has one bounding rect spanning
         every line it touches, so two links in the same paragraph
         appear to overlap in a region neither of them occupies. */
      /* Absolutely positioned layers stacked on one another are a
         composition technique, not a fault -- the scroll scenes here
         cross-fade frames that sit in exactly the same place on
         purpose. Only flow content overlapping flow content is a bug. */
      const stacked = (el) => {
        let n = el, depth = 0;
        while (n && depth++ < 5) {
          const pos = getComputedStyle(n).position;
          if (pos === 'absolute' || pos === 'fixed' || pos === 'sticky') return true;
          n = n.parentElement;
        }
        return false;
      };
      const boxes = leaves.map((el) => (stacked(el) ? [] : [...el.getClientRects()]));
      for (let i = 0; i < leaves.length; i++) {
        for (let j = i + 1; j < leaves.length; j++) {
          if (leaves[i].contains(leaves[j]) || leaves[j].contains(leaves[i])) continue;
          let worst = 0, dims = '';
          for (const a of boxes[i]) {
            for (const b of boxes[j]) {
              const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (ox > 6 && oy > 6 && ox * oy > worst) {
                worst = ox * oy;
                dims = `${Math.round(ox)}x${Math.round(oy)}px shared`;
              }
            }
          }
          if (worst > 240) {
            out.push({ kind: 'overlap', hard: false,
              sel: name(leaves[i]) + ' / ' + name(leaves[j]),
              note: dims, sample: (leaves[i].textContent || '').trim().slice(0, 24) });
          }
        }
      }
      return out;
    });

    for (const f of found) {
      if (f.hard) hard++;
      findings.push({ look, path, ...f });
    }
  }
  await ctx.close();
}
await browser.close();

/* Collapse: the same defect on the same selector across looks is one
   problem, not three. */
const groups = new Map();
for (const f of findings) {
  const key = `${f.kind}|${f.path}|${f.sel}|${f.note}`;
  const g = groups.get(key) ?? { ...f, looks: new Set() };
  g.looks.add(f.look);
  groups.set(key, g);
}

const order = ['clipped', 'image', 'overlap', 'aspect', 'measure', 'orphan'];
const rows = [...groups.values()].sort(
  (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.path.localeCompare(b.path));

console.log(`check-layout: ${PAGES.length} pages x ${LOOKS.length} looks -> ${rows.length} finding(s), ${hard} hard\n`);
let kind = null;
for (const r of rows) {
  if (r.kind !== kind) { kind = r.kind; console.log(`--- ${kind}`); }
  const looks = r.looks.size === LOOKS.length ? 'all' : [...r.looks].join('+');
  console.log(`  ${r.path.padEnd(30)} ${r.sel.slice(0, 34).padEnd(34)} ${r.note}  [${looks}]`);
  if (r.sample) console.log(`      "${r.sample}"`);
}
process.exit(hard ? 1 : 0);
