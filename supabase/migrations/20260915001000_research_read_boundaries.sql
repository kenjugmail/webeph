-- Public views expose published projections, never write access to source tables.
revoke all on public.research_publications, public.research_public_versions,
 public.research_public_files, public.research_public_comments, public.research_public_reviews
 from public,anon,authenticated;
grant select on public.research_publications, public.research_public_versions,
 public.research_public_files, public.research_public_comments, public.research_public_reviews
 to anon,authenticated;
-- A file row must belong to the submitter's draft, not just carry their created_by id.
drop policy if exists "Research submitters manage private files" on public.research_files;
create policy "Research submitters manage private files" on public.research_files
 for all to authenticated
 using (created_by=auth.uid() and visibility='private' and exists(select 1 from public.research_submissions s where s.id=submission_id and s.submitter_id=auth.uid() and s.status in ('draft','changes_requested')))
 with check (created_by=auth.uid() and visibility='private' and bucket_id='research-private' and storage_path like auth.uid()::text||'/%' and exists(select 1 from public.research_submissions s where s.id=submission_id and s.submitter_id=auth.uid() and s.status in ('draft','changes_requested')));
