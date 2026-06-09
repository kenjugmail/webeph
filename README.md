# Ephemerent + Orrery

Static marketing site for **Ephemerent** (research lab) and **Orrery** (agentic code editor).
Orrery is built on [buddyide](https://github.com/kenjugmail/buddyide) — sidecar + web UI.

## Two ways to use Orrery

| | **Local** | **Cloud account** |
|---|-----------|-------------------|
| Setup | None | Free Supabase project (~5 min) |
| Auth | Optional email on device | Google / GitHub / email |
| Access | Desktop editor | Desktop + phone (relay coming) |
| Like | Offline editor | Cursor / Claude web + mobile |

See **[docs/CLOUD.md](docs/CLOUD.md)** for cloud setup and the phone/remote roadmap.

## Structure

```
index.html               Redirect → Ephemerent.html (the "/" landing)
Ephemerent.html          Lab page (research, work, approach, 10% pledge)
Orrery.html              Orrery product page
Vellum.html              Vellum (3D) product page
download.html            Download / beta-access gate (RELEASE_AVAILABLE flag)
login.html               Local vs cloud sign-in
cloud.html               Cloud dashboard + sign-in
privacy.html             Privacy Policy
terms.html               Terms of Service
robots.txt · sitemap.xml SEO
assets/
  site-config.js         Download URL, RELEASE_AVAILABLE, optional cloud auth keys
  identity.js            Local optional email + audit
  cloud-auth.js          Cloud OAuth (when configured)
  favicon.svg · og.svg   Brand icon + social card
docs/CLOUD.md            Architecture: relay, phone, pairing
```

## Beta status

- **Download is gated.** `RELEASE_AVAILABLE: false` in `assets/site-config.js` →
  `download.html` shows "request beta access". Flip to `true` once a GitHub Release with
  `orrery-install.zip` is live (see [docs/DEPLOY.md](docs/DEPLOY.md)).
- **Closed-beta waitlist.** New cloud sign-ups default to `download_approved = false`; grant
  access per user in Supabase. Enable cloud by pasting your Supabase URL + anon key into
  `site-config.js` (anon key only — see [docs/CLOUD.md](docs/CLOUD.md)).
- **Single host.** Vercel only; the GitHub Pages workflow was removed to keep one OAuth origin.

## Deploy (Vercel + ephemerent.com)

See **[docs/DEPLOY.md](docs/DEPLOY.md)** — import `kenjugmail/webeph` on Vercel (no build), then point Porkbun DNS at Vercel.

## Local dev

```powershell
python -m http.server 8080
```

## Orrery runtime (buddyide)

```powershell
cd c:\Users\kenju\Documents\buddyide
pnpm install
pnpm --filter @ed/sidecar start   # terminal 1
pnpm --filter @ed/web dev         # terminal 2 → http://localhost:5173
```
