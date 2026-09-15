-- Worker-only operations must never inherit PostgreSQL's default PUBLIC EXECUTE.
revoke all on function public.claim_slack_actions(integer) from public, anon, authenticated;
revoke all on function public.reserve_purchased_credits(uuid,bigint) from public, anon, authenticated;
revoke all on function public.release_purchased_credits(uuid,bigint) from public, anon, authenticated;
grant execute on function public.claim_slack_actions(integer) to service_role;
grant execute on function public.reserve_purchased_credits(uuid,bigint) to service_role;
grant execute on function public.release_purchased_credits(uuid,bigint) to service_role;
create or replace function public.purchased_credit_balance(p_user_id uuid) returns bigint
language sql stable security definer set search_path = '' as $$
 select coalesce(sum(credits_granted-credits_used),0)::bigint from public.credit_grants
 where user_id=p_user_id and (auth.role()='service_role' or auth.uid()=p_user_id)
 and credits_used<credits_granted and (expires_at is null or expires_at>now());
$$;
revoke all on function public.purchased_credit_balance(uuid) from public,anon;
grant execute on function public.purchased_credit_balance(uuid) to authenticated,service_role;
