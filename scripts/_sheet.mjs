import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('.artifacts/shots',{recursive:true});
const PAGES = (process.env.PAGES ?? '/,/orrery,/journal,/vespera').split(',');
const b = await chromium.launch();
for (const look of ['light','dark','glass']) {
  const ctx = await b.newContext({viewport:{width:1440,height:900}});
  await ctx.addInitScript(l=>{try{
    localStorage.setItem('eph-mode', l==='glass'?'dark':l);
    if(l==='glass') localStorage.setItem('eph-material','glass'); else localStorage.removeItem('eph-material');
  }catch(e){}}, look);
  const p = await ctx.newPage();
  for (const path of PAGES) {
    await p.goto('http://localhost:3111'+path,{waitUntil:'load'});
    await p.evaluate(()=>document.querySelectorAll('.rv,.reveal').forEach(e=>e.classList.add('in')));
    await p.waitForTimeout(look==='glass'?650:450);
    const name = path.replace(/\//g,'_')||'_home';
    await p.screenshot({path:`.artifacts/shots/sheet${name}-${look}.png`});
  }
  await ctx.close();
}
await b.close(); console.log('contact sheet written');
