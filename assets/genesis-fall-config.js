/**
 * Genesis Fall public browser configuration.
 *
 * This private candidate exposes only the public claim endpoint. Never place a
 * Stripe secret, Supabase service-role key, webhook secret, email-HMAC secret,
 * encryption key, or private release URL in this file.
 */
window.GENESIS_FALL_CONFIG = Object.freeze({
  PURCHASES_ENABLED: false,
  STRIPE_CHECKOUT_URL: '',
  CLAIM_FUNCTION_URL: 'https://wjjthkqwcyahamhjkeux.supabase.co/functions/v1/claim-genesis-fall-live',
  SITE_ORIGIN: 'https://ephemerent.com',
});
