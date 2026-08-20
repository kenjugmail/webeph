#!/usr/bin/env node
/**
 * Surface palette completeness.
 *
 * Every page must resolve the slots that tokens.css writes rules
 * against. A slot that computes to nothing does not fail loudly -- the
 * declaration is simply dropped and the rule sits there looking
 * handled. Thirteen rules in tokens.css referenced var(--accent) on
 * surfaces that never defined it, and it took a hover audit to notice.
 *
 * genesis-fall is exempt: it is FIXED in mode.js, art-directed, and
 * carries a private --qe-* palette on purpose.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const EXEMPT = ['/genesis-fall'];

/* One invariant, stated narrowly enough to be true.

   Deriving the required slots from bare var() uses in tokens.css was
   the first attempt and it over-reached: it picked up --jr-ink and
   --nw-ink, which are private to those two surfaces and correctly
   absent everywhere else, and --signal, which is not an independent
   requirement but the other spelling of --accent. A check that
   demands things that should not exist is worse than no check.

   What is actually true site-wide: --accent must resolve to a real
   colour on every page, because thirteen rules in tokens.css read it
   with no fallback and each one silently evaporates without it. The
   other slots are printed as context, not asserted. */
const REQUIRED = ['--accent'];
const SLOTS = ['--accent', '--signal', '--ink', '--bg', '--paper'];
const PAGES = (process.env.PAGES ?? [
  '/', '/research', '/orrery', '/vellum', '/vespera', '/shelterix',
  '/arbiter', '/news', '/news/drfsp-robust-compression', '/journal',
  '/journal/policies', '/download', '/cloud', '/signin', '/organizations',
  '/security', '/privacy', '/terms', '/slack', '/vellum/connect',
].join(',')).split(',');

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const bad = [];
const rows = [];

for (const path of PAGES) {
  const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
  if (!res || res.status() >= 400) continue;
  const got = await page.evaluate((slots) => {
    const cs = getComputedStyle(document.body);
    const out = {};
    for (const s of slots) out[s] = cs.getPropertyValue(s).trim();
    return out;
  }, SLOTS);
  const missing = REQUIRED.filter((s) => {
    const v = got[s];
    /* currentColor and the empty string both mean "this rule will do
       nothing here". A real palette names a real colour. */
    return !v || v === 'currentColor' || v === 'inherit';
  });
  rows.push({ path, got, missing });
  if (missing.length && !EXEMPT.includes(path)) bad.push({ path, missing });
}
await browser.close();

console.log(`check-surface: ${rows.length} pages, ${bad.length} without a resolvable ${REQUIRED.join('/')}\n`);
console.log(`  ${'page'.padEnd(32)} ${SLOTS.map((s) => s.replace('--', '').padEnd(10)).join(' ')}`);
for (const r of rows) {
  const mark = r.missing.length ? (EXEMPT.includes(r.path) ? ' (exempt)' : '  <-- MISSING') : '';
  console.log(`  ${r.path.padEnd(32)} ${SLOTS.map((s) => (r.got[s] || '-').padEnd(10)).join(' ')}${mark}`);
}
if (bad.length) {
  console.error('\nA slot that resolves to nothing silently drops every rule that uses it:');
  for (const b of bad) console.error(`  ${b.path}: ${b.missing.join(', ')}`);
  process.exit(1);
}
