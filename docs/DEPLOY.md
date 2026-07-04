# Deploy webeph to Vercel + ephemerent.com

Static site — no build step. Repo: [github.com/kenjugmail/webeph](https://github.com/kenjugmail/webeph).

## 1. Vercel (after push to `main`)

Code is on GitHub. Import once:

1. [vercel.com](https://vercel.com) → Sign in with **GitHub**
2. **Add New Project** → Import `kenjugmail/webeph`
3. Framework Preset: **Other**
4. **Build Command:** leave empty
5. **Output Directory:** `.` (repository root)
6. **Deploy**

Preview URL: `https://webeph-*.vercel.app`

Verify:

- `/` → Ephemerent lab page
- `/Orrery.html` → product
- `/Orrery.html#pricing` → Free and Pro pricing
- `/download.html` → download
- `/login.html` → sign-in
- `/cloud.html` → cloud account, plan, and billing CTA

### CLI (optional)

```powershell
cd c:\Users\kenju\Documents\webeph
npx vercel login
npx vercel --prod
```

## 2. Custom domain — ephemerent.com

### Vercel

1. Project → **Settings → Domains**
2. Add `ephemerent.com`
3. Add `www.ephemerent.com`
4. Set **ephemerent.com** as primary (redirect www → apex if offered)

### Porkbun DNS

Porkbun → domain → **DNS Records**. Use values from Vercel’s domain screen (typical):

| Type | Host | Answer / Value |
|------|------|----------------|
| A | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |

- Delete conflicting **A** records on `@` before adding Vercel’s A record
- Save and wait **10–30 minutes** for propagation
- SSL is automatic on Vercel

## 3. GitHub Pages — removed

Production is **ephemerent.com on Vercel only**. The GitHub Pages workflow has been
removed so there's a single origin (two live origins break Supabase OAuth callbacks).
If Pages was ever enabled, also set repo **Settings → Pages → Source: None**.

## 4. OAuth after domain is live

When enabling Google/GitHub login, add production URLs in Supabase — see [CLOUD.md](./CLOUD.md):

```
https://ephemerent.com/**
https://www.ephemerent.com/**
```

`assets/site-config.js` uses `window.location.origin` for redirects — no code change needed on the custom domain.

## 5. Pricing / billing

No public no-cost local tier is advertised. Pro is `$40/month` and includes hosted credits, cloud sign-in, Nexus operations, BYOK/local route entitlement, managed connector automation, and cloud audit/proof features.

Before taking payments:

1. Create a Stripe Payment Link, Checkout Session endpoint, or equivalent merchant checkout for the Pro monthly plan.
2. Paste that public checkout URL into `PRO_CHECKOUT_URL` in `assets/site-config.js`.
3. Deploy a Stripe webhook or Supabase Edge Function that listens for checkout, renewal, cancellation, and failed-payment events.
4. Have the webhook update `profiles.plan`, `profiles.subscription_status`, credit counters, `buddy_access`, and `billing_events`. Cloud auth identities should have no cloud entitlements until this happens.

Do not put Stripe secret keys in this repository's static files.

## 6. Download bundle (gated during beta)

`assets/site-config.js` has `RELEASE_AVAILABLE: false`, so `download.html` shows a
**"Request beta access"** state (sign in / email) instead of a download link.

When the installer is ready:

1. Build it from `buddyide` and publish a **GitHub Release** with `orrery-install.zip`
   (see [releases/README.md](../releases/README.md)) — `DOWNLOAD_URL` already points at
   `releases/latest/download/orrery-install.zip`.
2. Set `RELEASE_AVAILABLE: true` in `assets/site-config.js` and push.
3. Grant testers access: in Supabase Table Editor, flip `profiles.download_approved = true`
   (new sign-ups default to `false` — a closed-beta waitlist).
