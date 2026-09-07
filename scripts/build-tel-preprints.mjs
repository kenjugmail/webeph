import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import katex from 'katex';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const VERSION='1.3';
const BASE=`/assets/research/tel/v${VERSION}`;
const directory=path.join(ROOT,BASE);
const manifestPath=path.join(directory,'manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const slug=s=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function parse(source){
  const lines=source.split(/\r?\n/);let i=1;const meta={};
  while(lines[i]!=='---'){const at=lines[i].indexOf(':');meta[lines[i].slice(0,at)]=lines[i].slice(at+1).trim();i++;}
  i++;const blocks=[];const labels=new Map();let equation=0;
  while(i<lines.length){
    const line=lines[i].trim();if(!line){i++;continue;}
    if(line==='$$'){
      const pieces=[];let label='';i++;
      while(i<lines.length&&lines[i].trim()!=='$$'){
        if(lines[i].trim().startsWith('% eq:'))label=lines[i].trim().slice(5);
        else pieces.push(lines[i].trim());i++;
      }
      if(!label||i>=lines.length)throw Error('Invalid display equation');
      equation++;labels.set(label,equation);blocks.push({kind:'equation',label,number:equation,tex:pieces.join(' ')});i++;continue;
    }
    if(line.startsWith('### ')){blocks.push({kind:'subheading',text:line.slice(4)});i++;continue;}
    if(line.startsWith('## ')){blocks.push({kind:'heading',text:line.slice(3),id:slug(line.slice(3))});i++;continue;}
    if(line.startsWith('![')){
      const m=line.match(/^!\[(.*)\]\((.*)\)$/);if(!m)throw Error('Invalid figure');
      blocks.push({kind:'figure',caption:m[1],file:m[2]});i++;continue;
    }
    if(line.startsWith('|')){
      const rows=[];while(i<lines.length&&lines[i].trim().startsWith('|')){
        const cells=lines[i].trim().replace(/^\||\|$/g,'').split('|').map(s=>s.trim());
        if(!cells.every(x=>/^:?-+:?$/.test(x)))rows.push(cells);i++;
      }blocks.push({kind:'table',rows});continue;
    }
    const paragraph=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!/^(##|\$\$|!\[|\|)/.test(lines[i]))paragraph.push(lines[i++].trim());
    blocks.push({kind:'paragraph',text:paragraph.join(' ')});
  }
  for(const block of blocks)for(const field of ['text','caption'])if(block[field]){
    block[field]=block[field].replace(/@eq:([a-z]+)/g,(_,name)=>{if(!labels.has(name))throw Error(`Unknown equation ${name}`);return `(${labels.get(name)})`;});
  }
  return {meta,blocks,equations:equation};
}

function math(tex,display=false){
  return katex.renderToString(tex,{displayMode:display,output:'htmlAndMathml',throwOnError:true,trust:false,strict:'error'});
}
function inline(text){
  const saved=[];const keep=s=>{saved.push(s);return `TELTOKEN${saved.length-1}END`;};
  text=text.replace(/\$([^$]+)\$/g,(_,tex)=>keep(`<span class="tel-inline-math">${math(tex)}</span>`));
  text=text.replace(/`([^`]+)`/g,(_,code)=>keep(`<code>${esc(code)}</code>`));
  text=text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,(_,label,url)=>keep(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`));
  text=esc(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  saved.forEach((value,index)=>{text=text.replaceAll(`TELTOKEN${index}END`,value);});
  return text;
}

