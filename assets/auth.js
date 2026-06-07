import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm';

let client = null;

function cfg() {
  return window.ORRERY_CONFIG || {};
}

function configured() {
  const c = cfg();
  return c.SUPABASE_URL && !c.SUPABASE_URL.includes('YOUR_PROJECT') &&
    c.SUPABASE_ANON_KEY && !c.SUPABASE_ANON_KEY.includes('YOUR_ANON');
}

export function getSupabase() {
  if (!configured()) return null;
  if (!client) {
    client = createClient(cfg().SUPABASE_URL, cfg().SUPABASE_ANON_KEY);
  }
  return client;
}

export async function getSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function getProfile(userId) {
  const sb = getSupabase();
  if (!sb || !userId) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('email, download_approved, display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) console.warn('profile fetch', error.message);
  return data;
}

export async function signInWithOAuth(provider) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured. See supabase/SETUP.md');
  const redirectTo = cfg().AUTH_REDIRECT || (location.origin + '/download.html');
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signInWithEmail(email) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured. See supabase/SETUP.md');
  const redirectTo = cfg().AUTH_REDIRECT || (location.origin + '/download.html');
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  location.reload();
}

export function downloadUrl() {
  return cfg().DOWNLOAD_URL || '#';
}

/** Update nav slot: #auth-nav-slot */
export async function mountNavAuth(slotId = 'auth-nav-slot') {
  const slot = document.getElementById(slotId);
  if (!slot) return;

  if (!configured()) {
    slot.innerHTML = '<a class="btn btn-ghost" href="login.html">Sign in</a>';
    return;
  }

  const session = await getSession();
  if (!session?.user) {
    slot.innerHTML = '<a class="btn btn-ghost" href="login.html">Sign in</a>';
    return;
  }

  const email = session.user.email || 'Account';
  slot.innerHTML = `
    <span class="auth-chip" title="${email}">${email}</span>
    <a class="btn btn-ghost" href="download.html">Download</a>
    <button type="button" class="btn btn-ghost" id="auth-sign-out">Sign out</button>
  `;
  document.getElementById('auth-sign-out')?.addEventListener('click', () => signOut());

  getSupabase()?.auth.onAuthStateChange(() => mountNavAuth(slotId));
}

/** Login form bindings on login.html / download.html */
export function bindAuthForm(root = document) {
  const msg = root.getElementById('auth-msg');
  const show = (text, ok) => {
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'auth-msg ' + (ok ? 'ok' : 'err');
  };

  root.getElementById('auth-google')?.addEventListener('click', async () => {
    try { await signInWithOAuth('google'); } catch (e) { show(e.message, false); }
  });
  root.getElementById('auth-github')?.addEventListener('click', async () => {
    try { await signInWithOAuth('github'); } catch (e) { show(e.message, false); }
  });
  root.getElementById('auth-email-btn')?.addEventListener('click', async () => {
    const input = root.getElementById('auth-email');
    const email = input?.value?.trim();
    if (!email) { show('Enter your email.', false); return; }
    try {
      await signInWithEmail(email);
      show('Check your email for a sign-in link.', true);
    } catch (e) { show(e.message, false); }
  });
}

function setupDownloadButton() {
  const dl = document.getElementById('orrery-download-btn');
  const url = downloadUrl();
  if (dl && url !== '#') {
    dl.href = url;
    dl.setAttribute('download', '');
  }
}

/** Download page: install bundle always available; sign-in optional */
export async function mountDownloadGate() {
  const loginPanel = document.getElementById('auth-login-panel');
  const downloadPanel = document.getElementById('auth-download-panel');
  const waitlistPanel = document.getElementById('auth-waitlist-panel');
  const configPanel = document.getElementById('auth-config-panel');
  const userRow = document.getElementById('download-user-row');
  const signOutBtn = document.getElementById('download-sign-out');

  downloadPanel?.classList.remove('hidden');
  setupDownloadButton();

  if (!configured()) {
    loginPanel?.classList.add('hidden');
    waitlistPanel?.classList.add('hidden');
    configPanel?.classList.remove('hidden');
    return;
  }

  configPanel?.classList.add('hidden');
  bindAuthForm();

  const session = await getSession();
  if (!session?.user) {
    loginPanel?.classList.remove('hidden');
    waitlistPanel?.classList.add('hidden');
    userRow?.classList.add('hidden');
    signOutBtn?.classList.add('hidden');
    return;
  }

  loginPanel?.classList.add('hidden');

  const emailEl = document.getElementById('download-user-email');
  if (emailEl) emailEl.textContent = session.user.email || '';
  userRow?.classList.remove('hidden');
  signOutBtn?.classList.remove('hidden');
  signOutBtn?.addEventListener('click', () => signOut());

  const profile = await getProfile(session.user.id);
  const approved = profile?.download_approved !== false;
  waitlistPanel?.classList.toggle('hidden', approved);
}
