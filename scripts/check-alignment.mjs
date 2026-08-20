#!/usr/bin/env node
/**
 * Column-alignment audit.
 *
 * A list whose rows each compute their own column widths reads as
 * sloppy long before anyone can name why: the eye follows the left
 * edge of the second column down the page and finds it moving. The
 * product list on the home page had twelve rows spread over 33px
 * because its last track was `auto` and sized to its own badge text.
 *
 * This walks every repeated-sibling group and reports where the same
 * column starts at materially different places across rows.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGES = (process.env.PAGES ?? '/,/research,/orrery,/vellum,/vespera,/shelterix,/journal,/news,/download,/organizations,/arbiter').split(',');
const TOLERANCE = 4;   // px; sub-pixel and rounding are not defects

const b = await chromium.launch();
const page = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const findings = [];

for (const path of PAGES) {
  const res = await page.goto(BASE+path,{waitUntil:'load'}).catch(()=>null);
  if (!res || res.status()>=400) continue;
  await page.evaluate(()=>document.querySelectorAll('.rv,.reveal').forEach(e=>e.classList.add('in')));
  await page.waitForTimeout(300);

  const found = await page.evaluate((tol)=>{
    const out=[];
    const seen=new Set();
    for (const parent of document.querySelectorAll('*')) {
      const kids=[...parent.children].filter(c=>{
        const cs=getComputedStyle(c), r=c.getBoundingClientRect();
        return cs.display!=='none' && r.height>8 && r.width>40;
      });
      if (kids.length<3) continue;
      /* Only rows that are siblings of the same shape: same tag, same
         first class, and each laid out as a grid or flex row. */
      const sig=k=>k.tagName+'|'+((typeof k.className==='string'?k.className:'').trim().split(/\s+/)[0]||'');
      const first=sig(kids[0]);
      const rows=kids.filter(k=>sig(k)===first);
      if (rows.length<3) continue;
      const cs0=getComputedStyle(rows[0]);
      if (!/grid|flex/.test(cs0.display)) continue;
      /* Only vertically stacked siblings are rows. Three cards sitting
         side by side in a pricing grid are SUPPOSED to have their
         children at different x, and the first version of this check
         reported every one of them at a 1000px "spread". A row list
         shares a left edge and descends. */
      const boxes=rows.map(r=>r.getBoundingClientRect());
      const lefts=boxes.map(x=>Math.round(x.left));
      if (Math.max(...lefts)-Math.min(...lefts) > tol) continue;
      const tops=boxes.map(x=>Math.round(x.top)).sort((a,b)=>a-b);
      let stacked=true;
      for (let i=1;i<tops.length;i++) if (tops[i]-tops[i-1] < 8) stacked=false;
      if (!stacked) continue;
      const key=parent.tagName+'.'+((typeof parent.className==='string'?parent.className:'').split(' ')[0])+'>'+first;
      if (seen.has(key)) continue;
      seen.add(key);

      const cols=Math.min(...rows.map(r=>r.children.length));
      if (cols<2) continue;
      for (let c=1;c<cols;c++){
        const boxes=rows.map(r=>r.children[c].getBoundingClientRect());
        const spreadOf=f=>{const v=boxes.map(b=>Math.round(f(b)));return Math.max(...v)-Math.min(...v);};
        /* A column is aligned if EITHER edge holds. A spec table's
           values right-align -- their left edges move by design, and
           the first two versions of this check reported all seven of
           them as defects. What is actually wrong is a column pinned
           to neither edge, which is what a stray `auto` track does. */
        const spread=Math.min(spreadOf(b=>b.left), spreadOf(b=>b.right));
        if (spread>tol) {
          out.push({ key, col:c+1, spread, rows:rows.length,
            template:getComputedStyle(rows[0]).gridTemplateColumns.slice(0,60) });
        }
      }
    }
    return out;
  }, TOLERANCE);

  for (const f of found) findings.push({ path, ...f });
}
await b.close();

findings.sort((a,b)=>b.spread-a.spread);
console.log(`check-alignment: ${findings.length} misaligned column(s) across ${PAGES.length} pages\n`);
for (const f of findings.slice(0,25)) {
  console.log(`  ${String(f.spread).padStart(4)}px  ${f.path.padEnd(16)} col ${f.col} of ${f.key.slice(0,44)} (${f.rows} rows)`);
  console.log(`         template: ${f.template}`);
}
