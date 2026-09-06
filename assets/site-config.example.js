/**
 * Copy to site-config.js
 *
 * Preview setup needs no backend. Pro cloud login uses a
 * free Supabase project as the OAuth broker — no custom auth server required.
 * See docs/CLOUD.md for Google Cloud Console + GitHub OAuth App setup.
 */
window.ORRERY_CONFIG = {
  DOWNLOAD_URL: 'https://github.com/kenjugmail/orrery-releases/releases/download/orrery-0.1.0-beta/Orrery-0.1.0-beta-win-x64-portable.zip',
  RELEASE_VERSION: '0.1.0-beta',
  RELEASE_CHANNEL: 'beta',
  RELEASE_PAGE_URL: 'https://github.com/kenjugmail/orrery-releases/releases/tag/orrery-0.1.0-beta',
  RELEASE_SHA256: '421cb012d7f0f9a390aabc3e108bdc180f5a8851b0b3fa207d348dc1127b8543',
  UPDATE_MODE: 'manual-portable-beta',
  /** Optional — POST JSON audit events here. Leave empty to keep logs on-device. */
  AUDIT_WEBHOOK_URL: '',
  /**
   * Pro cloud account — from Supabase → Project Settings → API.
   * Leave empty to hide Google/GitHub/email cloud login.
   */
  CLOUD_AUTH_URL: 'https://YOUR_PROJECT_REF.supabase.co',
  CLOUD_AUTH_KEY: 'YOUR_SUPABASE_ANON_KEY',
  /** Where OAuth/magic-link redirects land (site pages). Editor uses its own orrery-config.js. */
  AUTH_REDIRECT: window.location.origin + '/cloud.html',
  PLANS: {
    free: {
      name: 'No active subscription',
      price: '-',
      cadence: '',
      summary: 'Preview Nexus and prepare a workspace. Subscribe to run real agents.',
      features: ['Preview workspace and model setup', 'Subscribe to run agents and cloud features'],
    },
    pro: {
      name: 'Pro',
      price: '$40',
      cadence: 'per month',
      summary: 'Hosted Arbiter 27B and Doubleword credits, Nexus, and managed cloud features.',
      features: ['Google, GitHub, and email cloud sign-in', 'Arbiter 27B - 14M compute credits/month', 'Doubleword - 6M credits/month', 'Nexus operations'],
    },
  },
  DEFAULT_PLAN: 'free',
  PRO_MONTHLY_PRICE_USD: 40,
  /** Stripe publishable key. Safe for browser use; never put sk_* keys here. */
  STRIPE_PUBLISHABLE_KEY: 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY',
  /** Optional Stripe product id for internal reference. Not a checkout URL. */
  STRIPE_PRODUCT_ID: 'prod_YOUR_STRIPE_PRODUCT_ID',
  /** Stripe Payment Link or checkout URL for the Pro monthly plan ($40/mo). */
  PRO_CHECKOUT_URL: 'https://buy.stripe.com/YOUR_PAYMENT_LINK',
  /** Stripe Payment Links for the higher tiers. When omitted (or left as YOUR_ placeholders),
   *  assets/accountPlan.js falls back to these built-in defaults:
   *  Max  ($100/mo): https://buy.stripe.com/4gM3cvf2XdMq3epgQm3Je02
   *  Ultra ($200/mo): https://buy.stripe.com/cNiaEX6wr8s616hgQm3Je03 */
  MAX_CHECKOUT_URL: 'https://buy.stripe.com/4gM3cvf2XdMq3epgQm3Je02',
  ULTRA_CHECKOUT_URL: 'https://buy.stripe.com/cNiaEX6wr8s616hgQm3Je03',
  /**
   * Organization Payment Links — Dashboard as kt@ephemerent.com:
   * Products: Orrery Business $500/mo, Orrery Enterprise $1000/mo (recurring).
   * After payment redirect: /organizations.html?checkout=success|cancelled
   */
  BUSINESS_CHECKOUT_URL: 'https://buy.stripe.com/eVq14n1c77o2dT3gQm3Je06',
  ENTERPRISE_CHECKOUT_URL: 'https://buy.stripe.com/cNi5kD4ojbEibKVfMi3Je07',
  /** Optional Stripe customer portal URL once billing is active. */
  BILLING_PORTAL_URL: '',
  /** Credit packs: one-time top-ups of the rollover wallet, spent only after the monthly pool.
   *  `credits` must match CREDIT_PACKS in supabase/functions/stripe-webhook, and `url` is a Stripe
   *  Payment Link; the account page appends ?client_reference_id=<user id> so the webhook knows who
   *  bought it. Leave a url empty and that pack is hidden. */
  CREDIT_PACKS: [
    { id: 'credits-10', credits: 10_000_000, priceUsd: 20, url: '' },
    { id: 'credits-25', credits: 25_000_000, priceUsd: 45, url: '' },
    { id: 'credits-60', credits: 60_000_000, priceUsd: 100, url: '' },
  ],

  /** Future — WebSocket relay for phone/remote. Leave empty until deployed. */
  CLOUD_RELAY_URL: '',
};
