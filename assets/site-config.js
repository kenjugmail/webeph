/** Public site config — local works with no backend; cloud auth optional. */
window.ORRERY_CONFIG = {
  DOWNLOAD_URL: 'https://github.com/kenjugmail/webeph/releases/latest/download/orrery-install.zip',
  AUDIT_WEBHOOK_URL: '',
  CLOUD_AUTH_URL: '',
  CLOUD_AUTH_KEY: '',
  AUTH_REDIRECT: window.location.origin + '/cloud.html',
  CLOUD_RELAY_URL: '',
};
