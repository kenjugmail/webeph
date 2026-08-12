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
  plan_updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists subscription_status text not null default 'inactive';
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists cloud_credit_granted_cents integer not null default 0;
alter table public.profiles add column if not exists cloud_credit_used_cents integer not null default 0;
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
  insert into public.profiles (id, email, download_approved, plan, subscription_status)
  values (
    new.id,
    new.email,
    false,
    'free',
    'inactive'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ephemerent Research — open journal records, private intake, and moderated discussion.
-- This section is additive to the Orrery schema. Research access never depends on
-- plan, subscription_status, download_approved, or Stripe metadata.
alter table public.profiles
  add column if not exists research_editor boolean not null default false;

create or replace function public.is_research_editor()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (research_editor = true or is_admin = true)
  );
$$;

create sequence if not exists public.research_article_seq start 1;

create table if not exists public.research_submissions (
  id uuid primary key default gen_random_uuid(),
  article_id text unique,
  slug text unique,
  submitter_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft','submitted','screening','peer_review','changes_requested','accepted','published','withdrawn','retracted')),
  title text not null,
  summary text not null default '',
  abstract text,
  article_type text not null default 'Research note',
  keywords text[] not null default '{}',
  public_authors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(public_authors) = 'array'),
  accountable_name text not null default '',
  accountability_declaration boolean not null default false,
  ai_disclosure text not null default '',
  external_links text[] not null default '{}',
  file_note text not null default '',
  funding_statement text not null default '',
  conflict_statement text not null default '',
  ethics_statement text not null default '',
  rights_declaration boolean not null default false,
  safety_declaration boolean not null default false,
  publication_declaration boolean not null default false,
  external_publication_hold boolean not null default false,
  hold_reason text,
  license text not null default 'CC BY 4.0',
  editor_note text,
  public_notice_type text not null default ''
    check (public_notice_type in ('','correction','retraction','withdrawal')),
  public_notice text not null default '',
  published_at timestamptz,
  withdrawn_at timestamptz,
  retracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_submissions_status_idx
  on public.research_submissions (status, published_at desc);
create index if not exists research_submissions_submitter_idx
  on public.research_submissions (submitter_id, updated_at desc);

create table if not exists public.research_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.research_submissions (id) on delete cascade,
  version_number integer not null,
  title text not null,
  summary text not null default '',
  abstract text,
  article_type text not null default 'Research note',
  keywords text[] not null default '{}',
  public_authors jsonb not null default '[]'::jsonb,
  accountable_name text not null default '',
  accountability_declaration boolean not null default false,
  ai_disclosure text not null default '',
  external_links text[] not null default '{}',
  file_note text not null default '',
  funding_statement text not null default '',
  conflict_statement text not null default '',
  ethics_statement text not null default '',
  license text not null default 'CC BY 4.0',
  public_notice_type text not null default ''
    check (public_notice_type in ('','correction','retraction','withdrawal')),
  public_notice text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (submission_id, version_number)
);

create index if not exists research_versions_submission_idx
  on public.research_versions (submission_id, version_number desc);

create table if not exists public.research_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.research_submissions (id) on delete cascade,
  version_id uuid references public.research_versions (id) on delete set null,
  bucket_id text not null default 'research-private',
  storage_path text not null,
  original_filename text not null,
  file_role text not null default 'supplement',
  mime_type text not null default 'application/octet-stream',
  byte_size bigint not null default 0,
  sha256 text not null default '',
  visibility text not null default 'private'
    check (visibility in ('private','public')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket_id, storage_path)
);

create index if not exists research_files_submission_idx
  on public.research_files (submission_id, visibility, created_at);

create table if not exists public.research_editor_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.research_submissions (id) on delete cascade,
  editor_id uuid references auth.users (id) on delete set null,
  from_status text,
  to_status text not null,
  note text not null default '',
  checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists research_editor_events_submission_idx
  on public.research_editor_events (submission_id, created_at desc);

