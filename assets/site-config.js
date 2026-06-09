/**
 * Public site config — local works with no backend; cloud auth optional.
 *
 * SAFE TO COMMIT: only the publishable *anon* key belongs in CLOUD_AUTH_KEY
 * (access is enforced by Supabase Row Level Security). NEVER put the
 * service_role key — or any other secret — in this file.
 */
window.ORRERY_CONFIG = {
  DOWNLOAD_URL: 'https://github.com/kenjugmail/webeph/releases/latest/download/orrery-install.zip',

  /** Installer not published yet. false → download.html shows "request beta access".
   *  Flip to true once a GitHub Release with orrery-install.zip is live. */
  RELEASE_AVAILABLE: false,

  AUDIT_WEBHOOK_URL: '',

  /** Cloud accounts (Google / GitHub / email) — Supabase → Project Settings → API.
   *  Paste your Project URL + anon (publishable) key to turn cloud on.
   *  Leave empty to keep local-only mode. */
  CLOUD_AUTH_URL: '',
  CLOUD_AUTH_KEY: '',

  AUTH_REDIRECT: window.location.origin + '/cloud.html',

  /** Future — WebSocket relay for phone/remote. Leave empty until deployed. */
  CLOUD_RELAY_URL: '',
};
