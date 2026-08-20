#!/usr/bin/env node
/**
 * Capture both faces of the key surfaces, for looking at.
 *
 * The automated checks answer whether the page is correct. They cannot
 * answer whether it is any good, and that question still needs eyes.
 *
 *   node scripts/shoot.mjs        # writes .artifacts/shots/<page>-<face>.png
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE='http://localhost:3111';
mkdirSync('.artifacts/shots',{recursive:true});
const browser=await chromium.launch();
for (const mode of ['light','dark']) {
  const ctx=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});
  await ctx.addInitScript(m=>{try{localStorage.setItem('eph-mode',m)}catch(e){}},mode);
  const page=await ctx.newPage();
  for (const [p,name] of [['/','home'],['/orrery','orrery'],['/journal','journal'],['/vespera','vespera']]) {
    await page.goto(BASE+p,{waitUntil:'load'});
    await page.evaluate(()=>document.querySelectorAll('.rv,.reveal').forEach(e=>e.classList.add('in')));
    await page.waitForTimeout(400);
    await page.screenshot({path:`.artifacts/shots/${name}-${mode}.png`, clip:{x:0,y:0,width:1280,height:760}});
  }
  await ctx.close();
}
await browser.close();
console.log('shots written to .artifacts/shots/');
