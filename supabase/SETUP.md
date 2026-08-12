# Supabase setup for Orrery Cloud

Preview setup can be inspected before subscription; real agent work requires paid cloud entitlement.
Use this for paid Orrery Cloud: managed OAuth (Google/GitHub/email), hosted credits, subscription entitlements, and a central Postgres audit table.

# Supabase setup for Orrery sign-in + activity logs

## 1. Create project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Note **Project URL** and **anon public** key (Settings → API).

## 2. Run schema

SQL Editor → paste and run [`schema.sql`](./schema.sql).

Creates `profiles`, `activity_logs`, `billing_events`, plan fields, cloud credit counters, and RLS policies. Set `profiles.is_admin = true` for your account to review profiles, logs, and billing events in the Table Editor.

## 3. Auth providers

Authentication → Providers:

| Provider | Notes |
|----------|--------|
| **Email** | Enable; turn on **Confirm email** optional; enable **Magic Link** |
| **Google** | Create OAuth client in Google Cloud Console; add Client ID + Secret |
| **GitHub** | Settings → Developer settings → OAuth App; callback URL below |

## 4. Redirect URLs

Authentication → URL Configuration:

```
http://localhost:8080/**
http://127.0.0.1:8080/**
http://localhost:5173/**
http://127.0.0.1:5173/**
https://ephemerent.com/**
https://www.ephemerent.com/**
```

Site URL (production):

```
https://ephemerent.com
```

The editor (`localhost:5173`) uses the same Supabase project so sign-in works in the code editor.

## 5. Configure the static site

```powershell
copy assets\site-config.example.js assets\site-config.js
```

Edit `assets\site-config.js`:

- `CLOUD_AUTH_URL` — project URL
- `CLOUD_AUTH_KEY` — anon public key
- `DOWNLOAD_URL` — GitHub Release zip URL
- `STRIPE_PUBLISHABLE_KEY` — Stripe `pk_*` publishable key
- `STRIPE_PRODUCT_ID` — optional Stripe `prod_*` product id for reference only
- `PRO_CHECKOUT_URL` — Stripe Payment Link or hosted checkout URL for Pro at `$40/month`

Copy the same values into buddyide `apps/web/public/orrery-config.js` (see INSTALL.md).

The **anon key is safe in the browser**; access is enforced by Row Level Security.

## 6. Activity logs

Signed-in users insert rows into `activity_logs` from the site and editor:

| Action | Source |
|--------|--------|
| `auth.sign_in` | login / OAuth return |
| `download.bundle` | download button |
| `editor.open` | editor loads with session |
| `editor.prompt` | user sends a goal |
| `editor.orchestrate` | parallel DAG started |
| `editor.permission` | tool approval allow/deny |

Review logs: Table Editor → `activity_logs`, or query as an admin (`is_admin = true` on your profile).

## 7. Waitlist / download gate

Set default in `handle_new_user()` to `download_approved = false`, or flip individual users in Table Editor → `profiles`.

## 8. Plans / paid tiers

Any cloud auth identity starts with `profiles.plan = 'free'` and `cloud_credit_granted_cents = 0` until paid billing grants cloud access.

There are three paid tiers — `pro` ($40/mo), `max` ($100/mo), `ultra` ($200/mo). All include cloud sign-in, Orrery/Nexus paid features, and bundled DeepSeek API, Doubleword, and Arbiter credit pools (see `docs/CLOUD.md`).

**Migration for existing deployments** — projects created before the max/ultra tiers
have a check constraint that only allows `'free'`/`'pro'`. Widen it once in the SQL editor
(re-running the current `schema.sql` does the same thing):

```sql
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'pro', 'max', 'ultra'));
```

When a user purchases a paid tier, your Stripe webhook or admin process should set (replace `'pro'` with `'max'` or `'ultra'` as appropriate):

```sql
update public.profiles
set
  plan = 'pro',
  subscription_status = 'active',
  cloud_credit_granted_cents = 4000,
  cloud_credit_used_cents = 0,
  plan_updated_at = now()
where email = 'user@example.com';
```

Use `billing_events` to record checkout, renewal, cancellation, and credit grants.

## 9. Ephemerent Research journal

The same Supabase project also powers Ephemerent Research. Run the complete
[`schema.sql`](./schema.sql) after the existing Orrery tables are present. The
journal additions create private and public research storage buckets, RLS
policies, immutable version records, AI-assisted peer-review records, moderated
comments/reviews, and editor transition functions. Journal submissions do not use `plan`,
`subscription_status`, or `download_approved`.

Grant the separate editor role to an already-authenticated account from the
SQL editor. Replace the placeholder with the account UUID from
`auth.users`/`profiles`:

```sql
update public.profiles
set research_editor = true
where id = '00000000-0000-0000-0000-000000000000';
```

Then open `/journal/editor`. The **Stage local package** action accepts the
supplied `sncs_submission_package 2` folder, preserves each original file and
SHA-256 hash, and creates a private submission with an external-publication
hold. It does not make the manuscript visible in the public archive. Move the record
through screening into `peer_review`, then record at least one disclosed human+AI or
AI-system review before accepting it.

Keep the service role key out of the static site. The journal uses the browser
publishable key with RLS; only an editor session can move records or files into
the public bucket.

## 10. Service role key

Keep **service_role** secret. Only use in Edge Functions or local admin scripts — never in `assets/` or `public/`.
