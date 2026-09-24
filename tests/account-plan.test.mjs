import { test } from 'node:test';
import assert from 'node:assert/strict';

const { PRO_TRIAL_DAYS, withAccount } = await import('../assets/accountPlan.js');

test('a subscription link carries the account so the webhook can grant the trial', () => {
  assert.equal(PRO_TRIAL_DAYS, 5);
  const url = withAccount('https://buy.stripe.com/abc?prefilled_promo_code=ORRERY-7KQ2MX4P', { id: 'u-1', email: 'a@b.co' });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('client_reference_id'), 'u-1');
  assert.equal(parsed.searchParams.get('prefilled_email'), 'a@b.co');
  assert.equal(parsed.searchParams.get('prefilled_promo_code'), 'ORRERY-7KQ2MX4P');
});

test('signed-out visitors and non-Stripe links pass through unchanged', () => {
  assert.equal(withAccount('https://buy.stripe.com/abc', null), 'https://buy.stripe.com/abc');
  assert.equal(withAccount('/signin', { id: 'u-1' }), '/signin');
  assert.equal(withAccount(null, { id: 'u-1' }), null);
});
