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
  DOWNLOAD_URL: 'https://github.com/kenjugmail/webeph/releases/latest/download/Orrery-Setup.exe',

  /** Windows installer published as a GitHub Release; the stable asset name
   *  survives version bumps and the app self-updates via latest.yml. */
  RELEASE_AVAILABLE: true,

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
      name: 'Not unlocked',
      price: '—',
      cadence: '',
      summary: 'This account has no entitlement yet. Unlock Orrery with a one-time Lifetime purchase, or subscribe for cloud models.',
      features: [
        'Buy Lifetime for permanent local access',
        'Or subscribe (Pro / Max / Ultra) for cloud',
      ],
    },
    lifetime: {
      name: 'Lifetime',
      price: 'one-time',
      cadence: 'local access, forever',
      summary: 'Own Orrery on your machine, permanently. One payment, no subscription — the local editor and agents are yours for good.',
      features: [
        'Permanent local Orrery access',
        'Local / Ollama models + bring your own API key',
        'All future local updates',
        'No monthly fee',
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
  /** Live Stripe publishable (browser) key — safe to commit; only the secret key must stay server-side. */
  STRIPE_PUBLISHABLE_KEY: 'pk_live_51TgrbyDMKk79cYVGoDrCKtlaY2K1bLm950TZcLM0J2IY4WjelO9AEmbc8jIRbORb2B0b6Yhpe6aNR4miAPzXR2rc002xFV0BHV',
  /** Subscription product (Pro/Max/Ultra monthly). */
  STRIPE_PRODUCT_ID: 'prod_UgEDipbYTZzLYb',
  /** One-time "Lifetime (local access)" product — the primary unlock for the app. */
  LIFETIME_PRODUCT_ID: 'prod_UjzeieCaEBSaDn',
  /** Lifetime payment link + one-time USD price. */
  LIFETIME_CHECKOUT_URL: 'https://buy.stripe.com/6oUcN55snfUyeX743A3Je04',
  LIFETIME_PRICE_USD: 20,
  PRO_CHECKOUT_URL: 'https://buy.stripe.com/00w8wPcUPaAeg1bfMi3Je00',
  MAX_CHECKOUT_URL: 'https://buy.stripe.com/4gM3cvf2XdMq3epgQm3Je02',
  ULTRA_CHECKOUT_URL: 'https://buy.stripe.com/cNiaEX6wr8s616hgQm3Je03',
  BILLING_PORTAL_URL: '',

  /** Future — WebSocket relay for phone/remote. Leave empty until deployed. */
  CLOUD_RELAY_URL: '',
};
