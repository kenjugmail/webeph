# Spark handoff — 15 September 2026

## Source and release state

Continue from **main** in both `kenjugmail/webeph` and `kenjugmail/buddyide`.
The September 15 checkpoint includes work in progress; it is not the completed companion release.
The user's September 15 instruction was to commit and push everything to main for continuation on Spark.

- Preserved the existing Mac + Windows Hearthrail changes in their own baseline commit.
- Merged current origin/main into webeph, retaining the newer API, TEL, Glow and download work.
- Fast-forwarded buddyide to current origin/main before editing its runtime and billing services.
- Applied the security migrations listed below to Supabase and recorded each in schema_migrations.
- Built the companion frontend and deployed it to the `orrery-companion` Vercel project.
- **Companion access is OFF (`COMPANION_ROLLOUT=off`). Do not enable for customers yet.**
- Temporary paid test identities were deleted at handoff. Recreate isolated fixtures for further tests.

## Applied Supabase migrations

Project: `wjjthkqwcyahamhjkeux`.

- `20260915000000`: restrict backend worker RPCs; scope purchased-credit balances to their owner.
- `20260915001000`: public journal views read-only; bind private file mutations to the owner's draft.
- `20260915001100`: retain owner read access to submitted private files.
- `20260915002000`: billing delivery leases/completion state; transactional organization compute grants.
- `20260915003000`: signed waitlist challenges, receipts, and accepted-submission quotas.
- `20260915010000`: private companion devices, tasks, commands, events, approvals, and service-only RPCs.

The database is shared by both repositories and migration histories are not identical. Do not repair or
mark unrelated migrations applied merely to make `supabase db push` run. `scripts/apply-reviewed-migration.mjs`
applies one reviewed timestamped file and records it transactionally using the authenticated Management API.
On Linux, set SUPABASE_ACCESS_TOKEN locally; the macOS keychain fallback is only for this machine.

## Confirmed findings addressed

- Public clients had EXECUTE on `claim_slack_actions`, `reserve_purchased_credits`, and `release_purchased_credits`.
  They are now service-role-only. `purchased_credit_balance` now enforces owner scope.
- `research_publications` was an updatable view with public write grants. All public journal projections
  are now SELECT-only; private author/editor tables remain separate.
- Private file rows previously checked created_by but not submission ownership. Mutation policies now check both.
- Visual audits previously skipped missing pages. They now fail on missing routes; /developers is the API information route.
- Malformed OAuth return URLs can no longer throw out of getAuthRedirect.

## Implemented but requiring more verification

### Billing (buddyide)

Source now uses a retryable delivery lease/completion record, strict configured subscription price IDs,
canonical subscription retrieval, transactional organization compute-pack updates, and expiry of personal
credit packs on full refunds. Invalid-signature logs no longer echo the request payload.
**The changed stripe-webhook function has NOT been deployed.** Deno type checking passed before the last
canonical-subscription/refund edits; rerun it. Test partial failures, duplicates, concurrent deliveries,
same-second ordering, organization billing, full refunds, and expected behavior for partial refunds.
Historical billing_events records do not prove all side effects succeeded; reconcile previous failed deliveries
instead of assuming they were completed. The global billing lease serializes deliveries and can cause retryable
503 responses under concurrency. Its 10-minute expiry exceeds normal function execution duration.

### Companion (buddyide)

- Browser source: `apps/web/companion/`; build config: `apps/web/companion.vite.config.ts`.
- Build from apps/web with `corepack pnpm exec vite build --config companion.vite.config.ts`.
- Runtime bridge: `apps/sidecar/src/companion-bridge.ts`, integrated through `/remote connect` and `/remote disconnect`.
- Backend: `supabase/functions/orrery-companion/`, deployed with rollout disabled.
- Existing protocol and redacted runtime events are reused. Browser work uses the existing desktop permission path.
- Pure approval binding tests and API validation tests passed; sidecar dependency builds passed.
- **Full browser → live backend → real sidecar fixture verification has NOT been completed.**
- Review at-most-once command handling after failed event uploads, missing acknowledgements, restart,
  token expiry, device revocation, and approval expiry/revision. Also check local vs remote turn concurrency,
  session/account switching, follow-up acknowledgement ordering, bounded output, and task terminal states.
- Verify safe UI rendering and use real restricted paid test accounts before switching rollout to public.
- A compatible desktop build must be distributed; existing downloaded builds do not contain this new bridge.
- app.ephemerent.com is attached to Vercel but DNS still points to Porkbun parking.
  Required Porkbun record: CNAME `app` → `926a440a477e6f43.vercel-dns-017.com`.
  OAuth allowlist includes app.ephemerent.com and orrery-companion.vercel.app.
- Copy companion/vercel.json into companion-dist before static deployment so security headers are included.

### Waitlist (webeph)

The new signed computational challenge is bound to the submission digest and expires after ten minutes.
It raises automated submission cost; it is NOT a human CAPTCHA or proof of email ownership.
No Turnstile key was available. WAITLIST_CHALLENGE_SECRET is configured only in Supabase.
The browser computes proof in a Worker; failed checks preserve answers. Accepted-submission limits are separate
from per-email attempts. Update the older live waitlist security test to submit a valid challenge before its
success/deduplication tests; its old no-proof submissions will now be rejected.

## Verification and next work

- `npm run build` passed after baseline and upstream merge.
- `node scripts/check-backend-boundaries.mjs` passed live role, view and private-table checks.
- Challenge signature/digest/expiry tests passed.
- Billing delivery claim → failed processing → retry → completion → duplicate checks passed inside a rolled-back transaction.
- Companion frontend built; local browser sign-in screen loaded without console errors.
- Full visual suite restarted after correcting the added /api test path to /developers. Inspect the latest run or rerun on Spark.
- Finish the full end-to-end/security matrix, fix any resulting issues, finish visual review across all journeys,
  deploy verified billing changes, distribute a compatible desktop, verify DNS, then enable the companion.

## Spark setup

Clone/pull both repositories on main. For webeph: `npm ci`, `npx playwright install chromium`, Node 22+,
Python 3 with Pillow and NumPy for image checks. Start `npx vercel dev --listen 3111` after linking the
existing `ephemerent` project, then run `npm run verify` and `node scripts/check-waitlist.mjs`.
For buddyide: `corepack pnpm install --frozen-lockfile`, then build sidecar dependencies and run its relevant
tests. Follow its AGENTS.md and use main. Sign in to Vercel/Supabase again; local credentials are not in Git.
