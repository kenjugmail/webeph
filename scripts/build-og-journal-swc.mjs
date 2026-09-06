#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ headless: true });
try {
  for (const name of ['og-journal-swc', 'og-news-swc']) {
    const svg = await readFile(join(root, `assets/${name}.svg`), 'utf8');
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;width:1200px;height:630px;overflow:hidden}svg{display:block}</style>${svg}`);
    await page.screenshot({ path: join(root, `assets/${name}.png`), type: 'png' });
    await page.close();
    console.log(`built assets/${name}.png · 1200×630`);
  }
} finally {
  await browser.close();
}
