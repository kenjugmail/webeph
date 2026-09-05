import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const routes = JSON.parse(read('vercel.json'));
assert(routes.rewrites.some(r => r.source === '/waitlist' && r.destination === '/waitlist.html'), 'Waitlist route missing');
assert(routes.redirects.some(r => r.source === '/waitlist/manage'), 'Owner shortcut missing');
const page = read('waitlist.html');
assert(page.includes('Ephemerent Intelligence'), 'Waitlist branding missing');
assert(page.includes('id="waitlist-form"'), 'Waitlist form missing');
assert(read('Ephemerent.html').includes('href="/waitlist"'), 'Homepage waitlist link missing');
assert(read('assets/waitlist.js').includes('/functions/v1/company-waitlist'), 'Protected submission endpoint missing');
for (const path of ['assets/waitlist.css', 'assets/company-ai.css', 'assets/company-ai-study.webp', 'assets/company-ai-study-768.webp']) {
  assert(readFileSync(new URL('../' + path, import.meta.url)).length > 0, `Missing asset: ${path}`);
}
console.log('Ephemerent Intelligence release: page, routes, homepage links, artwork and form endpoint present.');
