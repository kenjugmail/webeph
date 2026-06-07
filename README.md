# Ephemerent + Orrery

Static marketing site for **Ephemerent** (research lab) and **Orrery** (agentic code editor).
Orrery itself runs locally via [buddyide](https://github.com/kenjugmail/buddyide) — sidecar + web UI on your machine.

## Structure

```
Ephemerent.html          Research lab page
Orrery.html              Product landing page
login.html               Sign in (Google, GitHub, email magic link)
download.html            Auth-gated download + install steps
assets/
  auth.js                Supabase auth helpers
  auth.css               Login / account UI
  supabase-config.js     Project URL, anon key, download URL
supabase/
  schema.sql             Profiles + download_approved
  SETUP.md               Supabase + OAuth setup guide
releases/
  orrery-install.zip     Start scripts + INSTALL.md (upload to GitHub Release)
.github/workflows/
  pages.yml              GitHub Pages deploy on push to main
```

## Local dev

```powershell
cd c:\Users\kenju\Documents\webeph
python -m http.server 8080
# http://localhost:8080/Orrery.html
```

## Auth + downloads

1. Follow [supabase/SETUP.md](supabase/SETUP.md) — create project, run `schema.sql`, enable Google/GitHub/email.
2. Copy `assets/supabase-config.example.js` → `assets/supabase-config.js` and fill in keys.
3. Create a GitHub Release and attach `releases/orrery-install.zip` as `orrery-install.zip`.

Until Supabase is configured, login pages show setup instructions. Until a Release is published, the download button points at the release URL (404 until uploaded).

## Orrery runtime (buddyide)

```powershell
cd c:\Users\kenju\Documents\buddyide
pnpm install
pnpm harness                    # offline smoke test

$env:ED_PROVIDER = "ollama"
pnpm --filter @ed/sidecar start # terminal 1
pnpm --filter @ed/web dev       # terminal 2 → http://localhost:5173
```

Or unzip `orrery-install.zip` into a buddyide clone and run `start-orrery.ps1`.

## Design tokens

Fonts: Space Grotesk (display), Hanken Grotesk (body), IBM Plex Mono (mono).
Palette: steel-blue / teal / brass on near-black. See `assets/orrery.css`.
