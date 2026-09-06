#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/swc-web-preprint');
const expectedHash = 'fa6bcab7ff8073f8369f3ffb3c8c575cb4e9ff7cc1e614c5aaa5555fea88702f';
await mkdir(output, { recursive: true });

const pdf = await readFile(join(root, 'assets/research/stochastic-witness-calculus-arxiv-v6.pdf'));
assert.equal(createHash('sha256').update(pdf).digest('hex'), expectedHash);
const manifest = JSON.parse(await readFile(join(root, 'assets/research/swc-arxiv-v6-manifest.json'), 'utf8'));
const figureManifest = JSON.parse(await readFile(join(root, 'assets/research/swc-v3-manifest.json'), 'utf8'));
assert.equal(manifest.pages, 40);
assert.equal(manifest.sha256, expectedHash);
assert.equal(figureManifest.figureCrops.length, 6);
for (const figure of figureManifest.figureCrops) {
  const bytes = await readFile(join(root, 'assets/research', figure.filename));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), figure.sha256, `${figure.filename} hash drifted`);
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/journal/preprint/stochastic-witness-calculus') pathname = '/journal-swc.html';
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
  for (const viewport of [{ name: 'desktop-light', width: 1280, height: 720, mode: 'light' }, { name: 'desktop-dark', width: 1440, height: 900, mode: 'dark' }, { name: 'intermediate-light', width: 900, height: 720, mode: 'light' }, { name: 'tablet-light', width: 768, height: 1024, mode: 'light' }, { name: 'mobile-dark', width: 390, height: 844, mode: 'dark' }]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.addInitScript((mode) => { localStorage.setItem('eph-mode', mode); localStorage.setItem('eph-material', 'flat'); }, viewport.mode);
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${port}/journal/preprint/stochastic-witness-calculus`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const images = [...document.images];
      images.forEach((image) => { image.loading = 'eager'; });
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    });
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      title: document.querySelector('h1')?.textContent,
      sections: document.querySelectorAll('[data-swc-section]').length,
      figures: [...document.images].filter((image) => image.src.includes('/assets/research/swc-')).length,
      brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).length,
      status: document.querySelector('.swc-paper-status')?.textContent,
      pdfHref: document.querySelector('a[href$="stochastic-witness-calculus-arxiv-v6.pdf"]')?.getAttribute('href'),
      culprits: [...document.querySelectorAll('body *')].map((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > innerWidth + 1 && getComputedStyle(element).position !== 'fixed'
          ? `${element.tagName.toLowerCase()}.${String(element.className || '').split(' ').slice(0, 2).join('.')} right=${Math.round(rect.right)} width=${Math.round(rect.width)}`
          : '';
      }).filter(Boolean).slice(0, 8),
    }));
    assert.ok(result.overflow <= 1, `${viewport.name} has ${result.overflow}px horizontal overflow · ${result.culprits.join(' · ')}`);
    assert.match(result.title || '', /Stochastic Witness Calculus/);
    assert.equal(result.sections, 14);
    assert.equal(result.figures, 6);
    assert.equal(result.brokenImages, 0);
    assert.match(result.status || '', /not peer-reviewed/i);
    assert.equal(result.pdfHref, '/assets/research/stochastic-witness-calculus-arxiv-v6.pdf');
    assert.deepEqual(errors, []);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: join(output, `${viewport.name}-top.png`) });
    await page.locator('#revision-v6').screenshot({ path: join(output, `${viewport.name}-v6.png`) });
    await page.locator('#revision-v5').screenshot({ path: join(output, `${viewport.name}-v5.png`) });
    await page.locator('#semantics').screenshot({ path: join(output, `${viewport.name}-semantics.png`) });
    await page.locator('#reproducibility').screenshot({ path: join(output, `${viewport.name}-reproducibility.png`) });
    await page.locator('#references').screenshot({ path: join(output, `${viewport.name}-references.png`) });
    await page.close();
  }
  console.log('SWC HTML preprint: PASS · canonical PDF + 6 figures + 14 sections · responsive light/dark');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
