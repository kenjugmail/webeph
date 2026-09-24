/**
 * Plan tiers and pure helpers — mirrors buddyide apps/web/src/accountPlan.ts.
 * No DOM access here so every page (and the cloud dashboard) shares one source
 * of truth for tier order, prices, quotas, and checkout links.
 */

export const PLAN_ORDER = ['free', 'pro', 'max', 'ultra'];

export const PLAN_LABELS = {
  free: 'No active subscription',
  pro: 'Pro',
  max: 'Max',
  ultra: 'Ultra',
};

/** USD per month for the paid tiers. */
export const PLAN_PRICES = {
  pro: 40,
  max: 100,
  ultra: 200,
};

/**
 * Public monthly credit allotments. One credit is one millionth of a dollar of
 * provider cost: Doubleword credits buy tokens at list rate, Arbiter credits buy
 * looped inference compute (three prefill passes plus decode). These numbers are
 * the same ones on /orrery#pricing; server settlement stays in cents internally.
 */
export const BUNDLED_QUOTAS = {
  pro: { 'Arbiter 27B': 14_000_000, 'Doubleword': 6_000_000 },
  max: { 'Arbiter 27B': 35_000_000, 'Doubleword': 15_000_000 },
  ultra: { 'Arbiter 27B': 70_000_000, 'Doubleword': 30_000_000 },
};

/* No estimated-dollar allotment is published any more. A credit is defined as
   provider cost, so a second "list-rate API usage value" number only invited a
   contradiction between the panel and the pricing page. */

/** Organization tiers. The shared pool is confirmed in writing at setup. */
export const ORG_POOLS = {
  business: { priceUsd: 500 },
  enterprise: { priceUsd: 1000 },
};

/** Built-in Stripe Payment Links; site-config.js keys override them. */
const DEFAULT_CHECKOUT_URLS = {
  max: 'https://buy.stripe.com/4gM3cvf2XdMq3epgQm3Je02',
  ultra: 'https://buy.stripe.com/cNiaEX6wr8s616hgQm3Je03',
};

export function parsePlan(value) {
  return PLAN_ORDER.includes(value) ? value : 'free';
}

export function isPaidPlan(plan) {
  return parsePlan(plan) !== 'free';
}

/** Tier from a profiles row: plan column counts only while the subscription is live. */
export function planFromCloudProfile(profile) {
  if (!profile || typeof profile !== 'object') return 'free';
  const plan = parsePlan(profile.plan);
  if (plan === 'free') return 'free';
  const status = profile.subscription_status;
  const subscriptionActive = status === 'active';
  return subscriptionActive ? plan : 'free';
}

/**
 * Checkout URL for a paid tier. Config keys: PRO_CHECKOUT_URL, MAX_CHECKOUT_URL,
 * ULTRA_CHECKOUT_URL. Max/Ultra fall back to the built-in Stripe links; Pro has
 * no built-in default — returns null when unconfigured (callers fall back to login.html).
 */
export function checkoutUrlForTier(tier, config = window.ORRERY_CONFIG || {}) {
  const plan = parsePlan(tier);
  if (plan === 'free') return null;
  const key = plan.toUpperCase() + '_CHECKOUT_URL';
  const url = config[key];
  if (url && !url.includes('YOUR_')) return url;
  return DEFAULT_CHECKOUT_URLS[plan] || null;
}

/** Pro starts with a free trial on its Stripe payment link (card required, no charge until it ends). */
export const PRO_TRIAL_DAYS = 5;

/**
 * Tie a subscription payment link to the signed-in account: `client_reference_id` is how the Stripe webhook
 * finds the account (it only falls back to matching the checkout email), and the email is prefilled so the
 * two agree. Non-Stripe URLs and signed-out visitors pass through unchanged.
 */
export function withAccount(url, user) {
  if (!url || !user?.id) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'buy.stripe.com') return url;
    parsed.searchParams.set('client_reference_id', user.id);
    if (user.email) parsed.searchParams.set('prefilled_email', user.email);
    return parsed.toString();
  } catch { return url; }
}

/**
 * The account page's plan buttons: one per tier above the current plan, the first one primary. A free
 * account's first step is Pro's free trial, so that button says so. `checkoutFor(tier)` returns the
 * account-tagged checkout URL, or null when that tier has no payment link (the button then emails us).
 */
export function planUpgradeActions(planKey, checkoutFor) {
  const current = parsePlan(planKey);
  const higher = PLAN_ORDER.slice(PLAN_ORDER.indexOf(current) + 1);
  return higher.map((tier, index) => ({
    tier,
    primary: index === 0,
    label: current === 'free' && tier === 'pro'
      ? `Start ${PRO_TRIAL_DAYS}-day free trial`
      : `Upgrade to ${PLAN_LABELS[tier]} — $${PLAN_PRICES[tier]}/mo`,
    href: checkoutFor(tier) || `mailto:kt@ephemerent.com?subject=Orrery%20${PLAN_LABELS[tier]}%20access`,
  }));
}

/** `?start=<tier>` from a pricing button: the tier to send this account to checkout for, or null (unknown
 *  tier, or the account already has that tier or better). */
export function startCheckoutTier(start, planKey) {
  if (!['pro', 'max', 'ultra'].includes(start)) return null;
  return PLAN_ORDER.indexOf(start) > PLAN_ORDER.indexOf(parsePlan(planKey)) ? start : null;
}

/** 100_000_000 → "100M", 1_000_000_000 → "1B". */
export function formatTokens(n) {
  const value = Number(n) || 0;
  if (value >= 1_000_000_000) return trimZero(value / 1_000_000_000) + 'B';
  if (value >= 1_000_000) return trimZero(value / 1_000_000) + 'M';
  if (value >= 1_000) return trimZero(value / 1_000) + 'K';
  return String(value);
}

function trimZero(n) {
  return (Math.round(n * 10) / 10).toString();
}
