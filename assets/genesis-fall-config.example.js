/** Copy to genesis-fall-config.js only after private release approval. */
window.GENESIS_FALL_CONFIG = Object.freeze({
  /** Keep false until live fulfillment and both private packages pass. */
  PURCHASES_ENABLED: false,
  /** Test/live Payment Link. Leave blank while the candidate is private. */
  STRIPE_CHECKOUT_URL: '',
  /** Public Edge Function URL; authorization happens server-side. */
  CLAIM_FUNCTION_URL: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/claim-genesis-fall-live',
  SITE_ORIGIN: 'https://ephemerent.com',
});
