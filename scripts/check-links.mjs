#!/usr/bin/env node
/**
 * Static-site integrity check for ephemerent.com.
 *
 * The site is plain HTML served through vercel.json rewrites, so a page authored
 * with a relative asset path renders fine at /journal but 404s at /journal/submit.
 * That exact bug shipped three broken pages, so it gets a guard rather than a habit.
 *
 * Run:  node scripts/check-links.mjs
 * Exits non-zero on any failure, which is what makes it usable as a build command.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);

const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const rewrites = vercel.rewrites ?? [];
const redirects = vercel.redirects ?? [];

/** Pages reachable only as a rewrite destination never need their own route. */
const rewriteDestinations = new Set(
  rewrites.map((r) => r.destination.split('?')[0].replace(/^\//, '')),
);

// ---------------------------------------------------------------- 1. relative refs
// The core guard. Any of these break the moment a page moves to a nested route.
const RELATIVE_ATTR = /(?:src|href)="(?!https?:|\/\/|\/|#|mailto:|tel:|data:|\$|\{)/g;
const RELATIVE_IMPORT = /from\s+['"]\.\/?assets\//g;

for (const page of pages) {
  const html = readFileSync(join(ROOT, page), 'utf8');

  for (const m of html.matchAll(RELATIVE_ATTR)) {
    const snippet = html.slice(m.index, m.index + 60).split('"')[1] ?? '';
    fail(page, `relative reference "${snippet}" — use a root-absolute path`);
  }
  for (const _ of html.matchAll(RELATIVE_IMPORT)) {
    fail(page, 'relative ES module import — inline modules resolve against the page URL, not /assets/');
  }
}

// ------------------------------------------------------------- 2. targets resolve
const routeSources = new Set([
  ...rewrites.map((r) => r.source),
  ...redirects.map((r) => r.source),
]);
/** A rewrite source with a :param matches a family of paths, not one string. */
const dynamicRoutes = [...routeSources]
  .filter((s) => s.includes(':'))
  .map((s) => new RegExp('^' + s.replace(/:[^/]+\*/g, '.*').replace(/:[^/]+/g, '[^/]+') + '$'));

const resolves = (path) => {
  const clean = path.split(/[?#]/)[0];
  if (clean === '/' || clean === '') return true;
  if (routeSources.has(clean)) return true;
  if (dynamicRoutes.some((re) => re.test(clean))) return true;
  return existsSync(join(ROOT, clean.replace(/^\//, '')));
};

for (const page of pages) {
  const html = readFileSync(join(ROOT, page), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]*)"/g)) {
    if (!resolves(m[1])) fail(page, `dead local target ${m[1]}`);
  }
}

// --------------------------------------------------------------- 3. route coverage
// Every page should be reachable by a pretty URL or be an explicit exception.
const NO_ROUTE_NEEDED = new Set(['404.html']);
for (const page of pages) {
  if (NO_ROUTE_NEEDED.has(page)) continue;
  if (!rewriteDestinations.has(page)) fail(page, 'no vercel.json rewrite points at this page');
}

// -------------------------------------------------------------- 4. sitemap parity
const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
for (const page of pages) {
  const html = readFileSync(join(ROOT, page), 'utf8');
  if (/name="robots"[^>]*noindex/i.test(html)) continue;
  if (NO_ROUTE_NEEDED.has(page)) continue;

  const route = rewrites.find((r) => r.destination.split('?')[0] === '/' + page)?.source;
  if (!route) continue;
  if (route.includes(':')) continue; // dynamic route family — one page, many URLs
  const url = route === '/' ? 'https://ephemerent.com/' : `https://ephemerent.com${route}`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) fail(page, `indexable but missing from sitemap.xml (${url})`);
}

// -------------------------------------------------------- 5. per-page head hygiene
for (const page of pages) {
  const html = readFileSync(join(ROOT, page), 'utf8');
  const noindex = /name="robots"[^>]*noindex/i.test(html);
  const has = (re) => re.test(html);

  if (!has(/<html[^>]+lang=/i)) fail(page, 'missing lang attribute');
  if (!has(/name="viewport"/i)) fail(page, 'missing viewport meta');
  if (!has(/name="description"/i)) fail(page, 'missing meta description');
  if (!has(/rel="manifest"/i)) fail(page, 'missing rel=manifest');
  if (!noindex && !has(/property="og:title"/i)) fail(page, 'missing og:title');
  if (!noindex && !has(/property="og:image"/i)) fail(page, 'missing og:image');

  const h1s = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1s > 1) fail(page, `${h1s} <h1> elements — document outline needs exactly one`);
}

// ------------------------------------------------------------------------ report
if (failures.length) {
  console.error(`\ncheck-links: ${failures.length} problem(s)\n`);
  for (const f of failures) console.error('  ' + f);
  console.error('');
  process.exit(1);
}
console.log(`check-links: ${pages.length} pages OK`);
