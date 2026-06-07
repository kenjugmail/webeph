# Supabase setup for Orrery login + downloads

## 1. Create project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Note **Project URL** and **anon public** key (Settings → API).

## 2. Run schema

SQL Editor → paste and run [`schema.sql`](./schema.sql).

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
https://kenjugmail.github.io/webeph/**
https://YOUR_CUSTOM_DOMAIN/**
```

Site URL (production):

```
https://kenjugmail.github.io/webeph/
```

## 5. Configure the static site

Copy the example config and fill in your keys:

```powershell
copy assets\supabase-config.example.js assets\supabase-config.js
```

Edit `assets/supabase-config.js`:

- `SUPABASE_URL` — project URL
- `SUPABASE_ANON_KEY` — anon public key
- `DOWNLOAD_URL` — GitHub Release zip URL (after you publish a release)

The **anon key is safe in the browser**; access is enforced by Row Level Security.

## 6. Waitlist mode (Phase 2)

Set default in `handle_new_user()` to `download_approved = false`, or flip individual users in Table Editor → `profiles`.

## 7. Service role key

Keep **service_role** secret. Only use in Edge Functions or local admin scripts — never in `assets/`.
