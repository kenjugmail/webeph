import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {previewServer,root} from './preview-tel.mjs';

const out=path.join(root,'output/tel-publication');await mkdir(out,{recursive:true});
const {server,url}=await previewServer();
const browser=await chromium.launch({headless:true});
const results=[];
try{
  const coverPage=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  for(const name of ['framework','riemann']){
    await coverPage.goto(`${url}/assets/og-tel-${name}.svg`);
    await coverPage.screenshot({path:path.join(root,`assets/og-tel-${name}.png`)});
  }
  await coverPage.close();
  const manifest=JSON.parse(await readFile(path.join(root,'assets/research/tel/v1.3/manifest.json'),'utf8'));
  for(const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844}]){
    for(const paper of manifest.papers){
      const context=await browser.newContext({viewport,permissions:['clipboard-read','clipboard-write']});
      const page=await context.newPage();const failures=[];
      page.on('pageerror',e=>failures.push(e.message));
      page.on('requestfailed',r=>failures.push(`${r.url()}: ${r.failure()?.errorText}`));
      page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
      await page.goto(url+paper.route,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('h1').textContent(),paper.title);
      assert.equal(await page.locator('.tel-equation').count(),paper.equations);
      assert.equal(await page.locator('.tel-figure').count(),paper.figures.length);
      assert.equal(await page.locator('.katex-error').count(),0);
      assert.match(await page.locator('.tel-status').innerText(),/Not peer-reviewed/i);
      await page.getByRole('button',{name:'Copy citation',exact:true}).click();
      await page.getByText('Citation copied.',{exact:true}).waitFor();
      assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/Kenju Tomita \(2026\)/);
      if(viewport.width<=820){
        const menu=page.getByRole('button',{name:'Menu',exact:true});
        if(await menu.isVisible()){
          await menu.click();assert.equal(await menu.getAttribute('aria-expanded'),'true');
          await page.locator('#tel-navigation').waitFor({state:'visible'});
          await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');
        }
      }
      await page.screenshot({path:path.join(out,`${paper.id}-${viewport.width}-top.png`)});
      await page.locator('.tel-equation').first().scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,`${paper.id}-${viewport.width}-math.png`)});
      const refs=page.locator('#references');await refs.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,`${paper.id}-${viewport.width}-references.png`)});
      // Load each lazy figure and inspect its decoded image rather than just its URL.
      for(const figure of await page.locator('.tel-figure img').all()){
        await figure.scrollIntoViewIfNeeded();await figure.evaluate(img=>img.decode());
        assert.ok(await figure.evaluate(img=>img.naturalWidth>0));
      }
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      assert.ok(overflow<=1,`${paper.id} ${viewport.width}: ${overflow}px document overflow`);
      for(const extension of ['.pdf','.zip','source.md']){
        const href=await page.locator(`a[href$="${extension}"]`).first().getAttribute('href');
        const response=await context.request.head(url+href);assert.equal(response.status(),200);
      }
      assert.deepEqual(failures,[]);
      results.push({paper:paper.id,width:viewport.width,overflow,equations:paper.equations,figures:paper.figures.length,errors:failures});
      await context.close();
    }
  }
  for(const route of ['/journal','/research']){
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await page.goto(url+route,{waitUntil:'domcontentloaded'});
    for(const paper of manifest.papers)assert.ok(await page.locator(`a[href="${paper.route}"]`).count());
    await page.locator(route==='/journal'?'.jr-preprint-shelf':'#tel-preprints').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,`${route.slice(1)}-preprints.png`)});
    await page.close();
  }
  await writeFile(path.join(out,'browser-results.json'),JSON.stringify({status:'pass',results},null,2)+'\n');
  console.log(`TEL browser checks passed: ${results.length} paper/viewport combinations; navigation, clipboard, images and downloads.`);
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
