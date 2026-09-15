-- Submitted manuscripts remain readable by their owner; only edits are draft-gated.
create policy "Research submitters read private files" on public.research_files for select to authenticated
 using(created_by=auth.uid() and visibility='private' and exists(select 1 from public.research_submissions s where s.id=submission_id and s.submitter_id=auth.uid()));
