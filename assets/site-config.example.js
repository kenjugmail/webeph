/**
 * Copy to site-config.js
 *
 * Local-only use needs no backend. Google/GitHub login is optional and uses a
 * free Supabase project as the OAuth broker — no custom auth server required.
 * See docs/CLOUD.md for Google Cloud Console + GitHub OAuth App setup.
 */
window.ORRERY_CONFIG = {
  DOWNLOAD_URL: 'https://github.com/kenjugmail/webeph/releases/latest/download/orrery-install.zip',
  /** Optional — POST JSON audit events here. Leave empty for local-only logs. */
  AUDIT_WEBHOOK_URL: '',
  /**
   * Cloud account (optional) — from Supabase → Project Settings → API.
   * Leave empty to hide Google/GitHub login and use local mode only.
   */
  CLOUD_AUTH_URL: 'https://YOUR_PROJECT_REF.supabase.co',
  CLOUD_AUTH_KEY: 'YOUR_SUPABASE_ANON_KEY',
  /** Where OAuth/magic-link redirects land (site pages). Editor uses its own orrery-config.js. */
  AUTH_REDIRECT: window.location.origin + '/cloud.html',
  /** Future — WebSocket relay for phone/remote. Leave empty until deployed. */
  CLOUD_RELAY_URL: '',
};
