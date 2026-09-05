-- The browser can only reach the bounded Edge Function. No direct table/RPC access.
revoke all on public.company_waitlist from public, anon, authenticated;
revoke all on function public.join_company_waitlist(jsonb) from public, anon, authenticated;
grant execute on function public.join_company_waitlist(jsonb) to service_role;

create or replace function public.join_company_waitlist(submission jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare k text; v jsonb; cleaned jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(submission) is distinct from 'object' or octet_length(submission::text) > 16000 then
    raise exception 'Invalid submission' using errcode = '22023';
  end if;
  if submission->'consent' is distinct from 'true'::jsonb then
    raise exception 'Consent required' using errcode = '22023';
  end if;
  for k, v in select * from jsonb_each(submission) loop
    if k not in ('name','company','email','job_title','website','company_size','interests','problem','systems','timeline','pilot','notes','consent') then
      raise exception 'Unknown field' using errcode = '22023';
    end if;
    if k not in ('interests','consent') then
      if jsonb_typeof(v) <> 'string' or length(trim(submission->>k)) > (case when k in ('problem','systems','notes') then 3000 else 300 end) then
        raise exception 'Invalid field' using errcode = '22023';
      end if;
      cleaned := cleaned || jsonb_build_object(k, trim(submission->>k));
    end if;
  end loop;
  foreach k in array array['name','company','email','problem'] loop
    if coalesce(length(cleaned->>k),0) = 0 then raise exception 'Required field' using errcode = '22023'; end if;
  end loop;
  if cleaned->>'company_size' is null or cleaned->>'company_size' not in ('1–10','11–50','51–200','201–1,000','1,001–5,000','5,001+')
    or cleaned->>'timeline' is null or cleaned->>'timeline' not in ('As soon as available','Within 3–6 months','Within 6–12 months','Just exploring')
    or cleaned->>'pilot' is null or cleaned->>'pilot' not in ('Yes','Maybe','No')
    or cleaned->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or (coalesce(cleaned->>'website','') <> '' and cleaned->>'website' !~* '^https?://[^[:space:]]+$') then
    raise exception 'Invalid answer' using errcode = '22023';
  end if;
  if jsonb_typeof(submission->'interests') is distinct from 'array' then raise exception 'Invalid interests' using errcode = '22023'; end if;
  if jsonb_array_length(submission->'interests') not between 1 and 6 then raise exception 'Invalid interests' using errcode = '22023'; end if;
  for v in select * from jsonb_array_elements(submission->'interests') loop
    if jsonb_typeof(v) <> 'string' or (v #>> '{}') not in ('Internal company knowledge assistant','Custom fine-tuned language model','Continually updated organizational AI','Cybersecurity-specialized language model','Workflow or software integration','Other') then
      raise exception 'Invalid interest' using errcode = '22023';
    end if;
  end loop;
  cleaned := cleaned || jsonb_build_object('interests',submission->'interests','consent',true,'email',lower(cleaned->>'email'));
  insert into public.company_waitlist(email,name,company,details)
  values(cleaned->>'email',cleaned->>'name',cleaned->>'company',cleaned)
  on conflict(email) do nothing;
end;
$$;

create table public.company_waitlist_quota (
  bucket text not null,
  window_start timestamptz not null,
  attempts integer not null,
  primary key(bucket,window_start)
);
alter table public.company_waitlist_quota enable row level security;
revoke all on public.company_waitlist_quota from public,anon,authenticated;
create function public.consume_company_waitlist_quota(email_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare hour_start timestamptz := date_trunc('hour',now()); day_start timestamptz := date_trunc('day',now()); n integer;
begin
  if email_hash !~ '^[a-f0-9]{64}$' or email_hash is null then return false; end if;
  -- Serialize quota checks across workers; no instance-local counters to bypass.
  perform pg_advisory_xact_lock(905051001);
  delete from public.company_waitlist_quota where window_start < now() - interval '2 days';
  insert into public.company_waitlist_quota values('global-hour',hour_start,1)
  on conflict(bucket,window_start) do update set attempts = least(public.company_waitlist_quota.attempts + 1,201) returning attempts into n;
  if n > 200 then return false; end if;
  insert into public.company_waitlist_quota values('global-day',day_start,1)
  on conflict(bucket,window_start) do update set attempts = least(public.company_waitlist_quota.attempts + 1,1001) returning attempts into n;
  if n > 1000 then return false; end if;
  insert into public.company_waitlist_quota values(email_hash,hour_start,1)
  on conflict(bucket,window_start) do update set attempts = least(public.company_waitlist_quota.attempts + 1,6) returning attempts into n;
  return n <= 5;
end;
$$;
revoke all on function public.consume_company_waitlist_quota(text) from public,anon,authenticated;
grant execute on function public.consume_company_waitlist_quota(text) to service_role;

-- Prevent spreadsheet formulas in exported text supplied by visitors.
create function public.waitlist_csv_safe(value text) returns text
language sql immutable set search_path = '' as $$
  select case when value ~ '^[[:space:]]*[=+@-]' or value ~ '^[[:cntrl:]]'
    then chr(39) || value else value end;
$$;
revoke all on function public.waitlist_csv_safe(text) from public,anon,authenticated;
grant execute on function public.waitlist_csv_safe(text) to service_role;

-- Flattened private inbox for Supabase Table Editor and CSV exports.
create view public.company_waitlist_inbox with (security_invoker = true) as
select id,created_at,public.waitlist_csv_safe(name) as name,
 public.waitlist_csv_safe(company) as company,public.waitlist_csv_safe(email) as email,
 public.waitlist_csv_safe(details->>'job_title') as job_title,
 public.waitlist_csv_safe(details->>'website') as website,
 public.waitlist_csv_safe(details->>'company_size') as company_size,
 (select string_agg(value, '; ') from jsonb_array_elements_text(details->'interests')) as interests,
 public.waitlist_csv_safe(details->>'problem') as problem,
 public.waitlist_csv_safe(details->>'systems') as systems,
 public.waitlist_csv_safe(details->>'timeline') as timeline,
 public.waitlist_csv_safe(details->>'pilot') as pilot,
 public.waitlist_csv_safe(details->>'notes') as notes,
 details->>'consent' as consent,consent_version
from public.company_waitlist;
revoke all on public.company_waitlist_inbox from public,anon,authenticated;
grant select on public.company_waitlist_inbox to service_role;
