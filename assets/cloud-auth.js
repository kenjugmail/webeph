/** Pro cloud account — Supabase OAuth when CLOUD_AUTH_* is set in site-config.js. */

let client = null;

function cfg() {
  return window.ORRERY_CONFIG || {};
}

export function cloudConfigured() {
  const c = cfg();
  return c.CLOUD_AUTH_URL && !c.CLOUD_AUTH_URL.includes('YOUR_PROJECT') &&
    c.CLOUD_AUTH_KEY && !c.CLOUD_AUTH_KEY.includes('YOUR_ANON');
}

function hasAuthCallbackInUrl() {
  const href = location.href;
  return /[?&#](code|access_token|error_description|error)=/.test(href);
}

/** OAuth/magic-link return URL — current auth page when possible, else config default. */
export function getAuthRedirect() {
  const path = location.pathname;
  if (path.endsWith('login.html') || path.endsWith('cloud.html')) {
    return location.origin + path;
  }
  const explicit = cfg().AUTH_REDIRECT;
  if (explicit && !explicit.includes('YOUR_')) return explicit;
  return location.origin + '/cloud.html';
}

async function getClient() {
  if (!cloudConfigured()) return null;
  if (!client) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm');
    client = createClient(cfg().CLOUD_AUTH_URL, cfg().CLOUD_AUTH_KEY, {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

export async function getCloudSession() {
  const sb = await getClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export function getPlanCatalog() {
  const plans = cfg().PLANS || {};
  return {
    free: plans.free || {
      name: 'Free',
      price: '$0',
      cadence: 'forever',
      summary: 'All local Orrery features on your own machine. No cloud required.',
      features: ['Local editor and agent workflow', 'Ollama/local models', 'Local audit log and checkpoints'],
    },
    pro: plans.pro || {
      name: 'Pro',
      price: '$40',
      cadence: 'per month',
      summary: 'Every cloud feature: Pro account, API cloud credits, and Buddy.',
      features: ['Everything in Free', 'Google, GitHub, and email cloud sign-in', 'Included API cloud credits', 'Buddy system access'],
    },
  };
}

export async function getCloudProfile() {
  const sb = await getClient();
  const session = await getCloudSession();
  if (!sb || !session?.user) return null;

  const { data, error } = await sb
    .from('profiles')
    .select('id,email,display_name,avatar_url,download_approved,plan,subscription_status,cloud_credit_granted_cents,cloud_credit_used_cents,buddy_access')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) {
    console.warn('cloud profile', error.message);
    return {
      id: session.user.id,
      email: session.user.email,
      plan: cfg().DEFAULT_PLAN || 'free',
      subscription_status: 'inactive',
      cloud_credit_granted_cents: 0,
      cloud_credit_used_cents: 0,
      buddy_access: false,
    };
  }
  return data;
}

function moneyFromCents(cents) {
  const amount = Number(cents || 0) / 100;
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function renderPlanSummary(root, profile) {
  const slot = root.getElementById('cloud-plan-summary');
  if (!slot) return;

  const catalog = getPlanCatalog();
  const planKey = profile?.plan === 'pro' ? 'pro' : 'free';
  const plan = catalog[planKey];
  const granted = Number(profile?.cloud_credit_granted_cents || 0);
  const used = Number(profile?.cloud_credit_used_cents || 0);
  const remaining = Math.max(granted - used, 0);
  const checkout = cfg().PRO_CHECKOUT_URL;
  const portal = cfg().BILLING_PORTAL_URL;

  const action = planKey === 'pro'
    ? (portal ? `<a class="btn btn-ghost" href="${portal}">Manage billing</a>` : '<span class="plan-note">Billing portal not connected yet.</span>')
    : (checkout ? `<a class="btn btn-primary" href="${checkout}">Upgrade to Pro</a>` : '<a class="btn btn-primary" href="mailto:hello@ephemerent.com?subject=Orrery%20Pro%20access">Request Pro access</a>');

  slot.innerHTML = `
    <div class="account-plan-head">
      <div>
        <span class="mono account-plan-kicker">Current plan</span>
        <h2>${plan.name}</h2>
      </div>
      <span class="plan-badge">${plan.price} ${plan.cadence}</span>
    </div>
    <p>${plan.summary}</p>
    <div class="account-plan-meter">
      <span>Pro cloud credits</span>
      <b>${moneyFromCents(remaining)} remaining</b>
    </div>
    <div class="account-plan-meter">
      <span>Buddy system</span>
      <b>${profile?.buddy_access || planKey === 'pro' ? 'Enabled' : 'Pro'}</b>
    </div>
    <div class="account-plan-actions">${action}</div>
  `;
}

/** Wait for session after OAuth/magic-link redirect (URL hash or ?code=). */
export async function waitForCloudSession() {
  const sb = await getClient();
  if (!sb) return null;

  const { data: { session } } = await sb.auth.getSession();
  if (session) return session;
  if (!hasAuthCallbackInUrl()) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (s) => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      if (s && hasAuthCallbackInUrl()) {
        history.replaceState(null, '', location.pathname + location.search);
      }
      resolve(s);
    };

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, s) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && s) finish(s);
    });

    setTimeout(() => {
      void sb.auth.getSession().then(({ data: { session: s } }) => finish(s));
    }, 4000);
  });
}

