import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('private storefront is noindex and direct purchase is disabled', async () => {
  const [page, access, config] = await Promise.all([
    read('genesis-fall.html'),
    read('genesis-fall-access.html'),
    read('assets/genesis-fall-config.js'),
  ]);
  assert.match(page, /noindex,nofollow,noarchive,nosnippet/);
  assert.match(access, /noindex,nofollow,noarchive,nosnippet/);
  assert.match(page, /data-stripe-checkout/);
  assert.doesNotMatch(page, /data-itch-checkout/);
  assert.match(page, /disabled aria-disabled="true" data-stripe-checkout/);
  assert.match(config, /PURCHASES_ENABLED:\s*false/);
  assert.match(config, /STRIPE_CHECKOUT_URL:\s*''/);
  assert.doesNotMatch(config, /buy\.stripe\.com|\.itch\.io\//);
  assert.match(config, /claim-genesis-fall-live/);
});

test('storefront copy describes one-time direct delivery', async () => {
  const page = await read('genesis-fall.html');
  assert.match(page, /Stripe · \$20 \+ applicable tax/);
  assert.match(page, /No subscription or recurring charge/);
  assert.match(page, /short-lived direct-download links/);
  assert.match(page, /future beta updates offered through Ephemerent/);
  assert.doesNotMatch(page, /itch\.io/i);
});

test('private routes and no-store headers are configured', async () => {
  const vercel = JSON.parse(await read('vercel.json'));
  assert.ok(vercel.rewrites.some((row) => row.source === '/genesis-fall' && row.destination === '/genesis-fall.html'));
  assert.ok(vercel.rewrites.some((row) => row.source === '/genesis-fall-access' && row.destination === '/genesis-fall-access.html'));
  for (const route of ['/genesis-fall', '/genesis-fall-access']) {
    const headers = vercel.headers.find((row) => row.source === route)?.headers || [];
    assert.ok(headers.some((row) => row.key === 'X-Robots-Tag' && row.value.includes('noindex')));
    assert.ok(headers.some((row) => row.key === 'Cache-Control' && row.value === 'private, no-store'));
  }
});

test('legal pages describe Stripe direct delivery and local-game privacy', async () => {
  const [terms, privacy] = await Promise.all([read('terms.html'), read('privacy.html')]);
  assert.match(terms, /one-time USD \$20 purchase/);
  assert.match(terms, /one-time Stripe payments and do not renew/);
  assert.match(terms, /short-lived direct-download links/);
  assert.match(terms, /within 14 days of purchase/);
  assert.match(privacy, /server-HMAC hash/);
  assert.match(privacy, /does not store the raw purchaser email/);
  assert.match(privacy, /no telemetry/);
  assert.match(privacy, /Experimental LAN co-op/);
  assert.match(privacy, /no telemetry[\s\S]{0,180}enabled native generative-dialogue service/);
});

test('direct-download migration keeps artifacts and orders private', async () => {
  const migration = await read('supabase/migrations/20260814000000_genesis_fall_direct_download.sql');
  assert.match(migration, /genesis-fall-releases/);
  assert.match(migration, /public, anon, authenticated/);
  assert.match(migration, /genesis_fall_direct_release_ready/);
  assert.match(migration, /count\(distinct platform\) = 2/);
  assert.doesNotMatch(migration, /create policy/i);
  assert.doesNotMatch(migration, /purchaser_email\s+text/i);
});

test('migration denies browser access and preserves out-of-order refund review', async () => {
  const migration = await read('supabase/migrations/20260813000000_genesis_fall_fulfillment.sql');
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all on table public\.genesis_fall_orders from public, anon, authenticated/);
  assert.doesNotMatch(migration, /create policy/i);
  assert.doesNotMatch(migration, /purchaser_email\s+text/i);
  assert.match(migration, /related_payment_intent_id/);
  assert.match(migration, /event_type in \('charge\.refunded', 'charge\.dispute\.created'\)/);
  assert.match(migration, /for update skip locked/);
});