create table if not exists public.research_comments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.research_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default 'Reader',
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'pending'
    check (status in ('pending','published','hidden','withdrawn')),
  reply_to_id uuid references public.research_comments (id) on delete set null,
  is_author_response boolean not null default false,
  ai_disclosure text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_comments_version_idx
  on public.research_comments (version_id, status, created_at);

create table if not exists public.research_reviews (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.research_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default 'Reviewer',
  review_type text not null default 'Open review',
  reviewer_type text not null default 'human_ai'
    check (reviewer_type in ('human','ai_system','human_ai')),
  review_stage text not null default 'post_publication'
    check (review_stage in ('prepublication','post_publication')),
  body text not null check (char_length(body) between 1 and 20000),
  status text not null default 'pending'
    check (status in ('pending','published','hidden','withdrawn')),
  ai_disclosure text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_reviews_version_idx
  on public.research_reviews (version_id, status, created_at);

create table if not exists public.research_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_type text not null check (target_type in ('submission','file','comment','review')),
  target_id uuid not null,
  reason text not null,
  detail text not null default '',
  status text not null default 'open'
    check (status in ('open','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.research_interaction_events (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('comment','review')),
  target_id uuid not null,
  version_id uuid not null references public.research_versions (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  from_status text,
  to_status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists research_interaction_events_target_idx
  on public.research_interaction_events (target_type, target_id, created_at desc);

alter table public.research_submissions add column if not exists external_links text[] not null default '{}';
alter table public.research_submissions add column if not exists file_note text not null default '';
alter table public.research_submissions add column if not exists accountability_declaration boolean not null default false;
alter table public.research_submissions add column if not exists public_notice_type text not null default '';
alter table public.research_submissions add column if not exists public_notice text not null default '';
alter table public.research_versions add column if not exists external_links text[] not null default '{}';
alter table public.research_versions add column if not exists file_note text not null default '';
alter table public.research_versions add column if not exists accountability_declaration boolean not null default false;
alter table public.research_versions add column if not exists public_notice_type text not null default '';
alter table public.research_versions add column if not exists public_notice text not null default '';
alter table public.research_reviews add column if not exists reviewer_type text not null default 'human_ai';
alter table public.research_reviews add column if not exists review_stage text not null default 'post_publication';
alter table public.research_submissions drop constraint if exists research_submissions_status_check;
alter table public.research_submissions
  add constraint research_submissions_status_check
  check (status in ('draft','submitted','screening','peer_review','changes_requested','accepted','published','withdrawn','retracted'));
alter table public.research_reviews drop constraint if exists research_reviews_reviewer_type_check;
alter table public.research_reviews
  add constraint research_reviews_reviewer_type_check
  check (reviewer_type in ('human','ai_system','human_ai'));
alter table public.research_reviews drop constraint if exists research_reviews_review_stage_check;
alter table public.research_reviews
  add constraint research_reviews_review_stage_check
  check (review_stage in ('prepublication','post_publication'));

create or replace function public.research_submission_is_published(p_submission_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.research_submissions
    where id = p_submission_id and status in ('published','retracted')
  );
$$;

alter table public.research_submissions enable row level security;
alter table public.research_versions enable row level security;
alter table public.research_files enable row level security;
alter table public.research_editor_events enable row level security;
alter table public.research_comments enable row level security;
alter table public.research_reviews enable row level security;
alter table public.research_reports enable row level security;
alter table public.research_interaction_events enable row level security;

drop policy if exists "Research public published submissions" on public.research_submissions;

drop policy if exists "Research submitters read own submissions" on public.research_submissions;
create policy "Research submitters read own submissions"
  on public.research_submissions for select
  using (auth.uid() = submitter_id);

drop policy if exists "Research editors read all submissions" on public.research_submissions;
create policy "Research editors read all submissions"
  on public.research_submissions for select
  using (public.is_research_editor());

drop policy if exists "Research submitters create drafts" on public.research_submissions;
create policy "Research submitters create drafts"
  on public.research_submissions for insert
  with check (auth.uid() = submitter_id and status = 'draft');

drop policy if exists "Research submitters edit drafts" on public.research_submissions;
create policy "Research submitters edit drafts"
  on public.research_submissions for update
  using (auth.uid() = submitter_id and status in ('draft','changes_requested'))
  with check (auth.uid() = submitter_id and status in ('draft','changes_requested'));

drop policy if exists "Research public published versions" on public.research_versions;

drop policy if exists "Research submitters read own versions" on public.research_versions;
create policy "Research submitters read own versions"
  on public.research_versions for select
  using (exists (select 1 from public.research_submissions s where s.id = submission_id and s.submitter_id = auth.uid()));

drop policy if exists "Research editors manage versions" on public.research_versions;
drop policy if exists "Research editors read versions" on public.research_versions;
create policy "Research editors read versions"
  on public.research_versions for select
  using (public.is_research_editor());

drop policy if exists "Research editors create versions" on public.research_versions;
create policy "Research editors create versions"
  on public.research_versions for insert
  with check (public.is_research_editor());

create or replace function public.prevent_research_version_mutation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  raise exception 'Published research versions are immutable';
end;
$$;

drop trigger if exists research_versions_immutable on public.research_versions;
create trigger research_versions_immutable
  before update or delete on public.research_versions
  for each row execute function public.prevent_research_version_mutation();

drop policy if exists "Research public files" on public.research_files;

drop policy if exists "Research submitters manage private files" on public.research_files;
create policy "Research submitters manage private files"
  on public.research_files for all
  using (created_by = auth.uid() and visibility = 'private')
  with check (created_by = auth.uid() and visibility = 'private');

drop policy if exists "Research editors manage files" on public.research_files;
drop policy if exists "Research editors read files" on public.research_files;
create policy "Research editors read files"
  on public.research_files for select
  using (public.is_research_editor());

drop policy if exists "Research editors publish file records" on public.research_files;
create policy "Research editors publish file records"
  on public.research_files for insert
  with check (public.is_research_editor() and visibility = 'public');

drop policy if exists "Research editors read events" on public.research_editor_events;
create policy "Research editors read events"
  on public.research_editor_events for select
  using (public.is_research_editor());

drop policy if exists "Research submitters read own events" on public.research_editor_events;
create policy "Research submitters read own events"
  on public.research_editor_events for select
  using (exists (select 1 from public.research_submissions s where s.id = submission_id and s.submitter_id = auth.uid()));

drop policy if exists "Research public comments" on public.research_comments;

drop policy if exists "Research users read own comments" on public.research_comments;
create policy "Research users read own comments"
  on public.research_comments for select
  using (auth.uid() = user_id);

drop policy if exists "Research users create comments" on public.research_comments;
create policy "Research users create comments"
  on public.research_comments for insert
  with check (
    auth.uid() = user_id and status = 'pending'
    and exists (
      select 1
      from public.research_versions v
      join public.research_submissions s on s.id = v.submission_id
      where v.id = version_id and s.status in ('published','retracted')
    )
    and (is_author_response = false or exists (
      select 1 from public.research_versions v
      join public.research_submissions s on s.id = v.submission_id
      where v.id = version_id and s.submitter_id = auth.uid()
    ))
  );

drop policy if exists "Research users withdraw comments" on public.research_comments;
create policy "Research users withdraw comments"
  on public.research_comments for update
  using (auth.uid() = user_id and status in ('pending','published'))
  with check (auth.uid() = user_id and status = 'withdrawn');

drop policy if exists "Research editors moderate comments" on public.research_comments;
create policy "Research editors moderate comments"
  on public.research_comments for update
  using (public.is_research_editor())
  with check (public.is_research_editor());

drop policy if exists "Research public reviews" on public.research_reviews;

drop policy if exists "Research users read own reviews" on public.research_reviews;
create policy "Research users read own reviews"
  on public.research_reviews for select
  using (auth.uid() = user_id);

drop policy if exists "Research users create reviews" on public.research_reviews;
create policy "Research users create reviews"
  on public.research_reviews for insert
  with check (
    auth.uid() = user_id and status = 'pending'
    and reviewer_type in ('human','ai_system','human_ai')
    and (reviewer_type = 'human' or nullif(trim(ai_disclosure), '') is not null)
    and exists (
      select 1
      from public.research_versions v
      join public.research_submissions s on s.id = v.submission_id
      where v.id = version_id and s.status in ('published','retracted')
    )
  );

drop policy if exists "Research users withdraw reviews" on public.research_reviews;
create policy "Research users withdraw reviews"
  on public.research_reviews for update
  using (auth.uid() = user_id and status in ('pending','published'))
  with check (auth.uid() = user_id and status = 'withdrawn');

drop policy if exists "Research editors moderate reviews" on public.research_reviews;
create policy "Research editors moderate reviews"
  on public.research_reviews for update
  using (public.is_research_editor())
  with check (public.is_research_editor());

drop policy if exists "Research editors read reviews" on public.research_reviews;
create policy "Research editors read reviews"
  on public.research_reviews for select
  using (public.is_research_editor());

drop policy if exists "Research editors create reviews" on public.research_reviews;
create policy "Research editors create reviews"
  on public.research_reviews for insert
  with check (public.is_research_editor());

drop policy if exists "Research editors read interaction events" on public.research_interaction_events;
create policy "Research editors read interaction events"
  on public.research_interaction_events for select
  using (public.is_research_editor());

create or replace function public.log_research_interaction_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.research_interaction_events (
      target_type, target_id, version_id, actor_id, from_status, to_status
    ) values (
      case when tg_table_name = 'research_reviews' then 'review' else 'comment' end,
      new.id, new.version_id, auth.uid(), old.status, new.status
    );
  end if;
  return new;
end;
$$;

drop trigger if exists research_comments_audit_status on public.research_comments;
create trigger research_comments_audit_status
  after update of status on public.research_comments
  for each row execute function public.log_research_interaction_event();

drop trigger if exists research_reviews_audit_status on public.research_reviews;
create trigger research_reviews_audit_status
  after update of status on public.research_reviews
  for each row execute function public.log_research_interaction_event();

drop policy if exists "Research users create reports" on public.research_reports;
create policy "Research users create reports"
  on public.research_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Research users read own reports" on public.research_reports;
create policy "Research users read own reports"
  on public.research_reports for select
  using (auth.uid() = reporter_id);

drop policy if exists "Research editors manage reports" on public.research_reports;
create policy "Research editors manage reports"
  on public.research_reports for all
  using (public.is_research_editor())
  with check (public.is_research_editor());

-- Submitter transition: the browser can create/edit a draft, but only this
-- function can place it in the editorial queue.
create or replace function public.submit_research_submission(p_submission_id uuid)
returns public.research_submissions
language plpgsql
security definer set search_path = public
as $$
declare
  row public.research_submissions;
  private_file_count integer;
  previous text;
begin
  select * into row
  from public.research_submissions
  where id = p_submission_id and submitter_id = auth.uid()
  for update;

  if row.id is null or row.status not in ('draft','changes_requested') then
    raise exception 'Submission is not editable by this account';
  end if;

  if nullif(trim(row.title), '') is null or nullif(trim(row.summary), '') is null then
    raise exception 'A title and short description are required';
  end if;
  if jsonb_array_length(row.public_authors) < 1 or not exists (
    select 1 from jsonb_array_elements(row.public_authors) author
    where nullif(trim(author->>'name'), '') is not null
  ) then
    raise exception 'At least one named author or AI system is required';
  end if;
  if nullif(trim(row.accountable_name), '') is null or not row.accountability_declaration then
    raise exception 'An accountable submitter confirmation is required';
  end if;
  if nullif(trim(row.ai_disclosure), '') is null then
    raise exception 'AI authorship and contribution disclosure is required';
  end if;
  if not (row.rights_declaration and row.safety_declaration and row.publication_declaration) then
    raise exception 'Rights, safety, and publication declarations are required';
  end if;
  select count(*) into private_file_count
  from public.research_files
  where submission_id = row.id and visibility = 'private';
  if private_file_count < 1 then
    raise exception 'At least one private file is required';
  end if;

  previous := row.status;
  update public.research_submissions
  set status = 'submitted', updated_at = now()
  where id = row.id;
  select * into row from public.research_submissions where id = row.id;

  insert into public.research_editor_events (submission_id, editor_id, from_status, to_status, note)
  values (row.id, auth.uid(), previous, 'submitted', 'Submitted by accountable submitter');
  return row;
end;
$$;

-- Editor transition: status changes and their explanation are always audited.
drop function if exists public.set_research_submission_status(uuid, text, text, jsonb);
create or replace function public.set_research_submission_status(
  p_submission_id uuid,
  p_status text,
  p_note text default '',
  p_checklist jsonb default '{}'::jsonb,
  p_public_notice text default '',
  p_notice_type text default ''
)
returns public.research_submissions
language plpgsql
security definer set search_path = public
as $$
declare
  row public.research_submissions;
  previous text;
  peer_review_count integer;
begin
  if not public.is_research_editor() then
    raise exception 'Research editor access required';
  end if;
  if p_status not in ('submitted','screening','peer_review','changes_requested','accepted','withdrawn','retracted') then
    raise exception 'Invalid editorial status';
  end if;
  if coalesce(p_notice_type, '') not in ('','correction','retraction','withdrawal') then
    raise exception 'Invalid public notice type';
  end if;

  select status into previous from public.research_submissions where id = p_submission_id;
  if previous is null then raise exception 'Submission not found'; end if;
  if previous = 'draft' and p_status <> 'submitted' then raise exception 'Drafts must be submitted first'; end if;
  if previous = 'submitted' and p_status not in ('screening','changes_requested','withdrawn') then raise exception 'Submission must enter screening'; end if;
  if previous = 'screening' and p_status not in ('peer_review','changes_requested','withdrawn') then raise exception 'Screening must enter peer review'; end if;
  if previous = 'peer_review' and p_status not in ('peer_review','changes_requested','accepted','withdrawn') then raise exception 'Invalid peer-review transition'; end if;
  if previous = 'changes_requested' and p_status not in ('submitted','screening','peer_review','accepted','withdrawn') then raise exception 'Invalid changes-requested transition'; end if;
  if previous = 'accepted' and p_status not in ('withdrawn','retracted') then raise exception 'Accepted work can only be withdrawn or retracted before publication'; end if;
  if previous = 'published' and p_status not in ('withdrawn','retracted') then raise exception 'Published work can only be withdrawn or retracted'; end if;
  if previous = 'withdrawn' and p_status <> 'withdrawn' then raise exception 'Withdrawn work is closed'; end if;
  if previous = 'retracted' and p_status <> 'retracted' then raise exception 'Retracted work is closed'; end if;
  if p_status = 'accepted' then
    select count(*) into peer_review_count
    from public.research_reviews r
    join public.research_versions v on v.id = r.version_id
    where v.submission_id = p_submission_id
      and r.status = 'published'
      and r.review_stage = 'prepublication'
      and r.reviewer_type in ('human_ai','ai_system');
    if peer_review_count < 1 then raise exception 'At least one disclosed peer review with AI is required'; end if;
  end if;
  update public.research_submissions
  set status = p_status,
      editor_note = nullif(trim(p_note), ''),
      public_notice_type = case when nullif(trim(coalesce(p_notice_type, '')), '') is not null then trim(p_notice_type) else public_notice_type end,
      public_notice = case when nullif(trim(coalesce(p_public_notice, '')), '') is not null then trim(p_public_notice) else public_notice end,
      updated_at = now(),
      withdrawn_at = case when p_status = 'withdrawn' then now() else withdrawn_at end,
      retracted_at = case when p_status = 'retracted' then now() else retracted_at end
  where id = p_submission_id
  returning * into row;

  if p_status = 'peer_review' and previous <> 'peer_review' then
    insert into public.research_versions (
      submission_id, version_number, title, summary, abstract, article_type, keywords,
      public_authors, accountable_name, accountability_declaration, ai_disclosure,
      external_links, file_note, funding_statement, conflict_statement, ethics_statement,
      license, public_notice_type, public_notice, created_by
    )
    select
      row.id,
      coalesce((select max(version_number) + 1 from public.research_versions where submission_id = row.id), 1),
      row.title, row.summary, row.abstract, row.article_type, row.keywords,
      row.public_authors, row.accountable_name, row.accountability_declaration, row.ai_disclosure,
      row.external_links, row.file_note, row.funding_statement, row.conflict_statement, row.ethics_statement,
      row.license, row.public_notice_type, row.public_notice, auth.uid();
  end if;

  insert into public.research_editor_events (submission_id, editor_id, from_status, to_status, note, checklist)
  values (row.id, auth.uid(), previous, p_status, coalesce(p_note, ''), coalesce(p_checklist, '{}'::jsonb));
  return row;
end;
$$;

-- Publish a metadata snapshot as an immutable version and assign a provisional ID.
drop function if exists public.publish_research_submission(uuid, text, text);
create or replace function public.publish_research_submission(
  p_submission_id uuid,
  p_slug text,
  p_note text default '',
  p_public_notice text default '',
  p_notice_type text default ''
)
returns public.research_submissions
language plpgsql
security definer set search_path = public
as $$
declare
  row public.research_submissions;
  version_no integer;
  version_row public.research_versions;
  previous text;
begin
  if not public.is_research_editor() then raise exception 'Research editor access required'; end if;
  if coalesce(p_notice_type, '') not in ('','correction','retraction') then raise exception 'Invalid public notice type'; end if;
  select * into row from public.research_submissions where id = p_submission_id for update;
  if row.id is null then raise exception 'Submission not found'; end if;
  previous := row.status;
  if row.external_publication_hold then raise exception 'External publication hold must be cleared first'; end if;
  if row.status not in ('accepted','published') then raise exception 'Submission must be accepted before publication'; end if;

  select coalesce(max(version_number), 0) + 1 into version_no
  from public.research_versions where submission_id = row.id;

  insert into public.research_versions (
    submission_id, version_number, title, summary, abstract, article_type, keywords,
    public_authors, accountable_name, accountability_declaration, ai_disclosure, external_links, file_note, funding_statement,
    conflict_statement, ethics_statement, license, public_notice_type, public_notice, created_by, published_at
  ) values (
    row.id, version_no, row.title, row.summary, row.abstract, row.article_type,
    row.keywords, row.public_authors, row.accountable_name, row.accountability_declaration, row.ai_disclosure,
    row.external_links, row.file_note,
    row.funding_statement, row.conflict_statement, row.ethics_statement,
    row.license, coalesce(nullif(trim(p_notice_type), ''), row.public_notice_type),
    coalesce(nullif(trim(p_public_notice), ''), row.public_notice), auth.uid(), now()
  ) returning * into version_row;

  update public.research_submissions
  set article_id = coalesce(article_id, 'ER-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.research_article_seq')::text, 4, '0')),
      slug = coalesce(nullif(trim(p_slug), ''), slug),
      status = 'published',
      published_at = coalesce(published_at, now()),
      updated_at = now(),
      editor_note = nullif(trim(p_note), ''),
      public_notice_type = coalesce(nullif(trim(p_notice_type), ''), public_notice_type),
      public_notice = coalesce(nullif(trim(p_public_notice), ''), public_notice)
  where id = row.id
  returning * into row;

  insert into public.research_editor_events (submission_id, editor_id, from_status, to_status, note)
  values (row.id, auth.uid(), previous, 'published', coalesce(p_note, 'Published immutable journal version'));
  return row;
end;
$$;

-- Storage buckets: draft uploads remain private; editors copy approved files into
-- the public bucket. No upload policy grants anonymous write access.
insert into storage.buckets (id, name, public, file_size_limit)
values ('research-private', 'research-private', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

insert into storage.buckets (id, name, public, file_size_limit)
values ('research-public', 'research-public', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "Research private upload own path" on storage.objects;
create policy "Research private upload own path"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'research-private' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Research private read own path" on storage.objects;
create policy "Research private read own path"
  on storage.objects for select to authenticated
  using (bucket_id = 'research-private' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_research_editor()));

drop policy if exists "Research private delete own path" on storage.objects;
create policy "Research private delete own path"
  on storage.objects for delete to authenticated
  using (bucket_id = 'research-private' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_research_editor()));

drop policy if exists "Research editors publish files" on storage.objects;
create policy "Research editors publish files"
  on storage.objects for select to authenticated
  using (bucket_id = 'research-public' and public.is_research_editor());

drop policy if exists "Research editors create published files" on storage.objects;
create policy "Research editors create published files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'research-public' and public.is_research_editor());

-- Public API views deliberately omit submitter UUIDs, editor notes, hold reasons,
-- declarations, and all other private workflow fields. Public clients query these
-- views rather than the underlying tables.
create or replace view public.research_publications as
select
  id, article_id, slug, title, summary, abstract, article_type, keywords,
  public_authors, accountable_name, ai_disclosure, external_links,
  funding_statement, conflict_statement, ethics_statement, license,
  status, published_at, created_at, updated_at,
  public_notice_type, public_notice
from public.research_submissions
where status in ('published','retracted');

create or replace view public.research_public_versions as
select
  v.id, v.submission_id, v.version_number, v.title, v.summary, v.abstract,
  v.article_type, v.keywords, v.public_authors, v.accountable_name,
  v.ai_disclosure, v.external_links, v.funding_statement,
  v.conflict_statement, v.ethics_statement, v.license,
  v.created_at, v.published_at, v.public_notice_type, v.public_notice
from public.research_versions v
join public.research_submissions s on s.id = v.submission_id
where s.status in ('published','retracted');

create or replace view public.research_public_files as
select
  f.id, f.submission_id, f.version_id, f.bucket_id, f.storage_path,
  f.original_filename, f.file_role, f.mime_type, f.byte_size, f.sha256,
  f.created_at
from public.research_files f
join public.research_submissions s on s.id = f.submission_id
where f.visibility = 'public' and s.status in ('published','retracted');

create or replace view public.research_public_comments as
select
  c.id, c.version_id, c.display_name, c.body, c.is_author_response,
  c.ai_disclosure, c.created_at, c.updated_at
from public.research_comments c
join public.research_versions v on v.id = c.version_id
join public.research_submissions s on s.id = v.submission_id
where c.status = 'published' and s.status in ('published','retracted');

create or replace view public.research_public_reviews as
  select
  r.id, r.version_id, r.display_name, r.review_type, r.body,
  r.ai_disclosure, r.created_at, r.updated_at, r.reviewer_type, r.review_stage
from public.research_reviews r
join public.research_versions v on v.id = r.version_id
join public.research_submissions s on s.id = v.submission_id
where r.status = 'published' and s.status in ('published','retracted');

grant select on public.research_publications to anon, authenticated;
grant select on public.research_public_versions to anon, authenticated;
grant select on public.research_public_files to anon, authenticated;
grant select on public.research_public_comments to anon, authenticated;
grant select on public.research_public_reviews to anon, authenticated;
