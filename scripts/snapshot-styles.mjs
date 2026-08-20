#!/usr/bin/env node
/**
 * Computed-style oracle.
 *
 * The site has no visual-diff tooling, and the cascade work ahead (layers,
 * removing !important, consolidating tokens) can regress a page without any
 * error being raised. This dumps the properties that refactor actually moves,
 * for the components most at risk, so a before/after diff is a real check.
 *
 *   node scripts/snapshot-styles.mjs before      # writes .artifacts/before.json
 *   node scripts/snapshot-styles.mjs after       # writes .artifacts/after.json
 *   node scripts/snapshot-styles.mjs diff        # compares the two
 *
 * BASE=http://localhost:3000 overrides the target origin.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const MODE = process.argv[2] ?? 'before';
const OUT = '.artifacts';

/* The six pages where polish.css loads before the page stylesheet, plus the
   surfaces with their own palettes. These are where the cascade work lands. */
const PAGES = [
  '/', '/research', '/orrery', '/shelterix', '/arbiter', '/signin',
  '/vellum', '/vespera', '/journal', '/news', '/genesis-fall',
  '/download', '/cloud', '/organizations', '/privacy', '/terms',
  '/journal/submit', '/journal/policies', '/journal/editor', '/vellum/connect',
  '/security', '/slack', '/404.html',
];

const SELECTORS = [
  'body', '.nav', '.ebar', '.jr-header', '.nw-header',
  '.btn', '.btn-primary', '.btn-ghost', '.ebtn',
  '.card', '.price-card', '.flow-step', '.account-plan', '.auth-card',
  'h1', 'h2', '.lbl', '.eyebrow', '.mono', 'a',
  '.jr-button', '.jr-card', '.nw-card',
];

const PROPS = [
  'backgroundColor', 'color', 'borderTopColor', 'borderTopWidth',
  'borderRadius', 'boxShadow', 'fontFamily', 'fontSize', 'fontWeight',
  'letterSpacing', 'lineHeight', 'paddingTop', 'paddingLeft',
  'marginTop', 'maxWidth', 'opacity', 'transitionDuration',
];

async function capture() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const result = {};

  for (const path of PAGES) {
    const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
    if (!res || res.status() >= 400) { result[path] = { __error: res?.status() ?? 'unreachable' }; continue; }
    // Reveal-on-scroll elements start transparent; settle them so opacity is comparable.
    await page.evaluate(() => document.querySelectorAll('.rv, .reveal').forEach((el) => el.classList.add('in')));
    await page.waitForTimeout(150);

    result[path] = await page.evaluate(
      ({ selectors, props }) => {
        const out = {};
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (!el) continue;
          const cs = getComputedStyle(el);
          out[sel] = Object.fromEntries(props.map((p) => [p, cs[p]]));
        }
        return out;
      },
      { selectors: SELECTORS, props: PROPS },
    );
  }

  await browser.close();
  return result;
}

function diff(a, b) {
  const changes = [];
  for (const path of Object.keys(a)) {
    const pa = a[path], pb = b[path] ?? {};
    if (pa.__error || pb.__error) {
      if (pa.__error !== pb.__error) changes.push(`${path}: status ${pa.__error ?? 'ok'} -> ${pb.__error ?? 'ok'}`);
      continue;
    }
    for (const sel of Object.keys(pa)) {
      if (!pb[sel]) { changes.push(`${path} ${sel}: element disappeared`); continue; }
      for (const prop of Object.keys(pa[sel])) {
        if (pa[sel][prop] !== pb[sel][prop]) {
          changes.push(`${path} ${sel}.${prop}: ${pa[sel][prop]} -> ${pb[sel][prop]}`);
        }
      }
    }
    for (const sel of Object.keys(pb)) if (!pa[sel]) changes.push(`${path} ${sel}: element appeared`);
  }
  return changes;
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

if (MODE === 'diff') {
  const before = JSON.parse(readFileSync(`${OUT}/before.json`, 'utf8'));
  const after = JSON.parse(readFileSync(`${OUT}/after.json`, 'utf8'));
  const changes = diff(before, after);
  if (!changes.length) { console.log('snapshot-styles: no computed-style changes'); process.exit(0); }
  console.log(`snapshot-styles: ${changes.length} change(s)\n`);
  for (const c of changes) console.log('  ' + c);
} else {
  const data = await capture();
  writeFileSync(`${OUT}/${MODE}.json`, JSON.stringify(data, null, 1));
  const n = Object.values(data).filter((p) => !p.__error).length;
  console.log(`snapshot-styles: captured ${n}/${PAGES.length} pages -> ${OUT}/${MODE}.json`);
}
