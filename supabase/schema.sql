-- Ephemerent / Orrery — profiles, activity logs, download gate
-- Run in Supabase SQL Editor after creating your project.

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  download_approved boolean not null default true,
  display_name text,
  avatar_url text,
  is_admin boolean not null default false
);

alter table public.profiles add column if not exists is_admin boolean not null default false;

alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

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

create policy "Users insert own activity"
  on public.activity_logs for insert
  with check (auth.uid() = user_id);

create policy "Users read own activity"
  on public.activity_logs for select
  using (auth.uid() = user_id);

create policy "Admins read all activity"
  on public.activity_logs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Auto-create profile on signup (open beta: download_approved = true)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, download_approved)
  values (
    new.id,
    new.email,
    true
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
