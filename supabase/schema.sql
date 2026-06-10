-- Ephemerent / Orrery — profiles, activity logs, download gate
-- Run in Supabase SQL Editor after creating your project.

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  download_approved boolean not null default false,
  display_name text,
  avatar_url text,
  is_admin boolean not null default false,
  plan text not null default 'free',
  subscription_status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  cloud_credit_granted_cents integer not null default 0,
  cloud_credit_used_cents integer not null default 0,
  buddy_access boolean not null default false,
  plan_updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists subscription_status text not null default 'inactive';
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists cloud_credit_granted_cents integer not null default 0;
alter table public.profiles add column if not exists cloud_credit_used_cents integer not null default 0;
alter table public.profiles add column if not exists buddy_access boolean not null default false;
alter table public.profiles add column if not exists plan_updated_at timestamptz not null default now();

-- Plan tiers: free plus the paid pro/max/ultra subscriptions. Existing deployments
-- created with the old ('free','pro') constraint must run the migration snippet
-- in supabase/SETUP.md (drop + re-add) — the drop below makes a re-run idempotent.
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'pro', 'max', 'ultra'));

alter table public.profiles enable row level security;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
  on public.profiles for select
  using (public.is_admin_user());

drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Admins update all profiles" on public.profiles;
create policy "Admins update all profiles"
  on public.profiles for update
  using (public.is_admin_user())
  with check (public.is_admin_user());

create or replace function public.update_profile(
  display_name text default null,
  avatar_url text default null
)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  updated public.profiles;
begin
  update public.profiles
  set
    display_name = coalesce(update_profile.display_name, profiles.display_name),
    avatar_url = coalesce(update_profile.avatar_url, profiles.avatar_url)
  where id = auth.uid()
  returning * into updated;

  return updated;
end;
$$;

-- Activity logs — who did what (site + editor)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  action text not null,
  resource text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_user_id_idx on public.activity_logs (user_id);
create index if not exists activity_logs_action_idx on public.activity_logs (action);
create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "Users insert own activity" on public.activity_logs;
create policy "Users insert own activity"
  on public.activity_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users read own activity" on public.activity_logs;
create policy "Users read own activity"
  on public.activity_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Admins read all activity" on public.activity_logs;
create policy "Admins read all activity"
  on public.activity_logs for select
  using (public.is_admin_user());

-- Billing events — populated by your Stripe webhook/Edge Function.
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text,
  event_type text not null,
  amount_cents integer,
  currency text not null default 'usd',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_events_user_id_idx on public.billing_events (user_id);
create index if not exists billing_events_created_at_idx on public.billing_events (created_at desc);

alter table public.billing_events enable row level security;

drop policy if exists "Users read own billing events" on public.billing_events;
create policy "Users read own billing events"
  on public.billing_events for select
  using (auth.uid() = user_id);

drop policy if exists "Admins read all billing events" on public.billing_events;
create policy "Admins read all billing events"
  on public.billing_events for select
  using (public.is_admin_user());

-- Auto-create profile on signup (closed beta: download_approved = false;
-- flip a user to true in Table Editor to grant the download)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, download_approved, plan, subscription_status, buddy_access)
  values (
    new.id,
    new.email,
    false,
    'free',
    'inactive',
    false
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
