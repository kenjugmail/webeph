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

/* The visitor's platform from the UA (arm64 Linux from the UA is unreliable, so the list below always
 * carries every asset). Returns a key of RELEASE_ASSETS or null. */
function detectReleasePlatform() {
  const ua = navigator.userAgent || '';
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (/Windows/i.test(ua) || /Win/i.test(plat)) return 'win-x64';
  if (/Macintosh|Mac OS X/i.test(ua) || /Mac/i.test(plat)) return 'mac-universal';
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return /aarch64|arm64/i.test(ua) ? 'linux-arm64' : 'linux-x64';
  return null;
}

function setupDownloadButton() {
  const dl = document.getElementById('orrery-download-btn');
  if (!dl || cfg().RELEASE_AVAILABLE !== true) return;
  const assets = cfg().RELEASE_ASSETS || {};
  const base = String(cfg().RELEASE_ASSET_BASE || '') + encodeURIComponent(cfg().RELEASE_TAG || '') + '/';
  const keys = Object.keys(assets);
  const wire = (el, url) => {
    el.href = url;
    el.setAttribute('download', '');
    el.addEventListener('click', () => { void logActivity('download.bundle', { url }); });
  };
  if (keys.length === 0) {
    const url = cfg().DOWNLOAD_URL || '#';
    if (url !== '#') wire(dl, url);
    return;
  }
  const mine = detectReleasePlatform();
  const primary = (mine && assets[mine]) ? mine : 'win-x64';
  dl.textContent = '';
  dl.append(`Download for ${assets[primary].label} `);
  const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↓'; dl.append(arrow);
  wire(dl, base + assets[primary].file);
  const list = document.getElementById('release-asset-list');
  if (list) {
    for (const key of keys) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = 'mono';
      a.style.fontSize = '13px';
      a.textContent = `${assets[key].label} — ${assets[key].file}`;
      wire(a, base + assets[key].file);
      li.append(a); list.append(li);
    }
    const sums = document.createElement('li');
    const s = document.createElement('a'); s.className = 'mono'; s.style.fontSize = '13px'; s.textContent = 'SHA256SUMS.txt'; s.href = base + 'SHA256SUMS.txt';
    sums.append(s); list.append(sums);
  }
  const page = document.getElementById('release-page-link');
  if (page) page.href = 'https://github.com/kenjugmail/orrery-releases/releases/tag/' + encodeURIComponent(cfg().RELEASE_TAG || '');
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
    slot.innerHTML = '<a class="btn btn-ghost" href="/signin">Identify</a>';
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
