import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
function config(name = 'assets/site-config.js') {
  const context = { window: { location: { origin: 'https://ephemerent.com' } } };
  vm.runInNewContext(read(name), context);
  return context.window.ORRERY_CONFIG;
}
test('website feed resolves to the designated public binary bucket', () => {
  const cfg = config();
  assert.equal(cfg.UPDATE_FEED_URL, 'https://ephemerent.com/downloads/orrery/rc/');
  const routes = JSON.parse(read('vercel.json'));
  const route = routes.redirects.find(item => item.source === '/downloads/orrery/:path*');
  assert.equal(route.destination, 'https://wjjthkqwcyahamhjkeux.supabase.co/storage/v1/object/public/orrery-releases/:path*');
  assert.equal(route.permanent, false);
});
test('availability requires website asset URLs and a checksum; pending states advertise no artifact', () => {
  for (const name of ['assets/site-config.js', 'assets/site-config.example.js', 'assets/supabase-config.example.js']) {
    const cfg = config(name);
    if (cfg.RELEASE_AVAILABLE === true) {
      assert.match(cfg.DOWNLOAD_URL, /^https:\/\/ephemerent\.com\/downloads\/orrery\//);
      assert.match(cfg.RELEASE_SHA256, /^[a-f0-9]{64}$/i);
    } else {
      assert.equal(cfg.DOWNLOAD_URL, '');
      assert.equal(cfg.RELEASE_SHA256, '');
    }
  }
});
test('download page no longer sends users to GitHub releases and legacy zip is excluded', () => {
  const links = [...read('download.html').matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert.equal(links.some(link => link.includes('github.com/kenjugmail/orrery-releases')), false);
  assert.ok(read('.vercelignore').split(/\r?\n/).includes('releases/orrery-install.zip'));
});
