# Orrery Founding 100

Public page: https://ephemerent.com/orrery/founding (also `/founding`). Linked from the Orrery pricing section.

**The offer:** the first 100 developers get 30 days of Orrery Pro with no card, plus a direct line to the founder
(founders channel on Discord, written notes on shared run receipts, a 30-minute workflow session in week one).

## How a seat works

1. A visitor creates a free account (`/signin`) and confirms their email.
2. Back on `/orrery/founding` while signed in, the button becomes **Request my founding seat**: a prefilled email to
   kt@ephemerent.com with their account email, what they build, their current setup, and their first task.
3. You grant the seat with the existing operator grant (buddyide `scripts/grant-students.mjs`) in the
   `founding-100` cohort. No card, no Stripe, no renewal. After 30 days the account goes back to free.
4. Reply with the Discord founders-channel invite and a booking link for the workflow session.

Seats count only when you grant them, so sign-ups that never ask, and accounts nobody confirmed, don't use any up.
The grant refuses seat 101 (`founding_full`), and the page counter reads the same count.

## Backend (buddyide PR #11)

The grant change lives in https://github.com/kenjugmail/buddyide/pull/11: migration
`20260930000000_founding_100_grants.sql`, the `--cohort founding-100` CLI change, and a Docker Postgres test
(`node --test scripts/founding-grants-postgres.test.mjs`). The SQL is copied below for reference.

Until the migration is applied, `rpc/orrery_founding_seats` returns 404 and the page hides the counter; granting
non-RIT emails fails. To apply it, sign in to Supabase once and run from this repo:

```bash
SUPABASE_ACCESS_TOKEN=<personal access token> node scripts/apply-reviewed-migration.mjs ../buddyide-founding/supabase/migrations/20260930000000_founding_100_grants.sql --apply
```

Then `select public.orrery_founding_seats();` should return `{"total": 100, "claimed": 0}`.
Also create a `#founding` channel in the Discord (discord.gg/CPPhk3GNjz) and a booking link for the sessions.

## Granting

```bash
pnpm grant:students -- --cohort founding-100 --email dev@example.com
pnpm grant:students -- --cohort founding-100 --email dev@example.com --apply
pnpm grant:students -- --cohort founding-100 --list
```

`needs_signup` / `needs_email_confirmation` means they haven't finished step 1. `skipped_existing_access_or_billing`
means they already pay: add them to the channel anyway (the page promises this without using a seat).

## Migration SQL

