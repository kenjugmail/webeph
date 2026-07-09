/**
 * Public site config. Orrery is premium from first start: visitors can preview setup,
 * while real agent work requires a trial, subscription, or grandfathered legacy local access.
 *
 * SAFE TO COMMIT: only publishable browser keys belong here:
 * - Supabase publishable / anon key in CLOUD_AUTH_KEY
 * - Stripe publishable key in STRIPE_PUBLISHABLE_KEY
 * NEVER put the Supabase service_role key, Stripe secret key, provider keys, or any other secret here.
 */
window.ORRERY_CONFIG = {
  DOWNLOAD_URL: 'https://github.com/kenjugmail/orrery-releases/releases/download/orrery-0.1.0-beta/Orrery-0.1.0-beta-win-x64-portable.zip',

  /** Windows beta packet published to the binary-only Orrery release repository. */
  RELEASE_AVAILABLE: true,

  AUDIT_WEBHOOK_URL: '',

  /** Cloud accounts (Google / GitHub / email) - Supabase Project Settings -> API. */
  CLOUD_AUTH_URL: 'https://wjjthkqwcyahamhjkeux.supabase.co',
  CLOUD_AUTH_KEY: 'sb_publishable_fTYErD5rUJfDCj68Siif0Q_CMj0O2gI',

  AUTH_REDIRECT: window.location.origin + '/cloud.html',

  /** Pricing + entitlements. */
  PLANS: {
    free: {
      name: 'No active subscription',
      price: '-',
      cadence: '',
      summary: 'Preview Nexus and prepare a workspace. Start a trial or subscription to run real agents.',
      features: [
        'Preview workspace and model setup',
        'Subscribe to run agents and cloud features',
      ],
    },
    pro: {
      name: 'Pro',
      price: '$40',
      cadence: 'per month',
      summary: 'Hosted DeepSeek API, Doubleword, and Arbiter credits, BYOK, Nexus, and managed cloud features.',
      features: [
        'Google, GitHub, and email cloud sign-in',
        'DeepSeek API - 8M credits/month',
        'Doubleword - 8M credits/month',
        'Arbiter - 4M credits/month',
        'BYOK and Nexus agent operations',
        'Managed Discord/mobile automation',
      ],
    },
  },
  DEFAULT_PLAN: 'free',
  PRO_MONTHLY_PRICE_USD: 40,
  /** Live Stripe publishable (browser) key - safe to commit; only the secret key must stay server-side. */
  STRIPE_PUBLISHABLE_KEY: 'pk_live_51TgrbyDMKk79cYVGoDrCKtlaY2K1bLm950TZcLM0J2IY4WjelO9AEmbc8jIRbORb2B0b6Yhpe6aNR4miAPzXR2rc002xFV0BHV',
  /** Subscription product (Pro/Max/Ultra monthly). */
  STRIPE_PRODUCT_ID: 'prod_UgEDipbYTZzLYb',
  PRO_CHECKOUT_URL: 'https://buy.stripe.com/00w8wPcUPaAeg1bfMi3Je00',
  MAX_CHECKOUT_URL: 'https://buy.stripe.com/4gM3cvf2XdMq3epgQm3Je02',
  ULTRA_CHECKOUT_URL: 'https://buy.stripe.com/cNiaEX6wr8s616hgQm3Je03',
  BILLING_PORTAL_URL: '',

  /** Future - WebSocket relay for phone/remote. Leave empty until deployed. */
  CLOUD_RELAY_URL: '',
};
