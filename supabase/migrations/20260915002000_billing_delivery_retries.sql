create table public.billing_delivery_state(event_id text primary key,complete boolean not null default false,updated_at timestamptz not null default now());
create table public.billing_delivery_lock(id integer primary key check(id=1),lease_id uuid,lease_until timestamptz);
insert into public.billing_delivery_lock(id)values(1);
alter table public.billing_delivery_state enable row level security;
alter table public.billing_delivery_lock enable row level security;
revoke all on public.billing_delivery_state,public.billing_delivery_lock from public,anon,authenticated;
-- Old records remain distinguishable for reconciliation; historical events are not presumed completed.
create function public.billing_delivery_claim(p_event_id text,p_lease_id uuid) returns text
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.billing_delivery_lock where id=1 for update;
 if exists(select 1 from public.billing_delivery_state where event_id=p_event_id and complete)then return 'complete';end if;
 if exists(select 1 from public.billing_delivery_lock where id=1 and lease_until>now())then return 'busy';end if;
 update public.billing_delivery_lock set lease_id=p_lease_id,lease_until=now()+interval '10 minutes' where id=1;
 insert into public.billing_delivery_state(event_id)values(p_event_id)on conflict do nothing;
 return 'claimed';
end $$;
create function public.billing_delivery_finish(p_event_id text,p_lease_id uuid,p_complete boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.billing_delivery_lock where id=1 and lease_id=p_lease_id for update;
 if not found then raise exception 'Billing lease lost';end if;
 update public.billing_delivery_state set complete=p_complete,updated_at=now() where event_id=p_event_id;
 update public.billing_delivery_lock set lease_id=null,lease_until=null where id=1;
end $$;
create function public.apply_organization_compute_pack(p_team_id uuid,p_owner_id uuid,p_pack_id text,p_credits bigint,p_amount integer,p_payment_id text)returns void
language plpgsql security definer set search_path='' as $$
declare period_end timestamptz; grant_id uuid;
begin
 select c.current_period_end into period_end from public.organization_contracts c join public.teams t on t.id=c.team_id where c.team_id=p_team_id and t.owner_id=p_owner_id and c.state='active' and c.current_period_end>now() for update of c;
 if period_end is null then raise exception 'Active organization required';end if;
 insert into public.organization_compute_grants(team_id,pack_id,provider_credits,price_usd_cents,stripe_payment_id,granted_by,current_period_end)
 values(p_team_id,p_pack_id,p_credits,p_amount,p_payment_id,'stripe',period_end)on conflict(stripe_payment_id)do nothing returning id into grant_id;
 if grant_id is not null then update public.organization_contracts set add_on_provider_credits=add_on_provider_credits+p_credits,updated_at=now() where team_id=p_team_id;end if;
end $$;
revoke all on function public.billing_delivery_claim(text,uuid),public.billing_delivery_finish(text,uuid,boolean),public.apply_organization_compute_pack(uuid,uuid,text,bigint,integer,text)from public,anon,authenticated;
grant execute on function public.billing_delivery_claim(text,uuid),public.billing_delivery_finish(text,uuid,boolean),public.apply_organization_compute_pack(uuid,uuid,text,bigint,integer,text)to service_role;
