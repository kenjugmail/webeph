# Optional: Supabase setup (not required)

Orrery uses **local mode + local audit logs** by default — no Supabase account needed.
Only follow this if you want paid Pro cloud: managed OAuth (Google/GitHub/email), cloud credits, Buddy entitlement, and a central Postgres audit table.

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

## 8. Plans / Pro access

Free/local users do not need a Supabase row. Any cloud auth identity starts with `profiles.plan = 'free'`, `cloud_credit_granted_cents = 0`, and `buddy_access = false` until paid Pro billing grants cloud access.

When a user upgrades to Pro, your Stripe webhook or admin process should set:

```sql
update public.profiles
set
  plan = 'pro',
  subscription_status = 'active',
  cloud_credit_granted_cents = 4000,
  cloud_credit_used_cents = 0,
  buddy_access = true,
  plan_updated_at = now()
where email = 'user@example.com';
```

Use `billing_events` to record checkout, renewal, cancellation, and credit grants.

## 9. Service role key

Keep **service_role** secret. Only use in Edge Functions or local admin scripts — never in `assets/` or `public/`.
