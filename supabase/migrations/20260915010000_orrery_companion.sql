create table public.companion_devices(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 label text not null check(length(label) between 1 and 100),workspace_label text not null check(length(workspace_label) between 1 and 100),
 secret_hash text not null,code_hash text not null unique,code_expires_at timestamptz not null default now()+interval '10 minutes',
 paired_at timestamptz,revoked_at timestamptz,last_seen_at timestamptz,created_at timestamptz not null default now());
create table public.companion_tasks(
 id uuid primary key,user_id uuid not null references auth.users on delete cascade,device_id uuid not null references public.companion_devices on delete cascade,
 prompt text not null check(length(prompt) between 1 and 8000),state text not null default 'queued' check(state in ('queued','accepted','running','waiting','completed','failed','cancelled')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.companion_commands(
 id uuid primary key,task_id uuid not null references public.companion_tasks on delete cascade,
 kind text not null check(kind in ('start','followup','cancel','decision')),payload jsonb not null,
 claimed_at timestamptz,acknowledged_at timestamptz,created_at timestamptz not null default now());
create table public.companion_events(
 id uuid primary key,seq bigint generated always as identity,task_id uuid not null references public.companion_tasks on delete cascade,
 payload jsonb not null check(octet_length(payload::text)<=65536),created_at timestamptz not null default now());
create index companion_events_task_seq on public.companion_events(task_id,seq);
create table public.companion_approvals(
 task_id uuid not null references public.companion_tasks on delete cascade,request_id text not null,revision text not null,
 expires_at timestamptz not null default now()+interval '10 minutes',decision text check(decision in ('allow','deny')),primary key(task_id,request_id));
create index companion_tasks_owner on public.companion_tasks(user_id,created_at desc);
create index companion_commands_task on public.companion_commands(task_id,created_at);
alter table public.companion_devices enable row level security;
alter table public.companion_tasks enable row level security;
alter table public.companion_commands enable row level security;
alter table public.companion_events enable row level security;
alter table public.companion_approvals enable row level security;
revoke all on public.companion_devices,public.companion_tasks,public.companion_commands,public.companion_events,public.companion_approvals from public,anon,authenticated;

create function public.companion_user_action(p_user_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.companion_devices; t public.companion_tasks; c public.companion_commands; ident uuid; a public.companion_approvals;
begin
 if p_user_id is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>20000 then raise exception 'Invalid request' using errcode='22023'; end if;
 if p_action='list' then
  update public.companion_tasks set state='failed',updated_at=now() where user_id=p_user_id and state in ('accepted','running','waiting') and device_id in(select id from public.companion_devices where last_seen_at<now()-interval '90 seconds');
  return jsonb_build_object('devices',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'workspace_label',workspace_label,'paired_at',paired_at,'last_seen_at',last_seen_at,'online',last_seen_at>now()-interval '35 seconds')), '[]'::jsonb) from public.companion_devices where user_id=p_user_id and revoked_at is null and paired_at is not null),
  'tasks',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from(select id,device_id,prompt,state,created_at,updated_at from public.companion_tasks where user_id=p_user_id order by created_at desc limit 100) q));
 elsif p_action='register' then
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  update public.companion_devices set revoked_at=now() where user_id=p_user_id and paired_at is null and code_expires_at<now() and revoked_at is null;
  if (select count(*) from public.companion_devices where user_id=p_user_id and revoked_at is null)>=10 then raise exception 'Device limit reached'; end if;
  insert into public.companion_devices(user_id,label,workspace_label,secret_hash,code_hash) values(p_user_id,p_payload->>'label',p_payload->>'workspace_label',p_payload->>'secret_hash',p_payload->>'code_hash') returning * into d;
  return jsonb_build_object('device_id',d.id,'expires_at',d.code_expires_at);
 elsif p_action='pair' then
  update public.companion_devices set paired_at=now() where user_id=p_user_id and code_hash=p_payload->>'code_hash' and paired_at is null and revoked_at is null and code_expires_at>now() returning * into d;
  if d.id is null then raise exception 'Pairing code is invalid or expired' using errcode='22023'; end if;
  return jsonb_build_object('device_id',d.id);
 elsif p_action='revoke' then
  update public.companion_devices set revoked_at=now() where id=(p_payload->>'device_id')::uuid and user_id=p_user_id returning * into d;
  if d.id is null then raise exception 'Device unavailable' using errcode='42501'; end if;
  update public.companion_tasks set state='failed',updated_at=now() where device_id=d.id and state in ('queued','accepted','running','waiting');
  return '{"ok":true}';
 elsif p_action='events' then
  select * into t from public.companion_tasks where id=(p_payload->>'task_id')::uuid and user_id=p_user_id;
  if t.id is null then raise exception 'Task unavailable' using errcode='42501'; end if;
  return jsonb_build_object('task',to_jsonb(t),'events',(select coalesce(jsonb_agg(to_jsonb(q)),'[]') from(select seq,payload from public.companion_events where task_id=t.id and seq>coalesce((p_payload->>'after')::bigint,0) order by seq limit 100) q),
   'approvals',(select coalesce(jsonb_agg(to_jsonb(q)),'[]') from(select request_id,revision,expires_at from public.companion_approvals where task_id=t.id and decision is null and expires_at>now()) q));
 end if;
 ident:=(p_payload->>'id')::uuid;
 if ident is null then raise exception 'Idempotency id required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select c0.* into c from public.companion_commands c0 join public.companion_tasks t0 on t0.id=c0.task_id where c0.id=ident and t0.user_id=p_user_id;
 if c.id is not null then
  if c.kind<>p_action or c.payload<>p_payload then raise exception 'Idempotency conflict' using errcode='22023'; end if;
  return jsonb_build_object('task_id',c.task_id,'command_id',c.id,'duplicate',true);
 end if;
 if p_action='start' then
  select * into d from public.companion_devices where id=(p_payload->>'device_id')::uuid and user_id=p_user_id and paired_at is not null and revoked_at is null for update;
  if d.id is null or d.last_seen_at is null or d.last_seen_at<now()-interval '35 seconds' then raise exception 'Desktop offline' using errcode='22023'; end if;
  if exists(select 1 from public.companion_tasks where device_id=d.id and state in ('queued','accepted','running','waiting')) then raise exception 'Desktop already has a remote task'; end if;
  if (select count(*) from public.companion_tasks where user_id=p_user_id and created_at>now()-interval '1 hour')>=30 then raise exception 'Task rate limit reached'; end if;
  insert into public.companion_tasks(id,user_id,device_id,prompt) values(ident,p_user_id,d.id,p_payload->>'prompt') returning * into t;
 else
  select * into t from public.companion_tasks where id=(p_payload->>'task_id')::uuid and user_id=p_user_id for update;
  if t.id is null then raise exception 'Task unavailable' using errcode='42501'; end if;
  if t.state not in ('queued','accepted','running','waiting') then raise exception 'Task already ended' using errcode='22023'; end if;
  if p_action='decision' then
   select * into a from public.companion_approvals where task_id=t.id and request_id=p_payload->>'request_id' and revision=p_payload->>'revision' and decision is null and expires_at>now() for update;
   if a.task_id is null then raise exception 'Approval expired or changed' using errcode='22023'; end if;
   update public.companion_approvals set decision=p_payload->>'decision' where task_id=a.task_id and request_id=a.request_id;
  elsif p_action not in ('followup','cancel') then raise exception 'Unknown action' using errcode='22023'; end if;
 end if;
 insert into public.companion_commands(id,task_id,kind,payload) values(ident,t.id,p_action,p_payload);
 return jsonb_build_object('task_id',t.id,'command_id',ident);
