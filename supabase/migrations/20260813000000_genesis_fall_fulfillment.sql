-- Genesis Fall Stripe-to-itch fulfillment.
-- Ownership URLs must be encrypted outside PostgreSQL with AES-256-GCM before
-- insertion. The database stores only opaque ciphertext and a keyed fingerprint.

create extension if not exists pgcrypto with schema extensions;

create table public.genesis_fall_key_inventory (
  id bigint generated always as identity primary key,
  key_ciphertext text not null check (key_ciphertext ~ '^v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$'),
  key_fingerprint text not null unique check (key_fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null default 'available' check (status in ('available', 'allocated', 'manual_review', 'revoked')),
  assigned_order_id uuid unique,
  created_at timestamptz not null default now(),
  allocated_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((status = 'available' and assigned_order_id is null and allocated_at is null)
      or (status <> 'available' and assigned_order_id is not null))
);

create table public.genesis_fall_orders (
  id uuid primary key default extensions.gen_random_uuid(),
  checkout_session_id text not null unique check (checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  payment_intent_id text not null unique check (payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
  purchaser_email_hash text not null check (purchaser_email_hash ~ '^[a-f0-9]{64}$'),
  stripe_product_id text not null check (stripe_product_id ~ '^prod_[A-Za-z0-9]+$'),
  stripe_price_id text not null check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  stripe_payment_link_id text not null check (stripe_payment_link_id ~ '^plink_[A-Za-z0-9_]+$'),
  stripe_livemode boolean not null,
  amount_subtotal integer not null check (amount_subtotal = 2000),
  tax_amount integer not null check (tax_amount >= 0),
  amount_total integer not null check (amount_total = amount_subtotal + tax_amount),
  currency text not null check (currency = 'usd'),
  checkout_mode text not null check (checkout_mode = 'payment'),
  payment_status text not null check (payment_status = 'paid'),
  fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'inventory_pending', 'fulfilled', 'manual_review', 'refunded', 'disputed')),
  review_reason text check (review_reason is null or review_reason in ('refund', 'dispute', 'operator_review')),
  key_inventory_id bigint unique references public.genesis_fall_key_inventory(id),
  latest_stripe_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  check ((fulfillment_status = 'fulfilled' and key_inventory_id is not null and fulfilled_at is not null)
      or fulfillment_status <> 'fulfilled')
);

alter table public.genesis_fall_key_inventory
  add constraint genesis_fall_key_inventory_order_fk
  foreign key (assigned_order_id) references public.genesis_fall_orders(id);

create table public.stripe_webhook_events (
  event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  event_type text not null check (char_length(event_type) between 3 and 96),
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1 check (attempts between 1 and 100),
  related_payment_intent_id text check (
    related_payment_intent_id is null or related_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'
  ),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{1,64}$'),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index genesis_fall_inventory_available_idx
  on public.genesis_fall_key_inventory (id) where status = 'available';
create index genesis_fall_orders_email_hash_idx
  on public.genesis_fall_orders (purchaser_email_hash);
create index genesis_fall_orders_status_idx
  on public.genesis_fall_orders (fulfillment_status);
create index stripe_webhook_events_payment_intent_idx
  on public.stripe_webhook_events (related_payment_intent_id)
  where related_payment_intent_id is not null;

alter table public.genesis_fall_key_inventory enable row level security;
alter table public.genesis_fall_orders enable row level security;
alter table public.stripe_webhook_events enable row level security;

revoke all on table public.genesis_fall_key_inventory from public, anon, authenticated;
revoke all on table public.genesis_fall_orders from public, anon, authenticated;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
revoke all on sequence public.genesis_fall_key_inventory_id_seq from public, anon, authenticated;

grant select, insert, update on public.genesis_fall_key_inventory to service_role;
grant select, insert, update on public.genesis_fall_orders to service_role;
grant select, insert, update on public.stripe_webhook_events to service_role;
grant usage, select on sequence public.genesis_fall_key_inventory_id_seq to service_role;

create or replace function public.genesis_fall_available_inventory()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.genesis_fall_key_inventory
  where status = 'available';
$$;

create or replace function public.begin_stripe_webhook_event(
  p_event_id text,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_started boolean := false;
begin
  insert into public.stripe_webhook_events (event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (event_id) do nothing;

  if found then
    return true;
  end if;

  update public.stripe_webhook_events
     set processing_status = 'processing',
         attempts = attempts + 1,
         error_code = null,
         updated_at = now()
   where event_id = p_event_id
     and event_type = p_event_type
     and (
       processing_status = 'failed'
       or (processing_status = 'processing' and updated_at < now() - interval '5 minutes')
     )
  returning true into v_started;

  return coalesce(v_started, false);
end;
$$;

create or replace function public.finish_stripe_webhook_event(
  p_event_id text,
  p_succeeded boolean,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.stripe_webhook_events
     set processing_status = case when p_succeeded then 'processed' else 'failed' end,
         error_code = case when p_succeeded then null else left(coalesce(p_error_code, 'processing_failed'), 64) end,
         processed_at = case when p_succeeded then now() else null end,
         updated_at = now()
   where event_id = p_event_id;
end;
$$;

create or replace function public.allocate_genesis_fall_order(
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_purchaser_email_hash text,
  p_stripe_product_id text,
  p_stripe_price_id text,
  p_stripe_payment_link_id text,
  p_stripe_livemode boolean,
  p_amount_subtotal integer,
  p_tax_amount integer,
  p_amount_total integer,
  p_currency text,
  p_checkout_mode text,
  p_payment_status text,
  p_stripe_event_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.genesis_fall_orders%rowtype;
  v_key public.genesis_fall_key_inventory%rowtype;
  v_available integer;
  v_review_reason text;
  v_review_event_id text;
begin
  if p_amount_subtotal <> 2000 or p_tax_amount < 0
     or p_amount_total <> p_amount_subtotal + p_tax_amount or p_currency <> 'usd'
     or p_checkout_mode <> 'payment' or p_payment_status <> 'paid' then
    raise exception using errcode = '22023', message = 'invalid_purchase_contract';
  end if;

  insert into public.genesis_fall_orders (
    checkout_session_id, payment_intent_id, purchaser_email_hash,
    stripe_product_id, stripe_price_id, stripe_payment_link_id, stripe_livemode,
    amount_subtotal, tax_amount, amount_total, currency,
    checkout_mode, payment_status, latest_stripe_event_id
  ) values (
    p_checkout_session_id, p_payment_intent_id, p_purchaser_email_hash,
    p_stripe_product_id, p_stripe_price_id, p_stripe_payment_link_id, p_stripe_livemode,
    p_amount_subtotal, p_tax_amount, p_amount_total, p_currency,
    p_checkout_mode, p_payment_status, p_stripe_event_id
  )
  on conflict (checkout_session_id) do nothing;

  select * into v_order
  from public.genesis_fall_orders
  where checkout_session_id = p_checkout_session_id
  for update;

  if v_order.id is null then
    raise exception using errcode = '23505', message = 'payment_intent_conflict';
  end if;

  if v_order.payment_intent_id <> p_payment_intent_id
     or v_order.purchaser_email_hash <> p_purchaser_email_hash
     or v_order.stripe_product_id <> p_stripe_product_id
     or v_order.stripe_price_id <> p_stripe_price_id
     or v_order.stripe_payment_link_id <> p_stripe_payment_link_id
     or v_order.stripe_livemode <> p_stripe_livemode
     or v_order.amount_subtotal <> p_amount_subtotal
     or v_order.tax_amount <> p_tax_amount
     or v_order.amount_total <> p_amount_total
     or v_order.currency <> p_currency
     or v_order.checkout_mode <> p_checkout_mode
     or v_order.payment_status <> p_payment_status then
    raise exception using errcode = '23505', message = 'order_contract_conflict';
  end if;

  select
    case when event_type = 'charge.refunded' then 'refund' else 'dispute' end,
    event_id
  into v_review_reason, v_review_event_id
  from public.stripe_webhook_events
  where related_payment_intent_id = p_payment_intent_id
    and event_type in ('charge.refunded', 'charge.dispute.created')
  order by received_at desc
  limit 1;

  if v_review_reason is not null then
    update public.genesis_fall_orders
       set fulfillment_status = 'manual_review',
           review_reason = v_review_reason,
           latest_stripe_event_id = v_review_event_id,
           updated_at = now()
     where id = v_order.id;
    return jsonb_build_object('status', 'manual_review', 'review_reason', v_review_reason);
  end if;

  if v_order.fulfillment_status in ('manual_review', 'refunded', 'disputed') then
    return jsonb_build_object(
      'status', 'manual_review',
      'review_reason', coalesce(v_order.review_reason, v_order.fulfillment_status)
    );
  end if;

  if v_order.key_inventory_id is not null then
    select * into v_key
    from public.genesis_fall_key_inventory
    where id = v_order.key_inventory_id;

    if v_key.status = 'allocated' then
      return jsonb_build_object(
        'status', 'fulfilled',
        'key_ciphertext', v_key.key_ciphertext,
        'available_inventory', public.genesis_fall_available_inventory()
      );
    end if;

    return jsonb_build_object('status', 'manual_review');
  end if;

  select * into v_key
  from public.genesis_fall_key_inventory
  where status = 'available'
  order by id
  for update skip locked
  limit 1;

  if v_key.id is null then
    update public.genesis_fall_orders
       set fulfillment_status = 'inventory_pending',
           latest_stripe_event_id = coalesce(p_stripe_event_id, latest_stripe_event_id),
           updated_at = now()
     where id = v_order.id;
    return jsonb_build_object('status', 'depleted', 'available_inventory', 0);
  end if;

  update public.genesis_fall_key_inventory
     set status = 'allocated',
         assigned_order_id = v_order.id,
         allocated_at = now(),
         updated_at = now()
   where id = v_key.id;

  update public.genesis_fall_orders
     set fulfillment_status = 'fulfilled',
         key_inventory_id = v_key.id,
         latest_stripe_event_id = coalesce(p_stripe_event_id, latest_stripe_event_id),
         fulfilled_at = now(),
         updated_at = now()
   where id = v_order.id;

  select public.genesis_fall_available_inventory() into v_available;
  return jsonb_build_object(
    'status', 'fulfilled',
    'key_ciphertext', v_key.key_ciphertext,
    'available_inventory', v_available
  );
end;
$$;

create or replace function public.mark_genesis_fall_order_manual_review(
  p_payment_intent_id text,
  p_reason text,
  p_stripe_event_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_key_id bigint;
begin
  if p_reason not in ('refund', 'dispute') then
    raise exception using errcode = '22023', message = 'invalid_review_reason';
  end if;

  update public.stripe_webhook_events
     set related_payment_intent_id = p_payment_intent_id,
         updated_at = now()
   where event_id = p_stripe_event_id;

  update public.genesis_fall_orders
     set fulfillment_status = 'manual_review',
         review_reason = p_reason,
         latest_stripe_event_id = p_stripe_event_id,
         updated_at = now()
   where payment_intent_id = p_payment_intent_id
  returning id, key_inventory_id into v_order_id, v_key_id;

  if v_order_id is null then
    return false;
  end if;

  if v_key_id is not null then
    update public.genesis_fall_key_inventory
       set status = 'manual_review', updated_at = now()
     where id = v_key_id and status = 'allocated';
  end if;

  return true;
end;
$$;

revoke all on function public.genesis_fall_available_inventory() from public, anon, authenticated;
revoke all on function public.begin_stripe_webhook_event(text, text) from public, anon, authenticated;
revoke all on function public.finish_stripe_webhook_event(text, boolean, text) from public, anon, authenticated;
revoke all on function public.allocate_genesis_fall_order(text, text, text, text, text, text, boolean, integer, integer, integer, text, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_genesis_fall_order_manual_review(text, text, text) from public, anon, authenticated;

grant execute on function public.genesis_fall_available_inventory() to service_role;
grant execute on function public.begin_stripe_webhook_event(text, text) to service_role;
grant execute on function public.finish_stripe_webhook_event(text, boolean, text) to service_role;
grant execute on function public.allocate_genesis_fall_order(text, text, text, text, text, text, boolean, integer, integer, integer, text, text, text, text) to service_role;
grant execute on function public.mark_genesis_fall_order_manual_review(text, text, text) to service_role;

comment on column public.genesis_fall_key_inventory.key_ciphertext is
  'AES-256-GCM opaque v1 envelope encrypted by a server-side/import tool; never plaintext.';
comment on column public.genesis_fall_orders.purchaser_email_hash is
  'Lowercased/trimmed purchaser email HMAC-SHA-256 using a server-only secret; never raw email.';