export async function logCloudActivity(action, meta = {}, resource = null) {
  const sb = await getClient();
  const session = await getCloudSession();
  if (!sb || !session?.user) return;
  const { error } = await sb.from('activity_logs').insert({
    user_id: session.user.id,
    email: session.user.email,
    action,
    resource,
    meta: { ...meta, source: 'cloud' },
  });
  if (error) console.warn('cloud activity', error.message);
}

export async function signInWithOAuth(provider) {
  const sb = await getClient();
  if (!sb) throw new Error('Cloud auth is not configured. See docs/CLOUD.md');
  const redirectTo = getAuthRedirect();
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw error;
}

export async function signInWithEmail(email) {
  const sb = await getClient();
  if (!sb) throw new Error('Cloud auth is not configured. See docs/CLOUD.md');
  const redirectTo = getAuthRedirect();
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signOutCloud() {
  await logCloudActivity('cloud.sign_out');
  const sb = await getClient();
  if (!sb) return;
  await sb.auth.signOut();
  location.reload();
}

export function bindCloudAuthForm(root = document) {
  const msg = root.getElementById('cloud-auth-msg');
  const show = (text, ok) => {
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'auth-msg ' + (ok ? 'ok' : 'err');
  };

  if (!cloudConfigured()) {
    root.getElementById('cloud-auth-panel')?.classList.add('hidden');
    root.getElementById('cloud-auth-primary')?.classList.add('hidden');
    root.getElementById('cloud-local-divider')?.classList.add('hidden');
    root.getElementById('cloud-auth-setup')?.classList.add('hidden');
    return;
  }

  root.getElementById('cloud-auth-setup')?.classList.add('hidden');
  root.getElementById('cloud-auth-primary')?.classList.remove('hidden');
  root.getElementById('cloud-local-divider')?.classList.remove('hidden');
  root.getElementById('cloud-auth-panel')?.classList.remove('hidden');

  root.getElementById('cloud-google')?.addEventListener('click', async () => {
    try { await signInWithOAuth('google'); } catch (e) { show(e.message, false); }
  });
  root.getElementById('cloud-github')?.addEventListener('click', async () => {
    try { await signInWithOAuth('github'); } catch (e) { show(e.message, false); }
  });
  root.getElementById('cloud-email-btn')?.addEventListener('click', async () => {
    const input = root.getElementById('cloud-email');
    const email = input?.value?.trim();
    if (!email) { show('Enter your email.', false); return; }
    try {
      await signInWithEmail(email);
      show('Check your email for a sign-in link.', true);
    } catch (e) { show(e.message, false); }
  });
}

export async function mountCloudAccount(root = document) {
  bindCloudAuthForm(root);
  const session = await waitForCloudSession();
  const signedIn = root.getElementById('cloud-signed-in');
  const login = root.getElementById('cloud-auth-panel');
  const setup = root.getElementById('cloud-auth-setup');

  if (!cloudConfigured()) {
    login?.classList.add('hidden');
    signedIn?.classList.add('hidden');
    setup?.classList.remove('hidden');
    return null;
  }

  setup?.classList.add('hidden');

  if (!session?.user) {
    login?.classList.remove('hidden');
    signedIn?.classList.add('hidden');
    return null;
  }

  login?.classList.add('hidden');
  signedIn?.classList.remove('hidden');
  const emailEl = root.getElementById('cloud-user-email');
  if (emailEl) emailEl.textContent = session.user.email || 'Account';
  void logCloudActivity('cloud.open');
  getCloudProfile().then((profile) => renderPlanSummary(root, profile));

  root.getElementById('cloud-sign-out')?.addEventListener('click', () => signOutCloud());
  return session;
}
