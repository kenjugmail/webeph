/** Legacy helper: prefer assets/site-config.example.js for the file the site imports. */
window.ORRERY_CONFIG = {
  CLOUD_AUTH_URL: 'https://YOUR_PROJECT.supabase.co',
  CLOUD_AUTH_KEY: 'YOUR_ANON_KEY',
  /** GitHub Release asset URL for the Orrery beta packet (zip). */
  DOWNLOAD_URL: 'https://github.com/kenjugmail/orrery-releases/releases/download/orrery-0.1.0-beta/Orrery-0.1.0-beta-win-x64-portable.zip',
  RELEASE_VERSION: '0.1.0-beta',
  RELEASE_CHANNEL: 'beta',
  RELEASE_PAGE_URL: 'https://github.com/kenjugmail/orrery-releases/releases/tag/orrery-0.1.0-beta',
  RELEASE_SHA256: '421cb012d7f0f9a390aabc3e108bdc180f5a8851b0b3fa207d348dc1127b8543',
  UPDATE_MODE: 'manual-portable-beta',
  /** Where auth redirects after OAuth (must match Supabase allow list). */
  AUTH_REDIRECT: window.location.origin + '/download.html',
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
  /** Stripe Payment Link or checkout URL for the Pro monthly plan. */
  PRO_CHECKOUT_URL: 'https://buy.stripe.com/YOUR_PAYMENT_LINK',
  /** Optional Stripe customer portal URL once billing is active. */
  BILLING_PORTAL_URL: '',
};
