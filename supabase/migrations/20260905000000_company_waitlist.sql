create table public.company_waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null unique check (length(email) <= 300 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  name text not null check (length(trim(name)) between 1 and 300),
  company text not null check (length(trim(company)) between 1 and 300),
  details jsonb not null check (octet_length(details::text) <= 16000),
  consent_version text not null default '2026-09-05'
);
alter table public.company_waitlist enable row level security;
revoke all on public.company_waitlist from anon, authenticated;
comment on table public.company_waitlist is 'Private company AI waitlist. Staff access via Supabase dashboard; no public read or update access.';
create function public.join_company_waitlist(submission jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if octet_length(submission::text) > 16000
     or submission->>'consent' is distinct from 'true'
     or jsonb_typeof(submission->'interests') is distinct from 'array'
     or nullif(trim(submission->>'company_size'), '') is null
     or nullif(trim(submission->>'timeline'), '') is null
     or nullif(trim(submission->>'pilot'), '') is null
     or nullif(trim(submission->>'problem'), '') is null then
    raise exception 'Invalid submission' using errcode = '22023';
  end if;
  if jsonb_array_length(submission->'interests') not between 1 and 6 then
    raise exception 'Select an interest' using errcode = '22023';
  end if;
  insert into public.company_waitlist(email, name, company, details)
  values (lower(trim(submission->>'email')), trim(submission->>'name'), trim(submission->>'company'), submission)
  on conflict (email) do nothing;
end;
$$;
revoke all on function public.join_company_waitlist(jsonb) from public;
grant execute on function public.join_company_waitlist(jsonb) to anon, authenticated;
