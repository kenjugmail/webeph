#!/usr/bin/env node
/**
 * Expand shared chrome into the committed HTML.
 *
 * The site has 25 hand-written pages and no build step, so the head block
 * and the shared footers had drifted apart: three journal pages ended up
 * with no link to the privacy policy or the terms at all, and adding the
 * theme script meant editing 25 files by hand.
 *
 * This keeps the generated markup IN the files. The .html files stay the
 * deployable artifact, the diff is reviewable, and removing the tool is
 * deleting the marker comments.
 *
 *   node scripts/build-chrome.mjs            # rewrite in place
 *   node scripts/build-chrome.mjs --check    # exit 1 if anything is stale
 *
 * Markers are HTML comments, so an un-expanded page is still valid:
 *
 *   <!-- include: head-common -->
 *   ...generated, do not edit...
 *   <!-- /include -->
 *
 * A partial may use {{TOKENS}}, filled per page from chrome.config.json.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PARTIALS = join(ROOT, 'partials');
const CHECK = process.argv.includes('--check');

const config = existsSync(join(ROOT, 'scripts/chrome.config.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'scripts/chrome.config.json'), 'utf8'))
  : {};

const partial = (name) => {
  const file = join(PARTIALS, `${name}.html`);
  if (!existsSync(file)) throw new Error(`no partial named "${name}" (${file})`);
  return readFileSync(file, 'utf8').replace(/\n+$/, '');
};

/** Indent a partial to match the marker, so the output reads as authored. */
const indent = (text, pad) => text.split('\n').map((l) => (l ? pad + l : l)).join('\n');

const MARKER = /([ \t]*)<!-- include: ([a-z0-9-]+) -->[\s\S]*?<!-- \/include -->/g;

const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
const stale = [];
let expanded = 0;

for (const page of pages) {
  const file = join(ROOT, page);
  const before = readFileSync(file, 'utf8');
  let count = 0;

  const after = before.replace(MARKER, (_m, pad, name) => {
    count++;
    let body = partial(name);
    const vars = { ...(config.default ?? {}), ...(config[page] ?? {}) };
    body = body.replace(/\{\{([A-Z0-9_]+)\}\}/g, (whole, key) => {
      if (!(key in vars)) throw new Error(`${page}: partial "${name}" needs {{${key}}}, absent from chrome.config.json`);
      return vars[key];
    });
    return `${pad}<!-- include: ${name} -->\n${indent(body, pad)}\n${pad}<!-- /include -->`;
  });

  if (!count) continue;
  expanded += count;
  if (after !== before) {
    if (CHECK) stale.push(page);
    else writeFileSync(file, after);
  }
}

if (CHECK) {
  if (stale.length) {
    console.error(`\nbuild-chrome: ${stale.length} page(s) are stale; run "npm run chrome"\n`);
    for (const p of stale) console.error('  ' + p);
    console.error('');
    process.exit(1);
  }
  console.log(`build-chrome: ${expanded} include(s) up to date`);
} else {
  console.log(`build-chrome: expanded ${expanded} include(s) across ${pages.length} pages`);
}
