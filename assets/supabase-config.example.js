/** Copy to supabase-config.js and fill in your Supabase project values. */
window.ORRERY_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_KEY',
  /** GitHub Release asset URL for the Orrery install bundle (zip). */
  DOWNLOAD_URL: 'https://github.com/kenjugmail/webeph/releases/latest/download/orrery-install.zip',
  /** Where auth redirects after OAuth (must match Supabase allow list). */
  AUTH_REDIRECT: window.location.origin + '/download.html',
};
