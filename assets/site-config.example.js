/**
 * Copy to site-config.js
 *
 * Local-only use needs no backend. Pro cloud login uses a
 * free Supabase project as the OAuth broker — no custom auth server required.
 * See docs/CLOUD.md for Google Cloud Console + GitHub OAuth App setup.
 */
window.ORRERY_CONFIG = {
  DOWNLOAD_URL: 'https://github.com/kenjugmail/orrery-releases/releases/download/orrery-0.1.0-beta/Orrery-0.1.0-beta-win-x64-portable.zip',
  /** Optional — POST JSON audit events here. Leave empty to keep logs on-device. */
  AUDIT_WEBHOOK_URL: '',
  /**
   * Pro cloud account — from Supabase → Project Settings → API.
   * Leave empty to hide Google/GitHub/email cloud login and use local mode only.
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
      summary: 'Preview Nexus and prepare a workspace. Start a trial or subscription to run real agents.',
      features: ['Preview workspace and model setup', 'Subscribe to run agents and cloud features'],
    },
    pro: {
      name: 'Pro',
      price: '$40',
      cadence: 'per month',
      summary: 'Hosted DeepSeek API, Doubleword, and Arbiter credits, BYOK, Nexus, and managed cloud features.',
      features: ['Google, GitHub, and email cloud sign-in', 'DeepSeek API - 8M credits/month', 'Doubleword - 8M credits/month', 'Arbiter - 4M credits/month', 'BYOK and Nexus operations'],
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
  /** Optional Stripe customer portal URL once billing is active. */
  BILLING_PORTAL_URL: '',
  /** Future — WebSocket relay for phone/remote. Leave empty until deployed. */
  CLOUD_RELAY_URL: '',
};
