# Optional: Supabase setup (not required)

Orrery uses **email sign-in + local audit logs** by default — no Supabase account needed.
Only follow this if you want managed OAuth (Google/GitHub) and a central Postgres audit table later.

# Supabase setup for Orrery sign-in + activity logs

## 1. Create project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Note **Project URL** and **anon public** key (Settings → API).

## 2. Run schema

SQL Editor → paste and run [`schema.sql`](./schema.sql).

Creates `profiles`, `activity_logs`, and RLS policies. Set `profiles.is_admin = true` for your account to review all logs in the Table Editor.

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
https://kenjugmail.github.io/webeph/**
https://YOUR_CUSTOM_DOMAIN/**
```

Site URL (production):

```
https://kenjugmail.github.io/webeph/
```

The editor (`localhost:5173`) uses the same Supabase project so sign-in works in the code editor.

## 5. Configure the static site

```powershell
copy assets\supabase-config.example.js assets\supabase-config.js
```

Edit `assets/supabase-config.js`:

- `SUPABASE_URL` — project URL
- `SUPABASE_ANON_KEY` — anon public key
- `DOWNLOAD_URL` — GitHub Release zip URL

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

## 8. Service role key

Keep **service_role** secret. Only use in Edge Functions or local admin scripts — never in `assets/` or `public/`.
