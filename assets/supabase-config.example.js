/** Legacy helper: prefer assets/site-config.example.js for the file the site imports. */
window.ORRERY_CONFIG = {
  CLOUD_AUTH_URL: 'https://YOUR_PROJECT.supabase.co',
  CLOUD_AUTH_KEY: 'YOUR_ANON_KEY',
  /** GitHub Release asset URL for the Orrery beta packet (zip). */
  DOWNLOAD_URL: '',
  RELEASE_VERSION: '4.0.0-rc.3',
  RELEASE_CHANNEL: 'test-beta',
  RELEASE_PAGE_URL: '/download',
  RELEASE_SHA256: '',
  UPDATE_MODE: 'unsigned-test-beta-manual',
  UPDATE_FEED_URL: 'https://ephemerent.com/downloads/orrery/rc/',
  RELEASE_AVAILABLE: false,
  /** Where auth redirects after OAuth (must match Supabase allow list). */
  AUTH_REDIRECT: window.location.origin + '/download.html',
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
  /** Stripe Payment Link or checkout URL for the Pro monthly plan. */
  PRO_CHECKOUT_URL: 'https://buy.stripe.com/YOUR_PAYMENT_LINK',
  /** Optional Stripe customer portal URL once billing is active. */
  BILLING_PORTAL_URL: '',
};
