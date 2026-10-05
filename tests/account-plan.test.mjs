import { test } from 'node:test';
import assert from 'node:assert/strict';

const { withAccount } = await import('../assets/accountPlan.js');

test('a subscription link carries the account so the webhook can grant the subscription', () => {
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

const { planUpgradeActions, startCheckoutTier } = await import('../assets/accountPlan.js');

test('a free account is offered the paid Pro subscription first, then the bigger plans', () => {
  const links = { pro: 'https://buy.stripe.com/pro', max: 'https://buy.stripe.com/max', ultra: null };
  const actions = planUpgradeActions('free', (tier) => links[tier]);
  assert.deepEqual(actions.map((a) => [a.tier, a.label, a.primary]), [
    ['pro', 'Subscribe to Pro — $40/mo', true],
    ['max', 'Upgrade to Max — $100/mo', false],
    ['ultra', 'Upgrade to Ultra — $200/mo', false],
  ]);
  assert.equal(actions[0].href, 'https://buy.stripe.com/pro');
  assert.match(actions[2].href, /^mailto:kt@ephemerent\.com\?subject=Orrery%20Ultra%20access$/);
  assert.equal(planUpgradeActions('pro', () => 'x')[0].label, 'Upgrade to Max — $100/mo');
  assert.deepEqual(planUpgradeActions('ultra', () => 'x'), []);
});

test('a pricing button sends an account to checkout only for a tier above its own', () => {
  assert.equal(startCheckoutTier('pro', 'free'), 'pro');
  assert.equal(startCheckoutTier('max', 'pro'), 'max');
  assert.equal(startCheckoutTier('pro', 'pro'), null);
  assert.equal(startCheckoutTier('pro', 'ultra'), null);
  assert.equal(startCheckoutTier('enterprise', 'free'), null);
  assert.equal(startCheckoutTier(null, 'free'), null);
});
