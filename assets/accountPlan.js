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
 * Public monthly credit allotments (marketing). Inflated for prompt caching +
 * token-efficient run context. Server settlement stays in cents internally.
 */
export const BUNDLED_QUOTAS = {
  pro: { 'DeepSeek API': 200_000_000, 'Doubleword': 200_000_000, 'Arbiter': 100_000_000 },
  max: { 'DeepSeek API': 600_000_000, 'Doubleword': 650_000_000, 'Arbiter': 400_000_000 },
  ultra: { 'DeepSeek API': 1_500_000_000, 'Doubleword': 1_500_000_000, 'Arbiter': 1_200_000_000 },
};

/**
 * Estimated list-rate API usage value shown publicly (not provider cost / COGS).
 * Framed as full token-cost reduction from prompt caching + efficient context.
 */
export const ESTIMATED_API_VALUE_USD = {
  pro: 2400,
  max: 7500,
  ultra: 18000,
};

/** Shared org pooled credits + estimated API value (public marketing). */
export const ORG_POOLS = {
  business: {
    priceUsd: 500,
    pooledCredits: 5_000_000_000,
    estimatedApiValueUsd: 25000,
  },
  enterprise: {
    priceUsd: 1000,
    pooledCredits: 15_000_000_000,
    estimatedApiValueUsd: 75000,
  },
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

/** 100_000_000 → "100M", 1_000_000_000 → "1B". */
export function formatTokens(n) {
  const value = Number(n) || 0;
  if (value >= 1_000_000_000) return trimZero(value / 1_000_000_000) + 'B';
  if (value >= 1_000_000) return trimZero(value / 1_000_000) + 'M';
  if (value >= 1_000) return trimZero(value / 1_000) + 'K';
  return String(value);
}

/** Public marketing dollars for estimated API usage value (not COGS). */
export function formatEstimatedApiValue(usd) {
  const amount = Number(usd) || 0;
  return amount.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function trimZero(n) {
  return (Math.round(n * 10) / 10).toString();
}
