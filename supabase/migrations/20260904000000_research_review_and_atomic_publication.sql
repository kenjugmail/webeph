-- Make acceptance version-specific and publish metadata plus file records atomically.

alter table public.research_reviews
  add column if not exists recommendation text not null default 'not_applicable'
  check (recommendation in ('accept','accept_after_changes','revise','reject','not_applicable'));

insert into storage.buckets (id, name, public, file_size_limit)
values ('research-public', 'research-public', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

create or replace function public.is_public_research_file(p_storage_path text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.research_files f
    join public.research_submissions s on s.id = f.submission_id
    where f.bucket_id = 'research-public'
      and f.storage_path = p_storage_path
      and f.visibility = 'public'
      and s.status in ('published','retracted')
  );
$$;

revoke all on function public.is_public_research_file(text) from public;
grant execute on function public.is_public_research_file(text) to anon, authenticated;

drop policy if exists "Research editors publish files" on storage.objects;
drop policy if exists "Research readers download committed files" on storage.objects;
create policy "Research readers download committed files"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'research-public' and public.is_public_research_file(name));

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
  latest_version_id uuid;
begin
  if not public.is_research_editor() then raise exception 'Research editor access required'; end if;
  if p_status not in ('submitted','screening','peer_review','changes_requested','accepted','withdrawn','retracted') then raise exception 'Invalid editorial status'; end if;
  if coalesce(p_notice_type, '') not in ('','correction','retraction','withdrawal') then raise exception 'Invalid public notice type'; end if;

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
    select id into latest_version_id
    from public.research_versions
    where submission_id = p_submission_id
    order by version_number desc
    limit 1;
    if latest_version_id is null then raise exception 'A versioned manuscript must enter peer review before acceptance'; end if;
    select count(*) into peer_review_count
    from public.research_reviews r
    where r.version_id = latest_version_id
      and r.status = 'published'
      and r.review_stage = 'prepublication'
      and r.review_type = 'Peer review with AI'
      and r.recommendation in ('accept','accept_after_changes')
      and r.reviewer_type in ('human_ai','ai_system');
    if peer_review_count < 1 then raise exception 'The latest version requires a published prepublication Peer review with AI recommendation of accept or accept after changes'; end if;
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