```sql
-- Founding 100: the student Pro grant opened to any confirmed account in the `founding-100` cohort,
-- capped at 100 unrevoked seats. Still operator-issued: no card, no Stripe, 30 days, then back to free.
-- Every other cohort keeps the RIT-only rule. A public count lets /orrery/founding show seats left.
begin;
create or replace function public.orrery_student_pro(p_email text, p_cohort text, p_action text default 'preview')
returns jsonb language plpgsql security definer set search_path = public as $$
declare u auth.users%rowtype; p public.profiles%rowtype; g public.orrery_pro_grants%rowtype;
  v_email text := lower(trim(p_email));
  -- Founding 100 is open to any address; every other cohort stays RIT-only.
  v_pattern text := case when p_cohort = 'founding-100' then '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$' else '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@(g\.)?rit\.edu$' end;
begin
  if coalesce(auth.role(),'') in ('anon','authenticated') or (coalesce(auth.role(),'') <> 'service_role' and session_user not in ('postgres','supabase_admin')) then
    raise exception 'Operator authorization required' using errcode='42501';
  end if;
  if v_email is null or p_cohort is null or p_action is null or v_email !~ v_pattern or length(v_email)>254
    or p_cohort !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$' or p_action not in ('preview','grant','revoke') then
    raise exception 'Use a valid email (RIT for student cohorts), cohort, and action';
  end if;
  if p_action='revoke' then
    -- The original grant email remains usable if the attendee later changes their login email.
    select a.* into u from auth.users a join public.orrery_pro_grants ledger on ledger.user_id=a.id
      where ledger.email=v_email and ledger.cohort=p_cohort order by ledger.created_at desc limit 1;
  else
    select * into u from auth.users where lower(auth.users.email)=v_email;
  end if;
  if not found then return jsonb_build_object('email',v_email,'status',case when p_action='revoke' then 'no_grant' else 'needs_signup' end); end if;
  if p_action<>'revoke' and u.email_confirmed_at is null then return jsonb_build_object('email',v_email,'status','needs_email_confirmation'); end if;
  perform pg_advisory_xact_lock(hashtextextended('orrery-billing:'||u.id::text,0));
  select * into p from public.profiles where id=u.id for update;
  select * into g from public.orrery_pro_grants where user_id=u.id and cohort=p_cohort;
  if p_action='revoke' then
    if g.id is null then return jsonb_build_object('email',v_email,'status','no_grant'); end if;
    update public.orrery_pro_grants set revoked_at=coalesce(revoked_at,now()) where id=g.id;
    update public.profiles set plan='free', subscription_status='inactive', cloud_credit_granted_cents=0,
      plan_updated_at=now()
      where id=u.id and pro_grant_id=g.id and stripe_subscription_id is null;
    if found then
      update auth.users set raw_app_meta_data=(coalesce(raw_app_meta_data,'{}') - 'pro_grant_id' - 'pro_grant_expires_at')
        || jsonb_build_object('plan','free','subscription_status','inactive'), updated_at=now() where id=u.id;
    end if;
    return jsonb_build_object('email',v_email,'status','revoked');
  end if;
  if g.id is not null then
    return jsonb_build_object('email',v_email,'status',case when g.revoked_at is not null then 'revoked'
      when g.expires_at<=now() then 'expired' when p.pro_grant_id is distinct from g.id then 'superseded' else 'already_granted' end,'expires_at',g.expires_at);
  end if;
  if p.stripe_subscription_id is not null
    or (p.pro_grant_id is null and (p.subscription_status='active' or p.plan in ('pro','max','ultra')))
    or (p.pro_grant_id is not null and p.pro_grant_expires_at>now() and p.subscription_status='active') then
    return jsonb_build_object('email',v_email,'status','skipped_existing_access_or_billing');
  end if;
  if p_cohort='founding-100' then
    -- Serialize seat counting so two operator runs cannot both hand out seat 100.
    perform pg_advisory_xact_lock(hashtextextended('orrery-founding-100',0));
    if (select count(*) from public.orrery_pro_grants where cohort='founding-100' and revoked_at is null) >= 100 then
      return jsonb_build_object('email',v_email,'status','founding_full');
    end if;
  end if;
  if p_action='preview' then return jsonb_build_object('email',v_email,'status','eligible','days',30,'plan','pro'); end if;
  insert into public.orrery_pro_grants(user_id,email,cohort) values(u.id,v_email,p_cohort) returning * into g;
  insert into public.profiles(id,email,plan,subscription_status,cloud_credit_granted_cents,plan_updated_at,pro_grant_id,pro_grant_expires_at)
    values(u.id,v_email,'pro','active',4000,now(),g.id,g.expires_at)
    on conflict(id) do update set plan='pro',subscription_status='active',cloud_credit_granted_cents=4000,
      plan_updated_at=now(),pro_grant_id=g.id,pro_grant_expires_at=g.expires_at;
  update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}') || jsonb_build_object(
    'plan','pro','subscription_status','active','pro_grant_id',g.id,'pro_grant_expires_at',g.expires_at),updated_at=now() where id=u.id;
  return jsonb_build_object('email',v_email,'status','granted','expires_at',g.expires_at);
end $$;
revoke all on function public.orrery_student_pro(text,text,text) from public,anon,authenticated;
grant execute on function public.orrery_student_pro(text,text,text) to service_role;

create or replace function public.orrery_founding_seats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('total',100,'claimed',
    (select count(*) from public.orrery_pro_grants where cohort='founding-100' and revoked_at is null));
$$;
revoke all on function public.orrery_founding_seats() from public;
grant execute on function public.orrery_founding_seats() to anon, authenticated, service_role;
commit;
```