function bodyHTML(blocks,paper){
  const content=[];let opened=false;let refs=false;
  for(const block of blocks){
    if(block.kind==='heading'){
      if(refs){content.push('</ol>');refs=false;}if(opened)content.push('</section>');
      content.push(`<section class="tel-section" id="${block.id}" data-tel-section><h2>${inline(block.text)}</h2>`);opened=true;
      if(block.text==='References'){content.push('<ol class="tel-references">');refs=true;}
    } else if(block.kind==='subheading')content.push(`<h3>${inline(block.text)}</h3>`);
    else if(block.kind==='paragraph'){
      if(refs){const m=block.text.match(/^\[(\d+)\]\s*(.*)$/);if(!m)throw Error('Invalid reference');content.push(`<li id="ref-${m[1]}" value="${m[1]}">${inline(m[2])}</li>`);}
      else content.push(`<p>${inline(block.text)}</p>`);
    } else if(block.kind==='equation'){
      const parts=block.tex.split('\\\\').map(s=>s.trim()).filter(Boolean);
      content.push(`<figure class="tel-equation" id="eq-${block.label}" aria-label="Equation ${block.number}"><div class="tel-equation-scroll">${parts.map(tex=>math(tex,true)).join('')}</div><figcaption>(${block.number})</figcaption></figure>`);
    } else if(block.kind==='figure'){
      if(!block.file.startsWith('assets/')||block.file.includes('..'))throw Error('Unsafe figure path');
      const file=`${BASE}/${paper.id}/${block.file}`;
      if(!fs.existsSync(path.join(ROOT,file)))throw Error(`Missing figure ${file}`);
      content.push(`<figure class="tel-figure"><a href="${file}" target="_blank" rel="noopener"><img src="${file}" alt="${esc(block.caption)}" loading="lazy" decoding="async"></a><figcaption>${inline(block.caption)}</figcaption></figure>`);
    } else if(block.kind==='table'){
      content.push('<div class="tel-table-scroll"><table><thead><tr>'+block.rows[0].map(c=>`<th scope="col">${inline(c)}</th>`).join('')+'</tr></thead><tbody>'+block.rows.slice(1).map(row=>'<tr>'+row.map(c=>`<td>${inline(c)}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>');
    }
  }
  if(refs)content.push('</ol>');if(opened)content.push('</section>');return content.join('\n');
}

for(const paper of manifest.papers){
  const raw=fs.readFileSync(path.join(directory,paper.source));
  if(sha(raw)!==paper.source_sha256)throw Error('Source hash mismatch');
  const {meta,blocks,equations}=parse(raw.toString('utf8'));
  if(meta.title!==paper.title||meta.subtitle!==paper.subtitle)throw Error('Title mismatch');
  const isRH=paper.id==='rh_application';
  const companion=manifest.papers.find(x=>x.id!==paper.id);
  const summary=isRH
    ?'Exact certificates through N=8,192, sharper periodic tail bounds, and two additional verified contraction steps in a custom descent-based domain. RH remains unproved.'
    :'A proposed framework for learned inference, energy-guided search, and checkable witnesses, with adaptive-discovery guarantees and finite experiments.';
  const findings=isRH
    ?[['8,192','Largest certified basis'],['2','Additional finite contraction steps'],['95.1%','Narrower finite-optimum interval at N=4,096']]
    :[['70','Finite rule-training splits'],['45','Satisfiable random instances'],['656.6×','Median accepted-mass gain; seven regressions']];
  const notice=isRH
    ?'<strong>Scope of the result.</strong> The title states the research objective. This preprint does not prove the Riemann hypothesis. It reports finite certificates and a conditional implication whose transfer premise remains unproved.'
    :'<strong>Scope of the result.</strong> TEL is a proposed research framework. The experiments have finite Boolean scope; they do not establish a replacement for mathematical logic, a runtime speedup, or superiority over existing research.';
  const url=`https://ephemerent.com${paper.route}`;
  const cover=`/assets/og-tel-${isRH?'riemann':'framework'}.png`;
  const citation=`Kenju Tomita (2026). ${meta.title}: ${meta.subtitle}. Version ${VERSION}. Ephemerent Research, preprint. ${url}`;
  const structured={'@context':'https://schema.org','@type':'ScholarlyArticle',headline:meta.title,name:meta.title,
    description:summary,url,datePublished:manifest.date,dateModified:manifest.date,version:VERSION,
    creativeWorkStatus:isRH?'Public preprint; not peer-reviewed; RH remains unproved':'Public research preprint; not peer-reviewed',
    isAccessibleForFree:true,inLanguage:'en',copyrightYear:2026,copyrightNotice:'Copyright 2026 Kenju Tomita. All rights reserved.',
    copyrightHolder:{'@type':'Person',name:manifest.author},author:{'@type':'Person',name:manifest.author},
    publisher:{'@type':'Organization',name:'Ephemerent Research',url:'https://ephemerent.com/journal'},
    encoding:{'@type':'MediaObject',contentUrl:`https://ephemerent.com${BASE}/${paper.pdf}`,encodingFormat:'application/pdf',sha256:paper.pdf_sha256}};
  const toc=blocks.filter(x=>x.kind==='heading').map(x=>`<li><a href="#${x.id}">${esc(x.text)}</a></li>`).join('');
  const output=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(meta.title)} · Ephemerent Research</title>
<meta name="description" content="${esc(summary)}"><meta name="author" content="Kenju Tomita">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="manifest" href="/site.webmanifest">
<link rel="canonical" href="${url}"><meta name="theme-color" content="#f6f2e9">
<meta property="og:type" content="article"><meta property="og:site_name" content="Ephemerent Research">
<meta property="og:title" content="${esc(meta.title)}"><meta property="og:description" content="${esc(summary)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="https://ephemerent.com${cover}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(isRH?'TEL and RH: finite results; RH remains unproved':'Tomita Energy Logic research preprint by Kenju Tomita')}">
<meta property="article:published_time" content="${manifest.date}"><meta property="article:modified_time" content="${manifest.date}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(summary)}"><meta name="twitter:image" content="https://ephemerent.com${cover}">
<link rel="preload" href="/assets/fonts/newsreader-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/tokens.css?v=20260822a"><link rel="stylesheet" href="/assets/journal.css?v=20260904a">
<link rel="stylesheet" href="/assets/vendor/katex/katex.min.css"><link rel="stylesheet" href="/assets/tel-paper.css?v=1.3">
<script type="application/ld+json">${JSON.stringify(structured).replaceAll('<','\\u003c')}</script>
</head>
<body class="jr-page tel-page" data-tel-paper="${paper.id}">
<a class="jr-skip" href="#paper">Skip to paper</a><div class="tel-progress" aria-hidden="true"><span data-tel-progress></span></div>
<header class="jr-header"><div class="jr-header-inner">
<a class="jr-masthead-link" href="/journal" aria-label="Ephemerent Research home"><span class="jr-masthead-mark" aria-hidden="true"></span><span><span class="jr-masthead-name">Ephemerent Research</span><span class="jr-masthead-sub">Research preprints · est. 2026</span></span></a>
<button class="jr-menu-button" type="button" aria-expanded="false" aria-controls="tel-navigation"><span>Menu</span><span class="jr-menu-mark" aria-hidden="true"></span></button>
<nav class="jr-nav" id="tel-navigation" aria-label="Research navigation"><a href="/journal">Journal</a><a href="/research">Research</a><a href="${manifest.papers[0].route}"${!isRH?' aria-current="page"':''}>TEL</a><a href="${manifest.papers[1].route}"${isRH?' aria-current="page"':''}>RH application</a><a href="/journal/policies">Policies</a></nav>
</div></header>
<main id="paper"><article>
<header class="tel-hero"><div class="jr-container">
<div class="tel-status"><span>Research preprint · Paper ${isRH?'II':'I'}</span><strong>Not peer-reviewed</strong><span>Version ${VERSION} · ${paper.pages} pages · 7 September 2026</span></div>
<div class="tel-hero-grid"><div>
<p class="tel-kicker">The Tomita research program</p><h1 class="tel-title">${esc(meta.title)}</h1>
<p class="tel-subtitle">${esc(meta.subtitle)}</p><p class="tel-deck">${esc(summary)}</p>
<p class="tel-author"><strong>Kenju Tomita</strong><span>Published as a research preprint by Ephemerent Research</span></p>
<div class="tel-actions"><a class="jr-button jr-button-primary" href="${BASE}/${paper.pdf}" target="_blank" rel="noopener">Read PDF <span aria-hidden="true">↗</span></a><a class="jr-button" href="${BASE}/${manifest.supplement.filename}" download>Source &amp; experiments <span>${(manifest.supplement.bytes/1e6).toFixed(1)} MB</span></a><button class="jr-button" type="button" data-tel-copy>Copy citation</button></div>
<p class="tel-copy-status" data-tel-copy-status aria-live="polite"></p>
</div><aside class="tel-register" aria-label="Preprint record"><p>Record</p><dl>
<div><dt>Review status</dt><dd>Not peer-reviewed</dd></div><div><dt>Journal identifier</dt><dd>Not assigned: preprint</dd></div>
<div><dt>Article rights</dt><dd>All rights reserved</dd></div><div><dt>Companion paper</dt><dd><a href="${companion.route}">${isRH?'Tomita Energy Logic framework':'Applying TEL to the Riemann hypothesis'} <span aria-hidden="true">→</span></a></dd></div>
<div><dt>Canonical record</dt><dd><a href="${BASE}/manifest.json">Version manifest and checksums</a></dd></div>
</dl></aside></div>
<div class="tel-scope" role="note">${notice}</div>
<dl class="tel-findings" aria-label="Selected results">${findings.map(([value,label])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
</div></header>
<div class="jr-container tel-layout">
<aside class="tel-rail"><details open><summary>Contents</summary><ol>${toc}</ol></details>
<div class="tel-rail-links"><a href="${BASE}/${paper.source}" download>Editable Markdown</a><a href="${BASE}/${paper.pdf}" target="_blank" rel="noopener">Canonical PDF</a><a href="${companion.route}">Read companion paper</a></div></aside>
<div class="tel-body" data-tel-fulltext data-tel-equations="${equations}">${bodyHTML(blocks,paper)}
<section class="tel-section tel-end" id="research-files"><h2>Research files</h2><p>This complete HTML edition is generated from the same canonical source as the PDF. The source package contains both papers, code, exact certificates, and experiment records. The papers' stated limitations remain part of the record.</p>
<div class="tel-actions"><a class="jr-button jr-button-primary" href="${BASE}/${paper.pdf}" target="_blank" rel="noopener">Read canonical PDF</a><a class="jr-button" href="${BASE}/${manifest.supplement.filename}" download>Download research package</a></div>
<details class="tel-integrity"><summary>PDF SHA-256</summary><code>${paper.pdf_sha256}</code></details></section>
</div></div>
</article></main>
<footer class="jr-footer"><div class="jr-container"><div class="jr-footer-base jr-footer-base-compact"><span><a href="/journal">← Ephemerent Research</a></span><span>Preprint · not peer-reviewed · <a href="/journal/policies">Policies</a></span></div><div class="jr-footer-legal">Copyright 2026 Kenju Tomita. All rights reserved. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></div></div></footer>
<script type="application/json" id="tel-citation">${JSON.stringify({citation}).replaceAll('<','\\u003c')}</script>
<script src="/assets/tel-paper.js?v=1.3" defer></script>
</body></html>\n`;
  fs.writeFileSync(path.join(ROOT,paper.html),output);
  paper.equations=equations;paper.html_sha256=sha(Buffer.from(output));paper.source_blocks=blocks.length;
}

const katexDir=path.join(ROOT,'node_modules/katex');
const vendor=path.join(ROOT,'assets/vendor/katex');fs.mkdirSync(vendor,{recursive:true});
fs.copyFileSync(path.join(katexDir,'dist/katex.min.css'),path.join(vendor,'katex.min.css'));
fs.cpSync(path.join(katexDir,'dist/fonts'),path.join(vendor,'fonts'),{recursive:true});
fs.copyFileSync(path.join(katexDir,'LICENSE'),path.join(vendor,'LICENSE'));
manifest.math_renderer={name:'KaTeX',version:katex.version,mode:'static HTML and MathML',license:'MIT'};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');

function cover(name,titleLines,subtitle,scope){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f6f2e9"/><path d="M64 94H1136M64 549H1136" stroke="#101a2a" stroke-width="2"/><text x="64" y="62" fill="#1c3e99" font-family="monospace" font-size="22" letter-spacing="3">EPHEMERENT RESEARCH / PREPRINT</text>${titleLines.map((line,i)=>`<text x="64" y="${205+i*86}" fill="#101a2a" font-family="Georgia,serif" font-size="70">${esc(line)}</text>`).join('')}<text x="66" y="405" fill="#2e394b" font-family="Georgia,serif" font-size="31">${esc(subtitle)}</text><text x="66" y="480" fill="#a34335" font-family="Arial,sans-serif" font-size="25">${esc(scope)}</text><text x="64" y="593" fill="#626b78" font-family="monospace" font-size="21">KENJU TOMITA · VERSION 1.3 · NOT PEER-REVIEWED</text></svg>`;
  fs.writeFileSync(path.join(ROOT,`assets/og-tel-${name}.svg`),svg);
}
cover('framework',['Tomita Energy Logic'],'Learned inference. Independently checkable claims.','Finite experiments; a proposed research framework.');
cover('riemann',['Applying TEL to the','Riemann Hypothesis'],'A custom descent-based domain','Finite results and a conditional argument. RH remains unproved.');
console.log(`Built ${manifest.papers.length} complete TEL HTML preprints with ${manifest.papers.reduce((s,p)=>s+p.equations,0)} display equations.`);
