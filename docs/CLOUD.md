# Orrery Pro Cloud — login, remote, phone

Orrery is a premium cloud-credit beta. Preview setup is inspectable before subscribing, but real agent work runs through paid hosted credits and cloud features.

## Two modes

| | Local | Orrery Cloud |
|---|--------|----------------|
| **Auth** | Optional email in browser (honor system) | Paid Pro: Google / GitHub / email magic link |
| **Access** | Preview setup | Desktop + phone/browser (via relay) |
| **Pricing** | No active subscription | Pro `$40` / Max `$100` / Ultra `$200` per month; hosted credits, Nexus, managed connectors |
| **Setup** | None | Supabase + billing webhook (~15 min) |
| **Audit logs** | `localStorage` + optional webhook | Central `activity_logs` table |

Preview setup is available before subscription, but real agent work requires an active trial/subscription or server-side beta grant. Google/GitHub/email buttons only appear when `CLOUD_AUTH_URL` and `CLOUD_AUTH_KEY` are set, and the billing webhook/admin process must grant Pro/Max/Ultra before cloud entitlements are enabled.

## What cloud account enables

**Today (when you configure auth):**
- Paid verified identity across site, editor, and devices
- Paid central audit log in Supabase
- Pro cloud dashboard at `cloud.html`
- Plan state: unsubscribed/preview, Pro, Max, or Ultra - hosted-credit counters, cloud capability, and Nexus entitlement

## Pricing model

No public no-cost local tier is offered. Preview users can inspect setup; active subscribers run through hosted credits and cloud features.

There are three paid tiers. Every paid tier includes cloud sign-in (Google / GitHub / email), Nexus cloud features, managed connector capabilities, and hosted credit pools:

| Tier | Price | DeepSeek API | Doubleword | Arbiter |
|------|-------|----------------|-----------------|---------|
| **Pro** | `$40/month` | 8M credits/mo | 8M credits/mo | 4M credits/mo |
| **Max** | `$100/month` | 18M credits/mo | 20M credits/mo | 12M credits/mo |
| **Ultra** | `$200/month` | 35M credits/mo | 35M credits/mo | 30M credits/mo |

All paid tiers also get cloud identity, pairing, remote access, centralized audit logs, and billing/event records for Stripe or another merchant provider. The quota table lives in `assets/accountPlan.js` (`BUNDLED_QUOTAS`); the dashboard at `cloud.html` shows the static allowances for each pool, while live usage metering lives in the IDE and Nexus.

Payment collection is intentionally outside the static site. Put your Stripe Payment Links in `PRO_CHECKOUT_URL`, `MAX_CHECKOUT_URL`, and `ULTRA_CHECKOUT_URL` (Max/Ultra have built-in defaults in `assets/accountPlan.js`), and process Stripe webhooks with an Edge Function or server that updates `profiles.plan` (`'pro' | 'max' | 'ultra'`), `profiles.subscription_status`, credit counters, and `billing_events`. Never put Stripe secrets in `assets/`.

**Next (relay — not live yet):**
- **Phone / browser remote** — approve tool requests, steer agents, read status from your phone
- **Pairing** — desktop shows a code; phone links to your running sidecar through an authenticated relay
- **Hosted sessions** — Cloud sandboxes (Colony / E2B) for tasks you don't want on your laptop

Architecture:

```
Phone browser ──WSS──► Cloud relay (JWT) ──WSS──► Connector on your PC ──► sidecar :4575
```

buddyide already has `remote-bridge.ts` — a safety allowlist for which commands a remote client may invoke.

## Setup overview

Supabase is the **OAuth broker** for Pro cloud — you do not run your own auth server. Google and GitHub talk to Supabase; Orrery talks to Supabase with the anon key. Billing still happens through Stripe or your merchant provider.

1. Create a free project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the SQL editor.
3. Configure Google + GitHub OAuth (steps below).
4. Add redirect URLs in Supabase (step below).
5. Copy API keys into config files.
6. Copy the same `CLOUD_AUTH_*` values to `buddyide/apps/web/public/orrery-config.js`.

Set `profiles.is_admin = true` on your user to read all profiles, activity logs, and billing events.

---

## Step 1 — Supabase redirect URLs

In Supabase: **Authentication → URL Configuration**

| Field | Value |
|-------|-------|
| **Site URL** | `https://ephemerent.com` (production) or `http://localhost:8080` (dev) |
| **Redirect URLs** | Add every URL users may land on after OAuth |

Add these redirect URLs (wildcards supported):

```
http://localhost:8080/**
http://localhost:5173/**
https://ephemerent.com/**
https://www.ephemerent.com/**
```

- `8080` — static site local dev
- `5173` — buddyide editor dev server
- `ephemerent.com` — production (Vercel)

---

