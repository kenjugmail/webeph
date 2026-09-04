import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const record = JSON.parse(await readFile(join(root, 'research/stochastic-witness-calculus/publication.json'), 'utf8'));
const article = await readFile(join(root, 'journal-article.html'), 'utf8');
const editor = await readFile(join(root, 'journal-editor.html'), 'utf8');
const submit = await readFile(join(root, 'journal-submit.html'), 'utf8');
const journalJs = await readFile(join(root, 'assets/journal.js'), 'utf8');
const schema = await readFile(join(root, 'supabase/schema.sql'), 'utf8');
const migration = await readFile(join(root, 'supabase/migrations/20260904000000_research_review_and_atomic_publication.sql'), 'utf8');
const news = await readFile(join(root, 'news-swc.html'), 'utf8');
const newsIndex = await readFile(join(root, 'news.html'), 'utf8');
const rss = await readFile(join(root, 'news.xml'), 'utf8');
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const preprint = await readFile(join(root, 'journal-swc.html'), 'utf8');
const preprintManifest = JSON.parse(await readFile(join(root, 'assets/research/swc-v4-1-manifest.json'), 'utf8'));
const preprintPdf = await readFile(join(root, 'assets/research/stochastic-witness-calculus-v4-1.pdf'));

function pngDimensions(value) {
  if (value.toString('ascii', 1, 4) !== 'PNG') return undefined;
  return [value.readUInt32BE(16), value.readUInt32BE(20)];
}

test('publishes a labeled preprint while blocking journal acceptance until package audit and reviews are complete', () => {
  assert.equal(record.publicationStatus, 'public_preprint');
  assert.equal(record.journalPublicationStatus, 'blocked_missing_package');
  assert.equal(record.releaseGates.completePackageReceived, true);
  assert.equal(record.intakeArtifact.auditStatus, 'received_with_stale_manifest_entries');
  assert.equal(record.intakeArtifact.manifestMismatches, 6);
  assert.equal(record.releaseGates.peerReviewAcceptsReviewedVersion, false);
  assert.equal(record.releaseGates.humanPublicationAction, false);
  assert.equal(record.slug, 'stochastic-witness-calculus');
  assert.equal(record.baselinePdf.pages, 39);
  assert.equal(record.baselinePdf.sha256, '2ce75cf7c681b466dd20a202e80e433d0e92a60016158995a60f7e489f2c9c71');
  assert.equal(createHash('sha256').update(preprintPdf).digest('hex'), record.baselinePdf.sha256);
  assert.match(record.claimGuardrail, /genuine exact theorem/i);
  assert.match(record.claimGuardrail, /universal closure/i);
});

test('renders affiliations and complete declarations without exposing private fields', () => {
  assert.match(submit, /name="author_affiliations"/);
  assert.match(article, /data-article-affiliations/);
  for (const field of ['funding', 'conflicts', 'ethics', 'ai-contribution', 'licensing', 'accountability']) {
    assert.match(article, new RegExp(`data-article-${field}`));
  }
  assert.match(journalJs, /affiliation: author\.affiliations\.map/);
  assert.match(journalJs, /stochastic[_ -]witness[_ -]calculus/);
  assert.doesNotMatch(article, /submitter_id|editor_note|account email/i);
});

test('separates AI peer review from editorial recommendation and gates acceptance', () => {
  assert.match(editor, /Peer review with AI/);
  assert.match(editor, /AI editorial recommendation/);
  assert.match(editor, /name="recommendation"/);
  for (const sql of [schema, migration]) {
    assert.match(sql, /r\.review_type = 'Peer review with AI'/);
    assert.match(sql, /r\.recommendation in \('accept','accept_after_changes'\)/);
    assert.match(sql, /r\.version_id = latest_version_id/);
  }
});

test('publishes file records atomically and retains cleanup behavior', () => {
  for (const sql of [schema, migration]) {
    assert.match(sql, /publish_research_submission_with_files/);
    assert.match(sql, /jsonb_array_elements\(p_public_files\)/);
    assert.match(sql, /A published research version requires a PDF manuscript/);
  }
  assert.match(journalJs, /rpc\('publish_research_submission_with_files'/);
  assert.match(journalJs, /cleanupPublishedFiles/);
  assert.match(journalJs, /createSignedUrl\(file\.storage_path, 3600\)/);
  assert.doesNotMatch(journalJs, /getPublicUrl\(file\.storage_path\)/);
  assert.doesNotMatch(journalJs, /rpc\('publish_research_submission'/);
  for (const sql of [schema, migration]) {
    assert.match(sql, /values \('research-public', 'research-public', false, 52428800\)/);
    assert.match(sql, /is_public_research_file/);
  }
});

test('has a dedicated 1200 by 630 social asset and slug mapping', async () => {
  const image = await readFile(join(root, 'assets/og-journal-swc.png'));
  const newsImage = await readFile(join(root, 'assets/og-news-swc.png'));
  assert.deepEqual(pngDimensions(image), [1200, 630]);
  assert.deepEqual(pngDimensions(newsImage), [1200, 630]);
  assert.match(journalJs, /'stochastic-witness-calculus': 'https:\/\/ephemerent\.com\/assets\/og-journal-swc\.png'/);
});

test('publishes the intuitive News route while keeping the journal record private', () => {
  assert.doesNotMatch(sitemap, /journal\/article\/stochastic-witness-calculus/);
  assert.match(sitemap, /news\/stochastic-witness-calculus/);
  assert.match(sitemap, /journal\/preprint\/stochastic-witness-calculus/);
  assert.ok(vercel.rewrites.some((entry) => entry.source === '/news/stochastic-witness-calculus' && entry.destination === '/news-swc.html'));
  assert.ok(vercel.redirects.some((entry) => entry.source === '/news-swc.html' && entry.destination === '/news/stochastic-witness-calculus'));
  assert.ok(vercel.rewrites.some((entry) => entry.source === '/journal/preprint/stochastic-witness-calculus' && entry.destination === '/journal-swc.html'));
  assert.match(news, /"@type": "NewsArticle"/);
  assert.match(news, /data-swc-miss-lab/);
  assert.match(news, /genuine finite-domain theorem/);
  assert.match(news, /all 82,887 exact certificate rows reproduce/i);
  assert.match(news, /six stale manifest entries/i);
  assert.match(newsIndex, /href="\/news\/stochastic-witness-calculus"/);
  assert.match(rss, /https:\/\/ephemerent\.com\/news\/stochastic-witness-calculus/);
  assert.doesNotMatch(news, /(?:we|this (?:paper|work|method))\s+(?:prove|proved|proves)\s+(?:the\s+)?Erd[oő]s[-–— ]Straus/i);
  assert.match(preprint, /Public reconstructed preprint/);
  assert.match(preprint, /not peer-reviewed/i);
  assert.match(preprint, /genuine finite-domain theorem/);
  assert.match(preprint, /Full-support universal lifting/);
  assert.match(preprint, /Well-founded inductive witness lifting/);
  assert.match(preprint, /Erdős–Straus divisor lift/);
  assert.equal(preprintManifest.sha256, record.baselinePdf.sha256);
  assert.equal(preprintManifest.parentVersion.sha256, record.sourceV4.sha256);
  assert.equal(preprintManifest.constructionBase.sha256, record.sourceV3.sha256);
});
