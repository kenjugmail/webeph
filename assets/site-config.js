/**
 * Public site config — local works with no backend; cloud is a paid Pro surface.
 *
 * SAFE TO COMMIT: only publishable browser keys belong here:
 * - Supabase publishable / anon key in CLOUD_AUTH_KEY
 * - Stripe publishable key in STRIPE_PUBLISHABLE_KEY
 * (access is enforced by Supabase Row Level Security). NEVER put the
 * Supabase service_role key, Stripe secret key, or any other secret in this file.
 */
window.ORRERY_CONFIG = {
  DOWNLOAD_URL: 'https://github.com/kenjugmail/webeph/releases/latest/download/orrery-install.zip',

  /** Installer not published yet. false → download.html shows "request beta access".
   *  Flip to true once a GitHub Release with orrery-install.zip is live. */
  RELEASE_AVAILABLE: false,

  AUDIT_WEBHOOK_URL: '',

  /** Pro cloud accounts (Google / GitHub / email) — Supabase → Project Settings → API.
   *  Paste your Project URL + anon (publishable) key to turn Pro cloud on.
   *  Leave empty to keep local-only mode. */
  CLOUD_AUTH_URL: 'https://wjjthkqwcyahamhjkeux.supabase.co',
  CLOUD_AUTH_KEY: 'sb_publishable_fTYErD5rUJfDCj68Siif0Q_CMj0O2gI',

  AUTH_REDIRECT: window.location.origin + '/cloud.html',

  /** Pricing + entitlements. Keep checkout URLs empty until Stripe/merchant links are live. */
  PLANS: {
    free: {
      name: 'Free',
      price: '$0',
      cadence: 'forever',
      summary: 'All local Orrery features on your own machine. No cloud required.',
      features: [
        'Local editor and agent workflow',
        'Ollama/local models',
        'Local audit log and checkpoints',
      ],
    },
    pro: {
      name: 'Pro',
      price: '$40',
      cadence: 'per month',
      summary: 'Every cloud feature: Pro account, API cloud credits, and Buddy.',
      features: [
        'Everything in Free',
        'Google, GitHub, and email cloud sign-in',
        'Included API cloud credits',
        'Buddy system access',
        'Cross-device account and cloud audit log',
      ],
    },
  },
  DEFAULT_PLAN: 'free',
  PRO_MONTHLY_PRICE_USD: 40,
  STRIPE_PUBLISHABLE_KEY: 'pk_test_51Tgrc7DqjlIgVstfpP5de2QVIEnPAMVv2sFDPIfaenIRKwEbGR4ALJ5juD2Yv1hujvidNj3z2r7u4TG4D7cRBv6f00dfihJF1n',
  STRIPE_PRODUCT_ID: 'prod_UgEDipbYTZzLYb',
  PRO_CHECKOUT_URL: 'https://buy.stripe.com/00w8wPcUPaAeg1bfMi3Je00',
  MAX_CHECKOUT_URL: 'https://buy.stripe.com/4gM3cvf2XdMq3epgQm3Je02',
  ULTRA_CHECKOUT_URL: 'https://buy.stripe.com/cNiaEX6wr8s616hgQm3Je03',
  BILLING_PORTAL_URL: '',

  /** Future — WebSocket relay for phone/remote. Leave empty until deployed. */
  CLOUD_RELAY_URL: '',
};
