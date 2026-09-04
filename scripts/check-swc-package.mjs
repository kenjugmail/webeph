#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const record = JSON.parse(await readFile(join(root, 'research/stochastic-witness-calculus/publication.json'), 'utf8'));
const args = process.argv.slice(2);
const packageArg = args.includes('--package') ? args[args.indexOf('--package') + 1] : process.env.SWC_PACKAGE;
const strict = args.includes('--strict') || Boolean(packageArg);
const baselinePath = process.env.SWC_PDF || join(root, 'assets/research/stochastic-witness-calculus-v4-1.pdf');

const errors = [];
const notes = [];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function checkRecord() {
  if (record.schemaVersion !== 1) errors.push('unsupported publication schema');
  if (record.slug !== 'stochastic-witness-calculus') errors.push('stable article slug changed');
  if (record.articleType !== 'Original research') errors.push('article type must be Original research');
  if (record.authors?.length !== 1 || record.authors[0]?.name !== 'Kenju Tomita') errors.push('Kenju Tomita must remain the sole author');
  const affiliations = record.authors?.[0]?.affiliations || [];
  if (!affiliations.includes('Rochester Institute of Technology') || !affiliations.includes('Ephemerent Research')) errors.push('required affiliations are missing');
  if (record.licenses?.articleFiguresAndNumericalData !== 'CC BY 4.0') errors.push('article license changed');
  if (record.licenses?.originalCode !== 'Apache-2.0') errors.push('code license changed');
  if (typeof record.releaseGates?.completePackageReceived !== 'boolean') errors.push('package receipt gate must be explicit');
}

async function checkPdf(path) {
  if (!await exists(path)) {
    errors.push(`baseline PDF missing: ${path}`);
    return;
  }
  const buffer = await readFile(path);
  if (sha256(buffer) !== record.baselinePdf.sha256) errors.push('baseline PDF SHA-256 does not match the audited value');
  let info = '';
  let text = '';
  try {
    info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
    try {
      text = execFileSync('pdftotext', [path, '-'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    } catch {
      const extractor = 'from pypdf import PdfReader\nimport sys\nprint("\\n".join((p.extract_text() or "") for p in PdfReader(sys.argv[1]).pages))';
      text = execFileSync('python3', ['-c', extractor, path], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    }
  } catch (error) {
    errors.push(`PDF inspection failed: ${error.message}`);
    return;
  }
  if (!new RegExp(`^Pages:\\s+${record.baselinePdf.pages}$`, 'm').test(info)) errors.push(`baseline PDF must have ${record.baselinePdf.pages} pages`);
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  if (!normalizedText.includes(record.title)) errors.push('authoritative PDF title is missing or changed');
  const checkpoints = ['27,810', '82,887', 'n = 2048', '0.9900', '0.9048', '300', '1,800', 'c = 107', '4.342%', '30.826%', '97.738%', '99.946%'];
  checkpoints.forEach((value) => { if (!text.includes(value)) errors.push(`PDF claim checkpoint missing: ${value}`); });
  const dangerous = [
    /(?:we|this (?:paper|work|method))\s+(?:prove|proved|proves)\s+(?:the\s+)?Erd[oő]s[-–— ]Straus/i,
    /Erd[oő]s[-–— ]Straus[^.]{0,80}\b(?:is|has been)\s+(?:officially\s+)?(?:proved|solved)/i,
    /officially\s+proved/i,
  ];
  dangerous.forEach((pattern) => { if (pattern.test(text)) errors.push(`forbidden universal-claim wording found: ${pattern}`); });
  if (!/finite verification[^.]{0,180}(?:not|does not)[^.]{0,80}(?:proof|prove)/i.test(text)) errors.push('finite-verification limitation is not explicit in the PDF');
  notes.push(`PDF baseline verified · ${record.baselinePdf.pages} pages · ${record.baselinePdf.sha256}`);
}

async function checkPackage(directory) {
  const packageRoot = resolve(directory);
  if (!await exists(packageRoot) || !(await stat(packageRoot)).isDirectory()) {
    errors.push(`package directory not found: ${packageRoot}`);
    return;
  }
  const files = await walk(packageRoot);
  const normalized = files.map((path) => relative(packageRoot, path).replaceAll('\\', '/'));
  for (const group of record.requiredPackageGroups) {
    const pattern = new RegExp(group.filenamePattern, 'i');
    if (!normalized.some((name) => pattern.test(name))) errors.push(`missing package group: ${group.description}`);
  }
  for (const path of files) {
    const name = relative(packageRoot, path).replaceAll('\\', '/');
    const details = await stat(path);
    if (details.size > 50 * 1024 * 1024) notes.push(`external-release-only (>50 MiB): ${name}`);
    if (/(^|\/)\.\.?($|\/)|[\u0000-\u001f]/.test(name)) errors.push(`unsafe package filename: ${name}`);
  }
  const pdfCandidates = files.filter((path) => /\.pdf$/i.test(path));
  let matchingPdf = '';
  for (const path of pdfCandidates) {
    if (sha256(await readFile(path)) === record.baselinePdf.sha256) matchingPdf = path;
  }
  if (!matchingPdf) errors.push('the package does not contain the audited final PDF byte-for-byte');
  const manifestFiles = files.filter((path) => /(sha256|checksum|manifest)/i.test(basename(path)) && /\.(txt|sha256|json|csv)$/i.test(path));
  if (manifestFiles.length < 2) errors.push('both delivery and internal checksum manifests are required');
  const hashLines = [];
  for (const manifest of manifestFiles) {
    const body = await readFile(manifest, 'utf8');
    hashLines.push(...body.split(/\r?\n/).map((line) => line.match(/^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/)).filter(Boolean));
  }
  if (!hashLines.length) errors.push('checksum manifests contain no parseable SHA-256 entries');
  let verifiedManifestEntries = 0;
  for (const match of hashLines) {
    const referenced = resolve(packageRoot, match[2]);
    if (!referenced.startsWith(`${packageRoot}/`) || !await exists(referenced)) continue;
    const actual = sha256(await readFile(referenced));
    if (actual !== match[1].toLowerCase()) errors.push(`checksum mismatch: ${relative(packageRoot, referenced)}`);
    else verifiedManifestEntries += 1;
  }
  if (hashLines.length && verifiedManifestEntries < 1) errors.push('checksum manifests do not resolve to any package file');
  notes.push(`package inventory read · ${files.length} files · ${manifestFiles.length} checksum manifests`);
  if (matchingPdf) notes.push(`package PDF matches audited baseline · ${relative(packageRoot, matchingPdf)}`);
  if (verifiedManifestEntries) notes.push(`checksum entries verified · ${verifiedManifestEntries}`);
  notes.push('source compilation and reproduction commands remain a separate isolated execution gate; this preflight never executes submitted scripts');
}

checkRecord();
await checkPdf(baselinePath);
if (packageArg) await checkPackage(packageArg);
else notes.push('JOURNAL BLOCKED · package reconciliation, source compilation, peer review, and human publication gates remain incomplete');

notes.forEach((note) => console.log(note));
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR · ${error}`));
  process.exitCode = 1;
} else if (strict && !packageArg) {
  console.error('ERROR · strict preflight requires --package <directory> or SWC_PACKAGE');
  process.exitCode = 1;
} else {
  console.log(packageArg ? 'SWC package preflight: PRESENT · execution and review gates still required' : 'SWC public preprint: READY · accepted journal publication remains blocked');
}
