-- Purchase-gated Genesis Fall direct downloads.
-- Release binaries remain private in Supabase Storage and are exposed only
-- through short-lived signed URLs after a paid Stripe session is revalidated.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'genesis-fall-releases',
  'genesis-fall-releases',
  false,
  1073741824,
  array['application/zip', 'application/octet-stream']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.genesis_fall_release_artifacts (
  id uuid primary key default extensions.gen_random_uuid(),
  release_version text not null check (release_version ~ '^[0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+$'),
  platform text not null check (platform in ('macos-arm64', 'windows-x64')),
  object_path text not null unique check (
    object_path ~ '^[A-Za-z0-9._/-]{8,240}$'
    and object_path not like '/%'
    and object_path not like '%..%'
  ),
  download_filename text not null check (download_filename ~ '^[A-Za-z0-9._-]{8,160}\.zip$'),
  content_type text not null default 'application/zip'
    check (content_type in ('application/zip', 'application/octet-stream')),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes bigint not null check (size_bytes between 1 and 1073741824),
  build_sha text not null check (build_sha ~ '^[a-f0-9]{7,40}$'),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index genesis_fall_release_artifacts_active_platform_idx
  on public.genesis_fall_release_artifacts (platform)
  where active;

create table public.genesis_fall_direct_orders (
  id uuid primary key default extensions.gen_random_uuid(),
  checkout_session_id text not null unique check (checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  payment_intent_id text not null unique check (payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
  purchaser_email_hash text not null check (purchaser_email_hash ~ '^[a-f0-9]{64}$'),
  stripe_product_id text not null check (stripe_product_id ~ '^prod_[A-Za-z0-9]+$'),
  stripe_price_id text not null check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  stripe_payment_link_id text not null check (stripe_payment_link_id ~ '^plink_[A-Za-z0-9_]+$'),
  stripe_livemode boolean not null check (stripe_livemode),
  amount_subtotal integer not null check (amount_subtotal = 2000),
  tax_amount integer not null check (tax_amount >= 0),
  amount_total integer not null check (amount_total = amount_subtotal + tax_amount),
  currency text not null check (currency = 'usd'),
  checkout_mode text not null check (checkout_mode = 'payment'),
  payment_status text not null check (payment_status = 'paid'),
  fulfillment_status text not null default 'paid'
    check (fulfillment_status in ('paid', 'manual_review', 'refunded', 'disputed')),
  review_reason text check (review_reason is null or review_reason in ('refund', 'dispute', 'operator_review')),
  latest_stripe_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index genesis_fall_direct_orders_email_hash_idx
  on public.genesis_fall_direct_orders (purchaser_email_hash);
create index genesis_fall_direct_orders_status_idx
  on public.genesis_fall_direct_orders (fulfillment_status);

alter table public.genesis_fall_release_artifacts enable row level security;
alter table public.genesis_fall_direct_orders enable row level security;

revoke all on table public.genesis_fall_release_artifacts from public, anon, authenticated;
revoke all on table public.genesis_fall_direct_orders from public, anon, authenticated;

grant select, insert, update on public.genesis_fall_release_artifacts to service_role;
grant select, insert, update on public.genesis_fall_direct_orders to service_role;

create or replace function public.genesis_fall_direct_release_ready()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(distinct platform) = 2
  from public.genesis_fall_release_artifacts
  where active
    and release_version = '0.1.0-beta.1';
$$;

create or replace function public.register_genesis_fall_direct_order(
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
  v_order public.genesis_fall_direct_orders%rowtype;
  v_review_reason text;
  v_review_event_id text;
begin
  if not p_stripe_livemode
     or p_amount_subtotal <> 2000
     or p_tax_amount < 0
     or p_amount_total <> p_amount_subtotal + p_tax_amount
     or p_currency <> 'usd'
     or p_checkout_mode <> 'payment'
     or p_payment_status <> 'paid' then
    raise exception using errcode = '22023', message = 'invalid_direct_purchase_contract';
  end if;

  insert into public.genesis_fall_direct_orders (
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
  from public.genesis_fall_direct_orders
  where checkout_session_id = p_checkout_session_id
  for update;

  if v_order.id is null
     or v_order.payment_intent_id <> p_payment_intent_id
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
    raise exception using errcode = '23505', message = 'direct_order_contract_conflict';
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
    update public.genesis_fall_direct_orders
       set fulfillment_status = 'manual_review',
           review_reason = v_review_reason,
           latest_stripe_event_id = v_review_event_id,
           updated_at = now()
     where id = v_order.id;
    return jsonb_build_object('status', 'manual_review', 'review_reason', v_review_reason);
  end if;

  if v_order.fulfillment_status <> 'paid' then
    return jsonb_build_object(
      'status', 'manual_review',
      'review_reason', coalesce(v_order.review_reason, v_order.fulfillment_status)
    );
  end if;

  update public.genesis_fall_direct_orders
     set latest_stripe_event_id = coalesce(p_stripe_event_id, latest_stripe_event_id),
         updated_at = now()
   where id = v_order.id;

  return jsonb_build_object('status', 'paid', 'order_id', v_order.id);
end;
$$;

create or replace function public.mark_genesis_fall_direct_order_manual_review(
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
begin
  if p_reason not in ('refund', 'dispute') then
    raise exception using errcode = '22023', message = 'invalid_review_reason';
  end if;

  update public.stripe_webhook_events
     set related_payment_intent_id = p_payment_intent_id,
         updated_at = now()
   where event_id = p_stripe_event_id;

  update public.genesis_fall_direct_orders
     set fulfillment_status = 'manual_review',
         review_reason = p_reason,
         latest_stripe_event_id = p_stripe_event_id,
         updated_at = now()
   where payment_intent_id = p_payment_intent_id
  returning id into v_order_id;

  return v_order_id is not null;
end;
$$;

revoke all on function public.genesis_fall_direct_release_ready() from public, anon, authenticated;
revoke all on function public.register_genesis_fall_direct_order(text, text, text, text, text, text, boolean, integer, integer, integer, text, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_genesis_fall_direct_order_manual_review(text, text, text) from public, anon, authenticated;

grant execute on function public.genesis_fall_direct_release_ready() to service_role;
grant execute on function public.register_genesis_fall_direct_order(text, text, text, text, text, text, boolean, integer, integer, integer, text, text, text, text) to service_role;
grant execute on function public.mark_genesis_fall_direct_order_manual_review(text, text, text) to service_role;

comment on table public.genesis_fall_release_artifacts is
  'Private release manifest. Object contents live in the private genesis-fall-releases Storage bucket.';
comment on column public.genesis_fall_direct_orders.purchaser_email_hash is
  'Lowercased/trimmed purchaser email HMAC-SHA-256 using a server-only secret; never raw email.';
