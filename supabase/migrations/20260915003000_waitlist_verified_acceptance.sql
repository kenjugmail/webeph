create table public.company_waitlist_receipts(id uuid primary key,submission_hash text not null,created_at timestamptz not null default now());
alter table public.company_waitlist_receipts enable row level security;
revoke all on public.company_waitlist_receipts from public,anon,authenticated;
create index company_waitlist_created_idx on public.company_waitlist(created_at);
create or replace function public.consume_company_waitlist_quota(email_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if email_hash !~ '^[a-f0-9]{64}$' or email_hash is null then return false;end if;
 delete from public.company_waitlist_quota where window_start<now()-interval '2 days';
 insert into public.company_waitlist_quota values(email_hash,date_trunc('hour',now()),1)
 on conflict(bucket,window_start)do update set attempts=least(public.company_waitlist_quota.attempts+1,6)returning attempts into n;
 return n<=5;
end $$;
create function public.accept_company_waitlist(submission jsonb,challenge_id uuid,submission_hash text)returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(905051001);
 delete from public.company_waitlist_receipts where created_at<now()-interval '1 day';
 if exists(select 1 from public.company_waitlist_receipts where id=challenge_id and company_waitlist_receipts.submission_hash=accept_company_waitlist.submission_hash)then return;end if;
 perform public.join_company_waitlist(submission);
 if(select count(*)from public.company_waitlist where created_at>now()-interval '1 hour')>200
 or(select count(*)from public.company_waitlist where created_at>now()-interval '1 day')>1000 then raise exception 'Acceptance capacity reached';end if;
 insert into public.company_waitlist_receipts(id,submission_hash)values(challenge_id,submission_hash);
end $$;
revoke all on function public.accept_company_waitlist(jsonb,uuid,text)from public,anon,authenticated;
grant execute on function public.accept_company_waitlist(jsonb,uuid,text)to service_role;