end $$;

create function public.companion_device_action(p_device_id uuid,p_secret_hash text,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.companion_devices;t public.companion_tasks;c public.companion_commands;e jsonb;typ text;inserted uuid;
begin
 select * into d from public.companion_devices where id=p_device_id and secret_hash=p_secret_hash and revoked_at is null for update;
 if d.id is null then raise exception 'Device revoked or unknown' using errcode='42501'; end if;
 if p_action='identity' then return jsonb_build_object('user_id',d.user_id); end if;
 if d.paired_at is null then
  if d.code_expires_at<now() then raise exception 'Pairing expired' using errcode='42501'; end if;
  return '{"paired":false,"commands":[]}';
 end if;
 if p_action='poll' then
  update public.companion_devices set last_seen_at=now() where id=d.id;
  -- A lost command acknowledgement is not permission to run the command twice.
  update public.companion_tasks set state='failed',updated_at=now() where device_id=d.id and state in ('queued','accepted') and exists(select 1 from public.companion_commands c0 where c0.task_id=companion_tasks.id and c0.kind='start' and c0.claimed_at<now()-interval '90 seconds' and c0.acknowledged_at is null);
  select c0.* into c from public.companion_commands c0 join public.companion_tasks t0 on t0.id=c0.task_id where t0.device_id=d.id and t0.state in ('queued','accepted','running','waiting') and c0.claimed_at is null order by c0.created_at for update of c0 skip locked limit 1;
  if c.id is null then return '{"paired":true,"commands":[]}'; end if;
  update public.companion_commands set claimed_at=now() where id=c.id;
  if c.kind='start' then update public.companion_tasks set state='accepted',updated_at=now() where id=c.task_id; end if;
  return jsonb_build_object('paired',true,'commands',jsonb_build_array(jsonb_build_object('id',c.id,'task_id',c.task_id,'kind',c.kind,'payload',c.payload)));
 elsif p_action='ack' then
  update public.companion_commands set acknowledged_at=now() where id=(p_payload->>'command_id')::uuid and claimed_at is not null and task_id in(select id from public.companion_tasks where device_id=d.id);
  return '{"ok":true}';
 elsif p_action='event' then
  select * into t from public.companion_tasks where id=(p_payload->>'task_id')::uuid and device_id=d.id for update;
  if t.id is null then raise exception 'Task unavailable' using errcode='42501'; end if;
  e:=p_payload->'event';typ:=e->>'type';
  if (select count(*) from public.companion_events where task_id=t.id)>=10000 then raise exception 'Task event limit reached'; end if;
  if octet_length(e::text)>65536 then raise exception 'Event too large'; end if;
  insert into public.companion_events(id,task_id,payload) values((p_payload->>'event_id')::uuid,t.id,e) on conflict(id) do nothing returning id into inserted;
  if inserted is null then return '{"ok":true,"duplicate":true}'; end if;
  if t.state in ('completed','failed','cancelled') then return '{"ok":true}'; end if;
  if typ='permission.request' then
   insert into public.companion_approvals(task_id,request_id,revision) values(t.id,e->>'requestId',p_payload->>'revision') on conflict(task_id,request_id) do nothing;
   update public.companion_tasks set state='waiting',updated_at=now() where id=t.id;
  elsif typ in ('turn.complete','error') then
   update public.companion_tasks set state=case when typ='turn.complete' then 'completed' when e->>'category'='interrupted' then 'cancelled' else 'failed' end,updated_at=now() where id=t.id;
   delete from public.companion_approvals where task_id=t.id;
  else update public.companion_tasks set state='running',updated_at=now() where id=t.id; end if;
  return '{"ok":true}';
 end if;
 raise exception 'Unknown action' using errcode='22023';
end $$;
revoke all on function public.companion_user_action(uuid,text,jsonb),public.companion_device_action(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.companion_user_action(uuid,text,jsonb),public.companion_device_action(uuid,text,text,jsonb) to service_role;
