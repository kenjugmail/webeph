#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/journal-swc-prepublication');
await mkdir(output, { recursive: true });

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/journal/article/stochastic-witness-calculus') pathname = '/journal-article.html';
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

const publication = {
  id: '00000000-0000-4000-8000-000000000002',
  article_id: 'Prepublication preview',
  slug: 'stochastic-witness-calculus',
  title: 'Stochastic Witness Calculus: Exact Measure Certificates for Mathematical Existence, Learned Proof Search, and Anytime-Valid Empirical Claims',
  summary: 'A machine-auditable framework that turns certified positive probability mass over valid witnesses into ordinary existence proofs while keeping exact mathematics, randomized search, and anytime-valid empirical claims distinct.',
  abstract: 'Purpose: Connect randomized witness discovery to exact existence claims without treating model output as proof.\n\nMethods: Define measure certificates, compositional rules, an exact finite verification kernel, and a separate anytime-valid empirical mode.\n\nResults: Controlled SAT, finite Erdős–Straus, and sequential-testing studies exercise the framework. The Erdős–Straus experiment verifies the declared finite range exactly; it does not prove the conjecture universally.\n\nConclusion: Learned search can propose where to look while independently checkable certificates determine what may be claimed.',
  article_type: 'Original research',
  keywords: ['probabilistic method', 'formal verification', 'proof certificates', 'anytime-valid inference'],
  public_authors: [{ type: 'human', name: 'Kenju Tomita', role: 'Sole author', affiliations: ['Rochester Institute of Technology', 'Ephemerent Research'] }],
  accountable_name: 'Kenju Tomita',
  ai_disclosure: 'Arbiter v23 contributed hypotheses, reformulations, and proof drafts but is outside the trusted verification base. GPT-5.6 Pro assisted literature synthesis, code and figure generation, and drafting. Kenju Tomita directed, audited, and remains responsible for the work.',
  funding_statement: 'No external funding.',
  conflict_statement: 'Kenju Tomita operates Ephemerent Research and is the author and accountable publisher. The final publication action remains attributable to the authorized human account.',
  ethics_statement: 'Computational and synthetic experiments; no human or animal subjects and no private personal data.',
  license: 'CC BY 4.0',
  external_links: [],
  status: 'published',
  published_at: '2026-09-04T12:00:00Z',
  updated_at: '2026-09-04T12:00:00Z',
  public_notice_type: '',
  public_notice: '',
};
const version = { id: '10000000-0000-4000-8000-000000000001', submission_id: publication.id, version_number: 1, created_at: publication.published_at, published_at: publication.published_at, public_notice_type: '', public_notice: '' };
const files = [
  { id: '20000000-0000-4000-8000-000000000001', submission_id: publication.id, version_id: version.id, bucket_id: 'research-public', storage_path: 'published/stochastic-witness-calculus/v1/001-stochastic_witness_calculus_arxiv_v3.pdf', original_filename: 'stochastic_witness_calculus_arxiv_v3.pdf', file_role: 'manuscript', mime_type: 'application/pdf', byte_size: 618000, sha256: '17ff47c284b79207e2365d286c18aaa19915c63bf0af655a587066a5647b462a', created_at: publication.published_at },
  { id: '20000000-0000-4000-8000-000000000002', submission_id: publication.id, version_id: version.id, bucket_id: 'research-public', storage_path: 'published/stochastic-witness-calculus/v1/002-source.zip', original_filename: 'stochastic_witness_calculus_source.zip', file_role: 'source', mime_type: 'application/zip', byte_size: 120000, sha256: 'a'.repeat(64), created_at: publication.published_at },
  { id: '20000000-0000-4000-8000-000000000003', submission_id: publication.id, version_id: version.id, bucket_id: 'research-public', storage_path: 'published/stochastic-witness-calculus/v1/003-reproducibility.zip', original_filename: 'stochastic_witness_calculus_reproducibility.zip', file_role: 'reproducibility', mime_type: 'application/zip', byte_size: 220000, sha256: 'b'.repeat(64), created_at: publication.published_at },
];
const reviews = [
  { id: '30000000-0000-4000-8000-000000000001', version_id: version.id, display_name: 'gpt-5.6-sol', review_type: 'Peer review with AI', recommendation: 'accept_after_changes', reviewer_type: 'ai_system', review_stage: 'prepublication', body: 'Decision: Accept after completed changes.\n\nEvidence checked: Exact certificate definitions, controlled outputs, finite-range wording, and reproducibility instructions.\n\nLimitations: The finite Erdős–Straus verification is not a universal proof.\n\nRecommendation: Publish only after all requested changes and package checks pass.', ai_disclosure: 'Isolated gpt-5.6-sol context, max reasoning. Version 1 and declared artifacts reviewed; no external private sources.', created_at: publication.published_at },
  { id: '30000000-0000-4000-8000-000000000002', version_id: version.id, display_name: 'gpt-5.6-sol', review_type: 'AI editorial recommendation', recommendation: 'accept', reviewer_type: 'ai_system', review_stage: 'prepublication', body: 'Decision: Recommend publication after the mandatory human gate.\n\nEvidence checked: Declarations, claim language, file integrity, and licensing.\n\nLimitations: This recommendation cannot accept or publish the paper.\n\nRecommendation: The authorized human editor may publish after every release gate is satisfied.', ai_disclosure: 'Separate isolated gpt-5.6-sol context, max reasoning. Policy and release record only.', created_at: publication.published_at },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ name: 'desktop', width: 1280, height: 720 }, { name: 'mobile', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const consoleErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    await page.route('https://wjjthkqwcyahamhjkeux.supabase.co/rest/v1/**', async (route) => {
      const url = route.request().url();
      let data = [];
      if (url.includes('/research_publications')) data = publication;
      else if (url.includes('/research_public_files')) data = files;
      else if (url.includes('/research_public_versions')) data = [version];
      else if (url.includes('/research_public_reviews')) data = reviews;
      else if (url.includes('/research_public_comments')) data = [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.route('https://wjjthkqwcyahamhjkeux.supabase.co/storage/v1/object/sign/research-public/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/storage/v1/object/sign/research-public', '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedURL: `/storage/v1/object/sign/research-public${path}?token=fixture` }) });
    });
    await page.goto(`http://127.0.0.1:${port}/journal/article/stochastic-witness-calculus`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-journal-article-root]:not([data-article-loading])');
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      title: document.querySelector('[data-article-title]')?.textContent,
      affiliations: document.querySelector('[data-article-affiliations]')?.textContent,
      declarations: document.querySelectorAll('.jr-declaration-ledger > div').length,
      reviews: document.querySelectorAll('.jr-review-record').length,
      paperLink: document.querySelector('.jr-article-actions .jr-button-primary')?.textContent,
    }));
    assert.ok(result.overflow <= 1, `${viewport.name} has ${result.overflow}px horizontal overflow`);
    assert.match(result.title || '', /Stochastic Witness Calculus/);
    assert.match(result.affiliations || '', /Rochester Institute of Technology/);
    assert.equal(result.declarations, 6);
    assert.equal(result.reviews, 2);
    assert.match(result.paperLink || '', /Read the paper/);
    assert.deepEqual(consoleErrors, []);
    await page.screenshot({ path: join(output, `${viewport.name}.png`), fullPage: true });
    await page.close();
  }
  console.log('journal SWC prepublication preview: PASS · 1280×720 + 390×844');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
