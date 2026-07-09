# Deploy webeph to Vercel + ephemerent.com

Static site - no build step. Repo: [github.com/kenjugmail/webeph](https://github.com/kenjugmail/webeph).

## 1. Vercel (after push to `main`)

Code is on GitHub. Import once:

1. [vercel.com](https://vercel.com) -> Sign in with **GitHub**
2. **Add New Project** -> Import `kenjugmail/webeph`
3. Framework Preset: **Other**
4. **Build Command:** leave empty
5. **Output Directory:** `.`
6. **Deploy**

Preview URL: `https://webeph-*.vercel.app`

Verify:

- `/` -> Ephemerent lab page
- `/Orrery.html` -> product
- `/Orrery.html#pricing` -> paid plan pricing
- `/download.html` -> download
- `/login.html` -> sign-in
- `/cloud.html` -> cloud account, plan, and billing CTA

### CLI (optional)

```powershell
cd c:\Users\kenju\Documents\webeph
npx vercel login
npx vercel --prod
```

## 2. Custom domain - ephemerent.com

### Vercel

1. Project -> **Settings -> Domains**
2. Add `ephemerent.com`
3. Add `www.ephemerent.com`
4. Set **ephemerent.com** as primary (redirect www -> apex if offered)

### Porkbun DNS

Porkbun -> domain -> **DNS Records**. Use values from Vercel's domain screen (typical):

| Type | Host | Answer / Value |
|------|------|----------------|
| A | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |

- Delete conflicting **A** records on `@` before adding Vercel's A record
- Save and wait **10-30 minutes** for propagation
- SSL is automatic on Vercel

## 3. GitHub Pages - removed

Production is **ephemerent.com on Vercel only**. The GitHub Pages workflow has been
removed so there is a single origin. Two live origins can break Supabase OAuth callbacks.
If Pages was ever enabled, also set repo **Settings -> Pages -> Source: None**.

## 4. OAuth after domain is live

When enabling Google/GitHub login, add production URLs in Supabase - see [CLOUD.md](./CLOUD.md):

```text
https://ephemerent.com/**
https://www.ephemerent.com/**
```

`assets/site-config.js` uses `window.location.origin` for redirects, so no code change is needed on the custom domain.

## 5. Pricing / billing

No public no-cost local tier is advertised. Pro is `$40/month` and includes hosted credits, cloud sign-in, Nexus operations, BYOK/local route entitlement, managed connector automation, and cloud audit/proof features.

Before taking payments:

1. Create Stripe Payment Links, Checkout Sessions, or equivalent merchant checkout for Pro/Max/Ultra monthly plans.
2. Paste the public checkout URLs into `PRO_CHECKOUT_URL`, `MAX_CHECKOUT_URL`, and `ULTRA_CHECKOUT_URL` in `assets/site-config.js`.
3. Deploy a Stripe webhook or Supabase Edge Function that listens for checkout, renewal, cancellation, and failed-payment events.
4. Have the webhook update `profiles.plan`, `profiles.subscription_status`, credit counters, `buddy_access`, and `billing_events`. Cloud auth identities should have no cloud entitlements until this happens.

Do not put Stripe secret keys in this repository's static files.

## 6. Download bundle and update channel

`assets/site-config.js` has `RELEASE_AVAILABLE: true`, so `download.html` shows the current
Windows beta packet and update metadata.

For the current beta:

1. Build it from `buddyide` and publish a **GitHub Release** in the binary-only
   `kenjugmail/orrery-releases` repo with `Orrery-0.1.0-beta-win-x64-portable.zip`.
2. Point `DOWNLOAD_URL` at that release asset.
3. Keep `RELEASE_VERSION`, `RELEASE_PAGE_URL`, `RELEASE_SHA256`, and `UPDATE_MODE` in
   `assets/site-config.js` synchronized with the binary release.
4. The current public packet is a portable Windows beta, so updates are manual: users
   download the newest zip from the website/release page. The desktop app has an
   electron-updater feed configured for signed installer builds later.
5. Grant testers access through Supabase billing/profile metadata for real agent runs.