## Step 2 — Google OAuth (Google Cloud Console)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. **APIs & Services → OAuth consent screen** — configure app name, support email, add your email as a test user (while in "Testing" mode).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Orrery` (any name)
   - **Authorized JavaScript origins** — add:
     ```
     http://localhost:8080
     http://localhost:5173
     https://YOUR_GITHUB_PAGES_DOMAIN
     ```
   - **Authorized redirect URIs** — add your Supabase callback (from Supabase dashboard):
     ```
     https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
     ```
     Find the exact URL in Supabase: **Authentication → Providers → Google** (shown at top).
4. Copy the **Client ID** and **Client Secret**.
5. In Supabase: **Authentication → Providers → Google** — enable, paste Client ID + Secret, save.

---

## Step 3 — GitHub OAuth App

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
2. Fill in:
   - **Application name**: `Orrery`
   - **Homepage URL**: `https://YOUR_GITHUB_PAGES_DOMAIN` (or `http://localhost:8080` for local dev)
   - **Authorization callback URL** (Supabase callback — same pattern as Google):
     ```
     https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
     ```
3. Register the app → copy **Client ID** → generate **Client Secret**.
4. In Supabase: **Authentication → Providers → GitHub** — enable, paste Client ID + Secret, save.

---

## Step 4 — Email magic link (optional third option)

In Supabase: **Authentication → Providers → Email** — keep enabled (default).

For production, configure SMTP under **Project Settings → Auth → SMTP** so magic links arrive reliably. Supabase's built-in mailer works for testing with low volume.

---

## Step 5 — Site config

Copy `assets/site-config.example.js` → `assets/site-config.js`:

```javascript
CLOUD_AUTH_URL: 'https://YOUR_PROJECT_REF.supabase.co',
CLOUD_AUTH_KEY: 'your-anon-key',  // Project Settings → API → anon public
AUTH_REDIRECT: window.location.origin + '/cloud.html',
STRIPE_PUBLISHABLE_KEY: 'pk_test_...',
STRIPE_PRODUCT_ID: 'prod_...',
PRO_CHECKOUT_URL: 'https://buy.stripe.com/YOUR_PAYMENT_LINK',
```

`STRIPE_PRODUCT_ID` is only a reference. The browser needs `PRO_CHECKOUT_URL` to be a real Stripe Payment Link URL, usually starting with `https://buy.stripe.com/`, before the Upgrade button can send users to checkout.

Copy the same `CLOUD_AUTH_*` values to `buddyide/apps/web/public/orrery-config.js`:

```javascript
CLOUD_AUTH_URL: 'https://YOUR_PROJECT_REF.supabase.co',
CLOUD_AUTH_KEY: 'your-anon-key',
AUTH_REDIRECT: window.location.origin + '/',  // editor root — gate closes after OAuth
```

Leave `CLOUD_AUTH_URL` and `CLOUD_AUTH_KEY` empty to hide OAuth and use preview-only setup.

---

## Test OAuth locally

### Static site (webeph)

```bash
cd webeph
# Fill in site-config.js with your Supabase keys first
python -m http.server 8080
```

1. Open `http://localhost:8080/login.html`
2. Click **Continue with Google** or **Continue with GitHub**
3. Complete provider sign-in → you land back on `login.html` or `cloud.html` signed in
4. Nav shows your email; `cloud.html` shows the signed-in dashboard

### Editor (buddyide)

```bash
cd buddyide/apps/web
# Fill in public/orrery-config.js with the same Supabase keys
pnpm dev
```

1. Open `http://localhost:5173`
2. Auth gate shows Google/GitHub at top (when configured)
3. Click a provider → sign in → redirect back to `http://localhost:5173`
4. Gate closes automatically; session persists on reload

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Redirect loop or "redirect URL not allowed" | Add the exact URL to Supabase **Redirect URLs** |
| Google "redirect_uri_mismatch" | Callback must be `https://PROJECT.supabase.co/auth/v1/callback` in Google Console |
| GitHub "redirect_uri not valid" | Same Supabase callback URL in GitHub OAuth App |
| Gate stays open after OAuth in editor | Ensure `orrery-config.js` has `AUTH_REDIRECT: window.location.origin + '/'` and `5173` is in Supabase redirect URLs |
| Buttons hidden | `CLOUD_AUTH_*` empty or still contain `YOUR_PROJECT` / `YOUR_ANON` placeholders |

---

## Relay (coming)

`CLOUD_RELAY_URL` in config will point at a WebSocket relay (Fly.io / Cloudflare Workers). The desktop connector registers with a pairing code; your phone authenticates with the same cloud account JWT.

Until the relay ships, Pro sign-in works and logs are central — remote/phone features show as "coming soon" on `cloud.html`.

## Alternatives to Supabase

Supabase is the path of least resistance because schema + RLS already exist. Later you could swap the auth layer for Clerk, Auth0, or Cloudflare Access without changing the relay design.
