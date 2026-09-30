import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOUNDING_SEATS, FOUNDING_TRIAL_DAYS, fetchSeats, foundingCta, seatsLabel } from '../assets/founding.js';

test('signed-out visitors are sent to sign up; signed-in ones request the seat from their account email', () => {
  assert.deepEqual(foundingCta(undefined), { href: '/signin?next=%2Forrery%2Ffounding', label: 'Create your free account', step: 'signup' });
  const cta = foundingCta('dev@example.com');
  assert.equal(cta.step, 'request');
  assert.match(cta.href, /^mailto:kt@ephemerent\.com\?subject=Orrery%20Founding%20100%20seat&body=/);
  assert.match(decodeURIComponent(cta.href), /Account email: dev@example\.com/);
});

test('the seat counter only shows sane numbers and says when the 100 are gone', () => {
  assert.equal(seatsLabel({ total: 100, claimed: 27 }), '73 of 100 founding seats left');
  assert.equal(seatsLabel({ total: 100, claimed: 100 }), 'All founding seats are taken');
  assert.equal(seatsLabel({ total: 100, claimed: 140 }), 'All founding seats are taken');
  for (const bad of [undefined, null, {}, { total: 100 }, { total: '100', claimed: 'x' }, { total: 0, claimed: 0 }, { total: 100, claimed: -1 }]) {
    assert.equal(seatsLabel(bad), undefined);
  }
});

test('a failed or missing seat RPC hides the counter instead of breaking the page', async () => {
  const config = { CLOUD_AUTH_URL: 'https://x.supabase.co', CLOUD_AUTH_KEY: 'sb_publishable_x' };
  assert.equal(await fetchSeats({}), undefined);
  assert.equal(await fetchSeats(config, async () => ({ ok: false })), undefined);
  assert.equal(await fetchSeats(config, async () => { throw new Error('offline'); }), undefined);
  let seen;
  const seats = await fetchSeats(config, async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ total: 100, claimed: 3 }) }; });
  assert.deepEqual(seats, { total: 100, claimed: 3 });
  assert.equal(seen.url, 'https://x.supabase.co/rest/v1/rpc/orrery_founding_seats');
  assert.equal(seen.init.headers.apikey, 'sb_publishable_x');
});

test('the page promises what the grant delivers: 30 days, no card, 100 seats', () => {
  const html = readFileSync(new URL('../founding.html', import.meta.url), 'utf8');
  assert.equal(FOUNDING_TRIAL_DAYS, 30);
  assert.equal(FOUNDING_SEATS, 100);
  assert.match(html, /first 100 developers/);
  assert.match(html, /No card/);
  assert.doesNotMatch(html, /buy\.stripe\.com|renewing at \$40/);
});
