/**
 * Public site config. Orrery is premium from first start: visitors can preview setup,
 * while real agent work requires an active subscription.
 *
 * SAFE TO COMMIT: only publishable browser keys belong here:
 * - Supabase publishable / anon key in CLOUD_AUTH_KEY
 * - Stripe publishable key in STRIPE_PUBLISHABLE_KEY
 * NEVER put the Supabase service_role key, Stripe secret key, provider keys, or any other secret here.
 */
window.ORRERY_CONFIG = {
  DOWNLOAD_URL: 'https://github.com/kenjugmail/orrery-releases/releases/download/orrery-0.1.0-beta/Orrery-0.1.0-beta-win-x64-portable.zip',
  RELEASE_VERSION: '0.1.0-beta',
  RELEASE_CHANNEL: 'beta',
  RELEASE_PAGE_URL: 'https://github.com/kenjugmail/orrery-releases/releases/tag/orrery-0.1.0-beta',
  RELEASE_SHA256: '421cb012d7f0f9a390aabc3e108bdc180f5a8851b0b3fa207d348dc1127b8543',
  UPDATE_MODE: 'manual-portable-beta',

  /** Windows beta packet published to the binary-only Orrery release repository. */
  RELEASE_AVAILABLE: true,

  AUDIT_WEBHOOK_URL: '',

  /** Cloud accounts (Google / GitHub / email) - Supabase Project Settings -> API. */
  CLOUD_AUTH_URL: 'https://wjjthkqwcyahamhjkeux.supabase.co',
  CLOUD_AUTH_KEY: 'sb_publishable_fTYErD5rUJfDCj68Siif0Q_CMj0O2gI',

  /**
   * Must exactly match an entry in the Supabase Auth "Redirect URLs" allowlist.
   * Before changing this to the pretty /cloud route, add https://ephemerent.com/cloud
   * to that allowlist — otherwise every OAuth sign-in fails on the callback.
   */
  AUTH_REDIRECT: window.location.origin + '/cloud.html',

  /** Pricing + entitlements. */
  PLANS: {
    free: {
      name: 'No active subscription',
      price: '-',
      cadence: '',
      summary: 'Preview Nexus and prepare a workspace. Subscribe to run real agents.',
      features: [
        'Preview workspace and model setup',
        'Subscribe to run agents and cloud features',
      ],
    },
    pro: {
      name: 'Pro',
      price: '$40',
      cadence: 'per month',
      summary: 'Hosted Arbiter 27B and Doubleword credits, Nexus, and managed cloud features.',
      features: [
        'Google, GitHub, and email cloud sign-in',
        'Arbiter 27B - 14M compute credits/month',
        'Doubleword - 6M credits/month',
        'Nexus agent operations',
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
  /**
   * Vespera / Aetherfront play — separate IdP from Orrery.
   * Auth: Firebase (ephemerent.com/login). Not Supabase / login.html.
   */
  VESPERA_PLAY_URL: 'https://ephemerent.com/play?experience=vespera',
  VESPERA_PLAY_HOME_URL: 'https://ephemerent.com/login',
  VESPERA_PLAY_ACCESS_URL: 'https://buy.stripe.com/4gM6oHaMH5fU3eparY3Je09',
  /**
   * Organization Stripe Payment Links (create in Dashboard as kt@ephemerent.com):
   * Business $500/mo, Enterprise $1000/mo. Paste buy.stripe.com URLs here.
   * Success/cancel: https://ephemerent.com/organizations?checkout=success|cancelled
   */
  BUSINESS_CHECKOUT_URL: 'https://buy.stripe.com/eVq14n1c77o2dT3gQm3Je06',
  ENTERPRISE_CHECKOUT_URL: 'https://buy.stripe.com/cNi5kD4ojbEibKVfMi3Je07',
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


  /** Future - WebSocket relay for phone/remote. Leave empty until deployed. */
  CLOUD_RELAY_URL: '',
};
