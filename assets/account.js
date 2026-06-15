/** Nav + account status — cloud session preferred, local identity fallback. */

import { getIdentity, clearIdentity, logActivity } from './identity.js';
import { getCloudSession, cloudConfigured } from './cloud-auth.js';

const DOWNLOAD_BTN = '<a class="btn btn-primary" href="download.html">Download <span aria-hidden="true">→</span></a>';

/** Escape user-controlled strings before they touch innerHTML.
 *  identity.name/email come from a local form and the email from the
 *  auth provider — neither is trusted for HTML/attribute contexts. */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export async function mountNavAccount(slotId = 'auth-nav-slot') {
  const slot = document.getElementById(slotId);
  if (!slot) return;

  const cloud = cloudConfigured() ? await getCloudSession() : null;
  if (cloud?.user) {
    const email = esc(cloud.user.email || 'Account');
    slot.innerHTML = `
      <a class="btn btn-ghost" href="cloud.html" title="${email}">☁ ${email}</a>
      ${DOWNLOAD_BTN}
    `;
    return;
  }

  const identity = getIdentity();
  if (identity?.email) {
    const label = esc(identity.name || identity.email);
    slot.innerHTML = `
      <span class="auth-chip" title="${esc(identity.email)}">${label}</span>
      <button type="button" class="btn btn-ghost" id="nav-sign-out">Sign out</button>
      ${DOWNLOAD_BTN}
    `;
    document.getElementById('nav-sign-out')?.addEventListener('click', () => {
      void logActivity('auth.sign_out');
      clearIdentity();
      location.reload();
    });
    return;
  }

  slot.innerHTML = `
    <a class="btn btn-ghost" href="login.html">Sign in</a>
    ${DOWNLOAD_BTN}
  `;
}
