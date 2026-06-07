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
Orrery.html              Product page
cloud.html               Cloud dashboard + sign-in
login.html               Local vs cloud sign-in
download.html            Download bundle
assets/
  site-config.js         Download URL, optional cloud auth keys
  identity.js            Local optional email + audit
  cloud-auth.js          Cloud OAuth (when configured)
docs/CLOUD.md            Architecture: relay, phone, pairing
```

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