create or replace function public.publish_research_submission_with_files(
  p_submission_id uuid,
  p_slug text,
  p_public_files jsonb,
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
  file_row jsonb;
  clean_slug text;
  expected_prefix text;
  peer_review_count integer;
begin
  if not public.is_research_editor() then raise exception 'Research editor access required'; end if;
  if coalesce(p_notice_type, '') not in ('','correction','retraction') then raise exception 'Invalid public notice type'; end if;
  clean_slug := trim(coalesce(p_slug, ''));
  if clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(clean_slug) > 100 then raise exception 'A valid publication slug is required'; end if;
  if jsonb_typeof(p_public_files) <> 'array' or jsonb_array_length(p_public_files) < 1 then raise exception 'At least one approved public file is required'; end if;
  if jsonb_array_length(p_public_files) > 1000 then raise exception 'Too many public files in one publication transaction'; end if;

  select * into row from public.research_submissions where id = p_submission_id for update;
  if row.id is null then raise exception 'Submission not found'; end if;
  previous := row.status;
  if row.external_publication_hold then raise exception 'External publication hold must be cleared first'; end if;
  if row.status not in ('accepted','published') then raise exception 'Submission must be accepted before publication'; end if;

  if row.status = 'accepted' then
    select * into version_row from public.research_versions
    where submission_id = row.id order by version_number desc limit 1;
    if version_row.id is null then raise exception 'No reviewed immutable version exists'; end if;
    select count(*) into peer_review_count
    from public.research_reviews r
    where r.version_id = version_row.id
      and r.status = 'published'
      and r.review_stage = 'prepublication'
      and r.review_type = 'Peer review with AI'
      and r.recommendation in ('accept','accept_after_changes')
      and r.reviewer_type in ('human_ai','ai_system');
    if peer_review_count < 1 then raise exception 'The version being published has no qualifying Peer review with AI acceptance recommendation'; end if;
    version_no := version_row.version_number;
  else
    select coalesce(max(version_number), 0) + 1 into version_no from public.research_versions where submission_id = row.id;
    insert into public.research_versions (
      submission_id, version_number, title, summary, abstract, article_type, keywords,
      public_authors, accountable_name, accountability_declaration, ai_disclosure, external_links, file_note,
      funding_statement, conflict_statement, ethics_statement, license, public_notice_type, public_notice,
      created_by, published_at
    ) values (
      row.id, version_no, row.title, row.summary, row.abstract, row.article_type,
      row.keywords, row.public_authors, row.accountable_name, row.accountability_declaration,
      row.ai_disclosure, row.external_links, row.file_note, row.funding_statement,
      row.conflict_statement, row.ethics_statement, row.license,
      coalesce(nullif(trim(p_notice_type), ''), row.public_notice_type),
      coalesce(nullif(trim(p_public_notice), ''), row.public_notice), auth.uid(), now()
    ) returning * into version_row;
  end if;

  expected_prefix := 'published/' || clean_slug || '/v' || version_no::text || '/';
  for file_row in select value from jsonb_array_elements(p_public_files)
  loop
    if file_row->>'bucket_id' <> 'research-public' then raise exception 'Published files must use the research-public bucket'; end if;
    if position(expected_prefix in coalesce(file_row->>'storage_path', '')) <> 1 or position('..' in coalesce(file_row->>'storage_path', '')) > 0 then raise exception 'Published file path does not match the immutable version'; end if;
    if nullif(trim(file_row->>'original_filename'), '') is null or (file_row->>'original_filename') ~ '[/\\]' then raise exception 'Published file has an unsafe filename'; end if;
    if coalesce((file_row->>'byte_size')::bigint, 0) < 1 or (file_row->>'byte_size')::bigint > 52428800 then raise exception 'Published file exceeds the 50 MiB limit or is empty'; end if;
    if coalesce(file_row->>'sha256', '') !~ '^[0-9a-f]{64}$' then raise exception 'Published file requires a lowercase SHA-256 hash'; end if;
    if nullif(trim(file_row->>'mime_type'), '') is null or (file_row->>'mime_type') ~ E'[\\n\\r]' then raise exception 'Published file has an invalid MIME type'; end if;
    insert into public.research_files (
      submission_id, version_id, bucket_id, storage_path, original_filename,
      file_role, mime_type, byte_size, sha256, visibility, created_by
    ) values (
      row.id, version_row.id, 'research-public', file_row->>'storage_path',
      file_row->>'original_filename', coalesce(nullif(trim(file_row->>'file_role'), ''), 'supplement'),
      file_row->>'mime_type', (file_row->>'byte_size')::bigint,
      file_row->>'sha256', 'public', auth.uid()
    );
  end loop;

  if not exists (
    select 1 from jsonb_array_elements(p_public_files) f
    where lower(coalesce(f->>'mime_type', '')) = 'application/pdf'
       or lower(coalesce(f->>'original_filename', '')) ~ '\\.pdf$'
  ) then raise exception 'A published research version requires a PDF manuscript'; end if;

  update public.research_submissions
  set article_id = coalesce(article_id, 'ER-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.research_article_seq')::text, 4, '0')),
      slug = clean_slug,
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

do $$
begin
  if to_regprocedure('public.publish_research_submission(uuid,text,text,text,text)') is not null then
    execute 'revoke execute on function public.publish_research_submission(uuid,text,text,text,text) from public, anon, authenticated';
  end if;
end;
$$;

grant execute on function public.publish_research_submission_with_files(uuid, text, jsonb, text, text, text) to authenticated;

drop policy if exists "Research editors remove unpublished copies" on storage.objects;
create policy "Research editors remove unpublished copies"
  on storage.objects for delete to authenticated
  using (bucket_id = 'research-public' and public.is_research_editor());

create or replace view public.research_public_reviews as
select
  r.id, r.version_id, r.display_name, r.review_type, r.body,
  r.ai_disclosure, r.created_at, r.updated_at, r.reviewer_type, r.review_stage,
  r.recommendation
from public.research_reviews r
join public.research_versions v on v.id = r.version_id
join public.research_submissions s on s.id = v.submission_id
where r.status = 'published' and s.status in ('published','retracted');

grant select on public.research_public_reviews to anon, authenticated;
