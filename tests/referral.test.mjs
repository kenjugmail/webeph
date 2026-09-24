import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
const { captureReferral, storedReferral, validReferralCode, withReferral } = await import('../assets/referral.js');

test('only well-formed Orrery codes are accepted', () => {
  assert.equal(validReferralCode('ORRERY-7KQ2MX4P'), true);
  assert.equal(validReferralCode('orrery-7kq2mx4p'), true);
  for (const bad of ['ORRERY-7KQ2MX4', 'ORRERY-OOOOOOOO', 'SAVE50', '', null]) assert.equal(validReferralCode(bad), false);
});

test('a referral link is remembered for 30 days and then forgotten', () => {
  const now = 1_700_000_000_000;
  assert.equal(captureReferral('https://ephemerent.com/orrery?ref=orrery-7kq2mx4p', now), 'ORRERY-7KQ2MX4P');
  assert.equal(storedReferral(now + 1000), 'ORRERY-7KQ2MX4P');
  assert.equal(storedReferral(now + 31 * 24 * 60 * 60 * 1000), undefined);
  assert.equal(captureReferral('https://ephemerent.com/orrery?ref=<script>', now), undefined);
});

test('the code is prefilled on Stripe payment links only', () => {
  assert.equal(withReferral('https://buy.stripe.com/abc', 'ORRERY-7KQ2MX4P'), 'https://buy.stripe.com/abc?prefilled_promo_code=ORRERY-7KQ2MX4P');
  assert.equal(withReferral('https://buy.stripe.com/abc?x=1', 'ORRERY-7KQ2MX4P'), 'https://buy.stripe.com/abc?x=1&prefilled_promo_code=ORRERY-7KQ2MX4P');
  assert.equal(withReferral('/login.html', 'ORRERY-7KQ2MX4P'), '/login.html');
  assert.equal(withReferral('https://buy.stripe.com/abc', undefined), 'https://buy.stripe.com/abc');
});
