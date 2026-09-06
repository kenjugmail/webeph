# Ephemerent Intelligence waitlist

Public page: https://ephemerent.com/waitlist
Owner shortcut: https://ephemerent.com/waitlist/manage

## Read and export

1. Open the owner shortcut and sign in to your existing Supabase account.
2. In Table Editor, select **company_waitlist_inbox** under the public schema (enable the views filter if needed). Each answer has its own named column. Sort `created_at` descending for newest first.
3. Export this inbox view as CSV from the dashboard export menu. Formula-like text is prefixed with an apostrophe to make spreadsheet exports safer. The original answers remain in `company_waitlist`.

Use **company_waitlist** to delete a row by its normalized email when honoring a deletion request. No automatic emails are sent. The shortcut contains no access token; Supabase enforces your existing project permissions. Anyone you grant privileged project/database access can access this data.

## Protection

- Both tables have row-level security enabled and no public or ordinary signed-in grants. The inbox uses security-invoker semantics and has no public grants.
- The original write RPC is service-role-only. Only the Edge Function can submit on behalf of visitors. The service key stays on the server.
- Validation runs in PostgreSQL: allowed fields, types, options, required answers, explicit boolean consent, lengths, email and website format. No SQL or HTML supplied by users is executed.
- Edge requests have a streamed 16 KB cap, allowed browser origins, generic errors, no-store responses, and bounded backend timeouts. CORS is not authentication or bot protection.
- Atomic database quotas allow five attempts per normalized email per clock hour, 200 total attempts per clock hour and 1,000 per UTC day. Quota email identifiers are keyed HMAC digests; stale buckets are pruned on subsequent requests after two days. No IP addresses are stored by this feature.
- Repeated emails return the same success response without updating or revealing existing responses.
- Consent version and creation time are recorded. Access, quota and validation paths are covered by the live verification script.

Rate limits bound submission abuse; they do not prove email ownership or eliminate distributed spam. If traffic warrants it, add a verified CAPTCHA and edge/WAF protections. A site-wide quota can temporarily pause submissions; the form retains answers and offers kt@ephemerent.com as a fallback.

## Verification

`node scripts/check-waitlist.mjs` checks layout and browser success/failure flows against a local server on port 8091 with mocked transport.
`node scripts/check-waitlist-security.mjs` checks deployed access controls, validation, successful writes, deduplication, quota enforcement and cleanup using the existing authenticated Supabase CLI. It creates only uniquely identified test data and removes it afterward. It consumes a small number of live quota attempts.

Public Edge Function configuration follows https://supabase.com/docs/guides/functions/auth .
