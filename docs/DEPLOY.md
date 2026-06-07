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
- `/download.html` → download
- `/login.html` → sign-in

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

## 3. GitHub Pages (optional)

This repo also has [.github/workflows/pages.yml](../.github/workflows/pages.yml) for `kenjugmail.github.io/webeph`.

For production, use **ephemerent.com on Vercel only**. Disable GitHub Pages (repo **Settings → Pages → Source: None**) to avoid duplicate OAuth callback URLs.

## 4. OAuth after domain is live

When enabling Google/GitHub login, add production URLs in Supabase — see [CLOUD.md](./CLOUD.md):

```
https://ephemerent.com/**
https://www.ephemerent.com/**
```

`assets/site-config.js` uses `window.location.origin` for redirects — no code change needed on the custom domain.

## 5. Download bundle

Publish a GitHub Release with `orrery-install.zip` so the download button works — see [releases/README.md](../releases/README.md).
