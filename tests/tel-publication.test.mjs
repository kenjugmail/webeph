import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'assets/research/tel/v1.3');
const read=filename=>readFile(path.join(root,filename),'utf8');
const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
const config=JSON.parse(await read('vercel.json'));
const sitemap=await read('sitemap.xml');const journal=await read('journal.html');const research=await read('research.html');
const sha=value=>createHash('sha256').update(value).digest('hex');

test('TEL release records preserve the research status and unproved universal claim',()=>{
  assert.equal(manifest.version,'1.3');assert.equal(manifest.RH_proved,false);
  assert.equal(manifest.novelty_priority_established,false);assert.equal(manifest.article_id,null);
  assert.equal(manifest.license,'All rights reserved');assert.equal(manifest.papers.length,2);
});
for(const paper of manifest.papers){
  test(`${paper.id}: published HTML, PDF and canonical source are bound to one version`,async()=>{
    const source=await readFile(path.join(directory,paper.source));
    const pdf=await readFile(path.join(directory,paper.pdf));const html=await read(paper.html);
    assert.equal(sha(source),paper.source_sha256);assert.equal(sha(pdf),paper.pdf_sha256);assert.equal(sha(html),paper.html_sha256);
    assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.equal(paper.pages,paper.id==='framework'?12:14);
    assert.equal((html.match(/class="tel-equation"/g)||[]).length,(source.toString().match(/^% eq:/gm)||[]).length);
    assert.equal((html.match(/class="tel-figure"/g)||[]).length,paper.figures.length);
    for(const line of source.toString().split('\n').filter(x=>x.startsWith('## ')))assert.ok(html.includes(line.slice(3)),`Missing section ${line}`);
    assert.ok(/Not peer-reviewed/.test(html),'Preprint status is missing');assert.ok(/All rights reserved/.test(html),'Rights statement is missing');
    assert.ok(html.includes('Authorship and assistance.'),'Authorship and assistance disclosure is missing');assert.ok(!/katex-error|TELTOKEN|NaN MB|ER-2026-\d{4}/.test(html),'Unexpected render placeholder or journal identifier');
    if(paper.id==='rh_application')assert.ok(html.includes('does not prove the Riemann hypothesis'),'RH result scope is missing');
    const structured=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(structured.author.name,'Kenju Tomita');assert.equal(structured.encoding.sha256,paper.pdf_sha256);
    assert.ok(config.rewrites.some(x=>x.source===paper.route&&x.destination===`/${paper.html}`));
    assert.ok(config.redirects.some(x=>x.source===`/${paper.html}`&&x.destination===paper.route));
    for(const page of [journal,research,sitemap])assert.ok(page.includes(paper.route));
    for(const companion of manifest.papers.filter(x=>x!==paper))assert.ok(html.includes(`href="${companion.route}"`));
    for(const figure of paper.figures)await readFile(path.join(directory,paper.id,'assets',figure));
    const cover=await readFile(path.join(root,`assets/og-tel-${paper.id==='framework'?'framework':'riemann'}.png`));
    assert.deepEqual([cover.readUInt32BE(16),cover.readUInt32BE(20)],[1200,630]);
  });
}
test('the complete research package is checksummed and every page exposes the same download',async()=>{
  const zip=await readFile(path.join(directory,manifest.supplement.filename));
  assert.equal(zip.length,manifest.supplement.bytes);assert.equal(sha(zip),manifest.supplement.sha256);
  assert.equal(zip.subarray(0,2).toString(),'PK');
  for(const paper of manifest.papers)assert.ok((await read(paper.html)).includes(manifest.supplement.filename));
});
