# Continue from another computer

The complete website is in https://github.com/kenjugmail/webeph on **polish/design-system**.
Use this branch, not the older `main` branch, to retain the current pages, releases and waitlist.

## Get the project

Install Git and a current Node.js LTS version, then run:

```sh
git clone --branch polish/design-system https://github.com/kenjugmail/webeph.git
cd webeph
npm ci
npx playwright install chromium
npx vercel login
npx vercel link --project ephemerent
npx vercel dev --listen 3111
```

Choose the existing Ephemerent account/team and project; do not create a new project.
Open http://localhost:3111 . In a second terminal, use `npm run verify` for the site checks,
`node scripts/check-waitlist.mjs` for the waitlist browser checks, and `npm run build` before publishing.
The full visual suite also requires Python 3 with Pillow and NumPy (`python3 -m pip install Pillow numpy` in a Python virtual environment).

## Save and publish

Review `git status` and `git diff`, add the intended files, then commit and push to
`polish/design-system`. Publish the same checkout with `npx vercel --prod`.
Always commit new pages, styles, scripts, images and route changes together. Deploying an
older checkout can remove pages that were only published from another computer.

## What is already hosted

- Website: https://ephemerent.com
- Ephemerent Intelligence: https://ephemerent.com/waitlist
- Private responses: https://ephemerent.com/waitlist/manage → sign in to Supabase → `company_waitlist_inbox`
- Supabase project: `wjjthkqwcyahamhjkeux`
- Vercel project: `ephemerent`

The waitlist database and submission function already run in Supabase; switching computers
or publishing the static website does not require recreating them. See `docs/WAITLIST.md`.
For authorized backend changes, install the Supabase CLI, sign in, and link the existing project.
The migrations and function source are in `supabase/`.

Credentials, local login sessions, `.env.local`, and `.vercel` are intentionally excluded from
GitHub. Sign in again on the new computer. Never commit service keys or copy them into browser assets.
Source and deployable website assets are versioned; local QA screenshots under `output/` can be regenerated.
