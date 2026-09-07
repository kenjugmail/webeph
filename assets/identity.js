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

/* The visitor's platform from the UA (arm64 Linux is unreliable from the UA, so the list below always
 * carries every asset). Returns a manifest key or null. */
function detectReleasePlatform() {
  const ua = navigator.userAgent || '';
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (/Windows/i.test(ua) || /Win/i.test(plat)) return 'win-x64';
  if (/Macintosh|Mac OS X/i.test(ua) || /Mac/i.test(plat)) return 'mac-universal';
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return /aarch64|arm64/i.test(ua) ? 'linux-arm64' : 'linux-x64';
  return null;
}

function fmtBytes(n) {
  const mb = Number(n) / 1048576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
}

/* Subscriber-only downloads. The page never holds a storage URL: it asks the release-download function
 * for the manifest (keys, labels, sizes, hashes) and, on click, for a 10-minute signed URL. Anyone
 * without a session or an active subscription sees the reason instead of a button. */
async function setupDownloadButton() {
  const dl = document.getElementById('orrery-download-btn');
  if (!dl || cfg().RELEASE_AVAILABLE !== true) return;
  const fn = cfg().RELEASE_DOWNLOAD_FUNCTION || 'release-download';
  const base = String(cfg().CLOUD_AUTH_URL || '').replace(/\/+$/, '') + '/functions/v1/' + fn;
  const list = document.getElementById('release-asset-list');
  const note = document.getElementById('release-gate-note');
  const say = (text) => { if (note) { note.textContent = text; note.classList.remove('hidden'); } };
  let session = null;
  try {
    const { getCloudSession } = await import('/assets/cloud-auth.js');
    session = await getCloudSession();
  } catch { session = null; }
  if (!session?.access_token) {
    dl.textContent = 'Sign in to download';
    dl.href = '/signin?next=/download';
    return;
  }
  const call = async (path) => {
    const res = await fetch(base + path, { headers: { authorization: `Bearer ${session.access_token}` } });
    let body = null; try { body = await res.json(); } catch { body = null; }
    if (!res.ok) throw Object.assign(new Error((body && body.message) || `HTTP ${res.status}`), { code: body && body.error, status: res.status });
    return body;
  };
  let manifest;
  try {
    manifest = await call('/manifest');
  } catch (err) {
    if (err.status === 402) { dl.textContent = 'Subscribe to download'; dl.href = '/orrery#pricing'; say(err.message); return; }
    if (err.status === 401) { dl.textContent = 'Sign in to download'; dl.href = '/signin?next=/download'; return; }
    dl.textContent = 'Downloads unavailable right now'; dl.removeAttribute('href'); say(err.message); return;
  }
  const assets = manifest.assets || {};
  const keys = Object.keys(assets);
  if (keys.length === 0) { dl.textContent = 'No build published yet'; dl.removeAttribute('href'); return; }
  const fetchAndGo = async (key, el) => {
    el.setAttribute('aria-busy', 'true');
    try {
      const out = await call(`/asset?key=${encodeURIComponent(key)}`);
      void logActivity('download.bundle', { key, tag: manifest.tag });
      location.href = out.url;
    } catch (err) { say(err.message); }
    el.removeAttribute('aria-busy');
  };
  const mine = detectReleasePlatform();
  const primary = (mine && assets[mine]) ? mine : keys[0];
  dl.textContent = '';
  dl.append(`Download for ${assets[primary].label} (${fmtBytes(assets[primary].size)}) `);
  const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↓'; dl.append(arrow);
  dl.href = '#'; dl.addEventListener('click', (e) => { e.preventDefault(); void fetchAndGo(primary, dl); });
  if (list) {
    for (const key of keys) {
      const li = document.createElement('li');
      const a = document.createElement('a'); a.className = 'mono'; a.style.fontSize = '13px'; a.href = '#';
      a.textContent = `${assets[key].label} — ${assets[key].file} (${fmtBytes(assets[key].size)})`;
      a.addEventListener('click', (e) => { e.preventDefault(); void fetchAndGo(key, a); });
      li.append(a);
      if (assets[key].sha256) { const h = document.createElement('div'); h.className = 'mono'; h.style.cssText = 'font-size:11px;color:var(--faint);overflow-wrap:anywhere;'; h.textContent = `sha256 ${assets[key].sha256}`; li.append(h); }
      list.append(li);
    }
  }
  const ver = document.getElementById('release-version');
  if (ver && manifest.version) ver.textContent = `${manifest.version} (${manifest.tag})`;
  const sha = document.getElementById('release-sha');
  if (sha && assets[primary].sha256) sha.textContent = `SHA-256 ${assets[primary].sha256.slice(0, 16)}…`;
  const page = document.getElementById('release-page-link');
  if (page) { page.textContent = 'Every platform and checksum is listed under Other platforms'; page.removeAttribute('href'); }
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
    void setupDownloadButton();
  } else {
    void logActivity('beta.request_access_view');
  }

  mountIdentityPanel();
  const identity = getIdentity();
  if (identity?.email) void logActivity('site.download_page', { signed_in: true, released });
}
