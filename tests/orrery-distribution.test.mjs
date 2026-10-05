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
test('available downloads use the account-gated manifest; pending states advertise no artifact', () => {
  for (const name of ['assets/site-config.js', 'assets/site-config.example.js', 'assets/supabase-config.example.js']) {
    const cfg = config(name);
    if (cfg.RELEASE_AVAILABLE === true) {
      assert.equal(cfg.RELEASE_DOWNLOAD_FUNCTION, 'release-download');
      assert.match(cfg.CLOUD_AUTH_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
      assert.doesNotMatch(cfg.CLOUD_AUTH_URL, /YOUR_/);
      assert.match(cfg.RELEASE_VERSION, /^\d+\.\d+\.\d+(?:-[\w.]+)?$/);
      assert.equal(cfg.UPDATE_MODE, 'subscriber-feed');
      assert.equal(cfg.DOWNLOAD_URL, '');
      assert.equal(cfg.RELEASE_SHA256, '');
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
