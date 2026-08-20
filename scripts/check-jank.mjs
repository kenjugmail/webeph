#!/usr/bin/env node
/**
 * Scroll smoothness measurement.
 *
 * "Smoother animations" is not a judgement you can make from a
 * screenshot. This scrolls the page the way a reader does and records
 * how long each frame took, so the answer is a number rather than an
 * impression. Anything over 16.7ms missed 60fps; over 33ms is visible
 * as a stutter.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGES = (process.env.PAGES ?? '/').split(',');

const b = await chromium.launch();
for (const path of PAGES) {
  const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
  await p.goto(BASE+path,{waitUntil:'load'});
  await p.waitForTimeout(700);

  await p.evaluate(()=>{
    window.__frames=[];
    let last=performance.now();
    const tick=t=>{ window.__frames.push(t-last); last=t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });

  // Scroll the way a reader does: many small steps, not one jump.
  const height = await p.evaluate(()=>document.documentElement.scrollHeight);
  const steps = 90;
  for (let i=0;i<steps;i++){
    await p.evaluate(y=>window.scrollTo(0,y), Math.round(i*(height-900)/steps));
    await p.waitForTimeout(16);
  }
  await p.waitForTimeout(200);

  const r = await p.evaluate(()=>{
    const f=window.__frames.slice(3).filter(x=>x>0&&x<400);
    f.sort((a,b)=>a-b);
    const pct=q=>f[Math.floor(f.length*q)];
    return { n:f.length, median:+pct(.5).toFixed(1), p90:+pct(.9).toFixed(1), p99:+pct(.99).toFixed(1),
      over16:f.filter(x=>x>16.7).length, over33:f.filter(x=>x>33).length, worst:+f[f.length-1].toFixed(1) };
  });
  const pctOver = (100*r.over16/r.n).toFixed(0);
  console.log(`${path.padEnd(12)} frames=${r.n}  median=${r.median}ms  p90=${r.p90}ms  p99=${r.p99}ms  worst=${r.worst}ms`);
  console.log(`${''.padEnd(12)} missed 60fps: ${r.over16} (${pctOver}%)   visible stutters (>33ms): ${r.over33}`);
  await p.close();
}
await b.close();
