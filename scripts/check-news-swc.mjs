#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/news-swc');
await mkdir(output, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/news/stochastic-witness-calculus') pathname = '/news-swc.html';
    if (pathname === '/news') pathname = '/news.html';
    const path = normalize(join(root, pathname === '/' ? 'Ephemerent.html' : pathname.replace(/^\//, '')));
    if (!path.startsWith(root) || !(await stat(path)).isFile()) throw new Error('not found');
    response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream' });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end('Not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of [{ name: 'desktop-light', width: 1280, height: 720, mode: 'light' }, { name: 'mobile-dark', width: 390, height: 844, mode: 'dark' }]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.addInitScript((mode) => { localStorage.setItem('eph-mode', mode); localStorage.setItem('eph-material', 'flat'); }, viewport.mode);
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${port}/news/stochastic-witness-calculus`, { waitUntil: 'networkidle' });
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sections: document.querySelectorAll('[data-article-section]').length,
      title: document.querySelector('h1')?.textContent,
      defaultMiss: document.querySelector('[data-swc-miss-value]')?.textContent,
      tableRows: document.querySelectorAll('.nw-swc-static-table tbody tr').length,
    }));
    assert.ok(result.overflow <= 1, `${viewport.name} has ${result.overflow}px horizontal overflow`);
    assert.equal(result.sections, 6);
    assert.match(result.title || '', /Probability can prove existence/);
    assert.equal(result.defaultMiss, '90.48%');
    assert.equal(result.tableRows, 2);
    await page.selectOption('[data-swc-mass]', '4');
    await page.selectOption('[data-swc-samples]', '4');
    assert.equal(await page.locator('[data-swc-miss-value]').textContent(), '36.79%');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(output, `${viewport.name}.png`), fullPage: true });
    await page.close();
  }
  const home = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await home.addInitScript(() => { localStorage.setItem('eph-mode', 'light'); localStorage.setItem('eph-material', 'flat'); });
  await home.goto(`http://127.0.0.1:${port}/news`, { waitUntil: 'networkidle' });
  const homeState = await home.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    lead: document.querySelector('.nw-lead-copy h1 a')?.getAttribute('href'),
    stories: document.querySelectorAll('.nw-story-row').length,
  }));
  assert.ok(homeState.overflow <= 1, `news home has ${homeState.overflow}px horizontal overflow`);
  assert.equal(homeState.lead, '/news/stochastic-witness-calculus');
  assert.equal(homeState.stories, 2);
  await home.screenshot({ path: join(output, 'home-light.png'), fullPage: true });
  await home.close();
  console.log('news SWC dispatch: PASS · interaction + light/dark responsive layouts');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
