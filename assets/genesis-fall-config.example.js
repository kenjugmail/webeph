/** Copy to genesis-fall-config.js only after private release approval. */
window.GENESIS_FALL_CONFIG = Object.freeze({
  /** Keep false until Stripe test fulfillment and private itch installs pass. */
  PURCHASES_ENABLED: false,
  /** Test/live Payment Link. Leave blank while the candidate is private. */
  STRIPE_CHECKOUT_URL: '',
  /** Private/public itch project URL. Leave blank while the candidate is private. */
  ITCH_PAGE_URL: '',
  /** Public Edge Function URL; authorization happens server-side. */
  CLAIM_FUNCTION_URL: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/claim-genesis-fall',
  SITE_ORIGIN: 'https://ephemerent.com',
});
