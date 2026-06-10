/** Legacy helper: prefer assets/site-config.example.js for the file the site imports. */
window.ORRERY_CONFIG = {
  CLOUD_AUTH_URL: 'https://YOUR_PROJECT.supabase.co',
  CLOUD_AUTH_KEY: 'YOUR_ANON_KEY',
  /** GitHub Release asset URL for the Orrery install bundle (zip). */
  DOWNLOAD_URL: 'https://github.com/kenjugmail/webeph/releases/latest/download/orrery-install.zip',
  /** Where auth redirects after OAuth (must match Supabase allow list). */
  AUTH_REDIRECT: window.location.origin + '/download.html',
  PLANS: {
    free: {
      name: 'Free',
      price: '$0',
      cadence: 'forever',
      summary: 'All local Orrery features on your own machine. No cloud required.',
      features: ['Local editor and agent workflow', 'Ollama/local models', 'Local audit log and checkpoints'],
    },
    pro: {
      name: 'Pro',
      price: '$40',
      cadence: 'per month',
      summary: 'Every cloud feature: Pro account, API cloud credits, and Buddy.',
      features: ['Everything in Free', 'Google, GitHub, and email cloud sign-in', 'Included API cloud credits', 'Buddy system access', 'Cross-device account and cloud audit log'],
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
