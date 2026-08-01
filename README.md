# Ephemerent + Orrery

Static marketing site for **Ephemerent** (research lab) and **Orrery** (agentic code editor).
Orrery is built on [buddyide](https://github.com/kenjugmail/buddyide): sidecar + web UI.

## Orrery access model

| | **Preview / desktop setup** | **Orrery Cloud** |
|---|---|---|
| Setup | Download beta, sign in, open Nexus, prepare workspace/model routes | Supabase auth + Stripe billing |
| Auth | Required for current beta account flow | Google / GitHub / email |
| Access | Preview setup; real runs require subscription/trial or server-side beta grant | Pro/Max/Ultra subscriptions |
| Pricing | No public permanent free local plan | DeepSeek API, Doubleword, Arbiter, managed connectors, proof vault, cloud runs |
| Think of it as | Installed Orrery shell and local workspace setup | Hosted agent capacity and account-backed operations |

See **[docs/CLOUD.md](docs/CLOUD.md)** for cloud setup and the phone/remote roadmap.

## Structure

```text
index.html               Redirect -> Ephemerent.html (the "/" landing)
Ephemerent.html          Lab page (research, work, approach, 10% pledge)
arbiter-preview.html     Arbiter 0.1 beta blog/system preview + RunPod budget plan
Orrery.html              Orrery product page
Vellum.html              Vellum (3D) product page
download.html            Download + current beta update channel
login.html               Sign-in
cloud.html               Cloud dashboard + sign-in
privacy.html             Privacy Policy
terms.html               Terms of Service
robots.txt / sitemap.xml SEO
assets/
  site-config.js         Download URL, release metadata, Supabase anon key, plan catalog
  identity.js            Local optional email + audit
  cloud-auth.js          Cloud OAuth when configured
  favicon.svg / og.svg   Brand icon + social card
docs/CLOUD.md            Architecture: relay, phone, pairing
docs/DEPLOY.md           Vercel/domain/download/update release steps
```

## Beta status

- **Download is live.** `RELEASE_AVAILABLE: true` in `assets/site-config.js` makes
  `download.html` show the Windows beta packet.
- **Update channel is manual for the portable beta.** Keep `RELEASE_VERSION`,
  `RELEASE_PAGE_URL`, `RELEASE_SHA256`, and `UPDATE_MODE` synchronized with the
  binary-only `kenjugmail/orrery-releases` GitHub Release. The desktop app has
  electron-updater feed wiring for signed installer builds later.
- **Closed beta accounts.** New cloud auth identities have no cloud entitlement until
  a billing webhook, trial, invite, or admin grant updates Supabase profile metadata.
- **Pricing is configured in one public catalog.** `assets/site-config.js` defines
  preview/no-active-subscription plus Pro/Max/Ultra. Preview is not a public free
  local plan. Paid plans own cloud sign-in, DeepSeek API, Doubleword, Arbiter credits,
  Nexus cloud features, managed connectors, and cloud audit/proof.
- **Single host.** Vercel only; the GitHub Pages workflow was removed to keep one OAuth origin.

## Deploy (Vercel + ephemerent.com)

See **[docs/DEPLOY.md](docs/DEPLOY.md)**: import `kenjugmail/webeph` on Vercel
(no build), then point Porkbun DNS at Vercel.

## Local dev

```powershell
python -m http.server 8080
```

## Orrery runtime (buddyide)

```powershell
cd c:\Users\kenju\Documents\buddyide
pnpm install
pnpm --filter @ed/sidecar start   # terminal 1
pnpm --filter @ed/web dev         # terminal 2 -> http://localhost:5173
```
