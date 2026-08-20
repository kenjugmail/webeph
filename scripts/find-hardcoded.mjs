#!/usr/bin/env node
/**
 * For each low-contrast element, report the CSS rule that set its colour
 * and whether that value is a literal rather than a token.
 *
 * Contrast failures in a counterpart mode are almost always a hardcoded
 * hex that assumed one ground. Fixing the rule fixes every element it
 * covers, so this reports causes rather than symptoms.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3111';
const PAGES = (process.env.PAGES ?? '/orrery,/vellum,/shelterix,/organizations,/security,/slack,/cloud,/download,/signin,/vespera,/journal,/news,/research,/').split(',');
const MODES = ['light', 'dark'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const causes = new Map();

for (const mode of MODES) {
  for (const path of PAGES) {
    const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => null);
    if (!res || res.status() >= 400) continue;
    await page.evaluate((m) => {
      document.documentElement.dataset.mode = m;
      document.querySelectorAll('.rv, .reveal').forEach((el) => el.classList.add('in'));
    }, mode);
    await page.waitForTimeout(100);

    const found = await page.evaluate(() => {
      const parse = (c) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const alpha = (c) => { const p = c.match(/[\d.]+/g); return p && p.length > 3 ? Number(p[3]) : 1; };
      const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      const backdrop = (el) => { let n = el; while (n && n !== document.documentElement) { const bg = getComputedStyle(n).backgroundColor; if (bg && bg !== 'transparent' && alpha(bg) > 0.85) return parse(bg); n = n.parentElement; } return parse(getComputedStyle(document.body).backgroundColor); };

      /* Collect every rule that could set colour, with its layer and file. */
      const colorRules = [];
      for (const sheet of document.styleSheets) {
        const file = (sheet.href || 'inline').split('/').pop().split('?')[0];
        try {
          const walk = (rules, layer) => {
            for (const r of rules) {
              if (r.constructor.name === 'CSSLayerBlockRule') { walk(r.cssRules, r.name || '(anon)'); continue; }
              if (r.cssRules && !r.selectorText) { walk(r.cssRules, layer); continue; }
              if (r.selectorText && r.style && r.style.color) {
                colorRules.push({ sel: r.selectorText, value: r.style.color, file, layer: layer || 'unlayered' });
              }
            }
          };
          walk(sheet.cssRules, null);
        } catch (e) { /* cross-origin */ }
      }

      const out = [];
      for (const el of document.querySelectorAll('p,li,a,h1,h2,h3,h4,span,button,td,th,label,small,strong,b')) {
        const text = (el.textContent ?? '').trim();
        if (!text || el.children.length > 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.6) continue;
        if (cs.clip !== 'auto' || cs.clipPath !== 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0) continue;
        let over = el, onImage = false;
        while (over && over !== document.documentElement) {
          const o = getComputedStyle(over);
          if (o.backgroundImage && o.backgroundImage !== 'none' && !o.backgroundImage.startsWith('linear-gradient')) { onImage = true; break; }
          over = over.parentElement;
        }
        if (onImage) continue;

        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
        const rt = ratio(parse(cs.color), backdrop(el));
        if (rt >= (large ? 3 : 4.5)) continue;

        /* Last matching colour rule wins, near enough for diagnosis. */
        let winner = null;
        for (const cr of colorRules) {
          try { if (el.matches(cr.sel)) winner = cr; } catch (e) { /* :has etc */ }
        }
        out.push({
          ratio: +rt.toFixed(2),
          rule: winner ? `${winner.file} [${winner.layer}]  ${winner.sel.slice(0, 70)}` : '(inline or inherited)',
          value: winner ? winner.value : cs.color,
          literal: winner ? !winner.value.includes('var(') : true,
          sample: text.slice(0, 24),
        });
      }
      return out;
    });

    for (const f of found) {
      const key = f.rule + ' => ' + f.value;
      const prev = causes.get(key) ?? { n: 0, worst: 99, literal: f.literal, where: new Set(), sample: f.sample };
      prev.n++;
      prev.worst = Math.min(prev.worst, f.ratio);
      prev.where.add(`${mode}:${path}`);
      causes.set(key, prev);
    }
  }
}
await browser.close();

const rows = [...causes.entries()].sort((a, b) => b[1].n - a[1].n);
const lit = rows.filter(([, v]) => v.literal);
console.log(`${rows.length} distinct rules cause contrast failures; ${lit.length} use a literal colour\n`);
console.log('--- literal colours (fix these first) ---');
for (const [k, v] of lit) console.log(`  x${String(v.n).padEnd(3)} worst ${String(v.worst).padEnd(5)} ${k}\n        seen in ${[...v.where].slice(0, 4).join(', ')}`);
console.log('\n--- token-based but still failing (palette needs tuning) ---');
for (const [k, v] of rows.filter(([, v]) => !v.literal)) console.log(`  x${String(v.n).padEnd(3)} worst ${String(v.worst).padEnd(5)} ${k}`);
