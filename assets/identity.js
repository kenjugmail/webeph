const IDENTITY_KEY = 'orrery-identity';
const AUDIT_KEY = 'orrery-audit';

function cfg() {
  return window.ORRERY_CONFIG || {};
}

export function getIdentity() {
  try {
    return JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setIdentity({ email, name = '' }) {
  const identity = {
    email: email.trim().toLowerCase(),
    name: name.trim(),
    signedInAt: new Date().toISOString(),
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export function clearIdentity() {
  localStorage.removeItem(IDENTITY_KEY);
}

function readAuditBuffer() {
  try {
    const rows = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Audit trail — stored in this browser; optionally POSTed to your webhook. */
export async function logActivity(action, meta = {}, resource = null) {
  const identity = getIdentity();
  const entry = {
    ts: new Date().toISOString(),
    email: identity?.email ?? null,
    name: identity?.name ?? null,
    action,
    resource,
    meta: { ...meta, source: meta.source || 'site', page: location.pathname, anonymous: !identity?.email },
    host: location.host,
  };

  const buf = readAuditBuffer();
  buf.push(entry);
  while (buf.length > 500) buf.shift();
  localStorage.setItem(AUDIT_KEY, JSON.stringify(buf));

  const webhook = cfg().AUDIT_WEBHOOK_URL;
  if (!webhook || webhook.includes('YOUR_')) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch (err) {
    console.warn('audit webhook', err);
  }
}

export function bindIdentityForm(root = document) {
  const form = root.getElementById('identity-form');
  const msg = root.getElementById('identity-msg');
  const show = (text, ok) => {
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'auth-msg ' + (ok ? 'ok' : 'err');
  };

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.querySelector('[name="email"]')?.value?.trim();
    const name = form.querySelector('[name="name"]')?.value?.trim() ?? '';
    if (!email) {
      show('Email is optional — leave blank or enter one to tag your audit logs.', true);
      return;
    }
    setIdentity({ email, name });
    void logActivity('auth.sign_in', { method: 'email' });
    show('Signed in.', true);
    root.dispatchEvent(new CustomEvent('orrery-identity-changed'));
  });

  root.getElementById('identity-skip')?.addEventListener('click', () => {
    root.getElementById('identity')?.classList.add('hidden');
  });
}

function setupDownloadButton() {
  const dl = document.getElementById('orrery-download-btn');
  const url = cfg().DOWNLOAD_URL || '#';
  if (dl && url !== '#') {
    dl.href = url;
    dl.setAttribute('download', '');
    dl.addEventListener('click', () => {
      void logActivity('download.bundle', { url });
    });
  }
}

function renderSignedIn(root, identity) {
  const formWrap = root.getElementById('identity-form-wrap');
  const signedIn = root.getElementById('identity-signed-in');
  const emailEl = root.getElementById('identity-email');
  if (emailEl) emailEl.textContent = identity.name ? `${identity.name} (${identity.email})` : identity.email;
  formWrap?.classList.add('hidden');
  signedIn?.classList.remove('hidden');
}

function renderSignedOut(root) {
  const formWrap = root.getElementById('identity-form-wrap');
  const signedIn = root.getElementById('identity-signed-in');
  formWrap?.classList.remove('hidden');
  signedIn?.classList.add('hidden');
}

export function mountIdentityPanel(root = document) {
  bindIdentityForm(root);
  const refresh = () => {
    const identity = getIdentity();
    if (identity?.email) renderSignedIn(root, identity);
    else renderSignedOut(root);
  };
  refresh();
  root.addEventListener('orrery-identity-changed', refresh);
  root.getElementById('identity-sign-out')?.addEventListener('click', () => {
    void logActivity('auth.sign_out');
    clearIdentity();
    refresh();
  });
}

export function mountNavIdentity(slotId = 'auth-nav-slot') {
  const slot = document.getElementById(slotId);
  if (!slot) return;

  const identity = getIdentity();
  if (!identity?.email) {
    slot.innerHTML = '<a class="btn btn-ghost" href="login.html">Identify</a>';
    return;
  }

  const label = identity.name || identity.email;
  slot.innerHTML = `
    <span class="auth-chip" title="${identity.email}">${label}</span>
    <button type="button" class="btn btn-ghost" id="nav-sign-out">Sign out</button>
  `;
  document.getElementById('nav-sign-out')?.addEventListener('click', () => {
    void logActivity('auth.sign_out');
    clearIdentity();
    location.reload();
  });
}

export function mountDownloadPage() {
  const released = cfg().RELEASE_AVAILABLE === true;
  document.getElementById('release-block')?.classList.toggle('hidden', !released);
  document.getElementById('beta-gate')?.classList.toggle('hidden', released);

  if (released) {
    setupDownloadButton();
  } else {
    void logActivity('beta.request_access_view');
  }

  mountIdentityPanel();
  const identity = getIdentity();
  if (identity?.email) void logActivity('site.download_page', { signed_in: true, released });
}
