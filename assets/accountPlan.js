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

/** Monthly token quotas for the bundled cloud models, per paid tier. */
export const BUNDLED_QUOTAS = {
  pro: { 'DeepSeek API': 8_000_000, 'Doubleword': 8_000_000, 'Arbiter': 4_000_000 },
  max: { 'DeepSeek API': 18_000_000, 'Doubleword': 20_000_000, 'Arbiter': 12_000_000 },
  ultra: { 'DeepSeek API': 35_000_000, 'Doubleword': 35_000_000, 'Arbiter': 30_000_000 },
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
  const subscriptionActive = status === 'active' || status === 'trialing';
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
