# Colony

Colony is Ephemerent's free, no-login community inference playground at
`/colony`. It is separate from
Orrery subscriptions and the paid `api.ephemerent.com/v1/*` relay. Opening the
page never starts local compute. Generation is disabled unless the coordinator
reports ready workers for an approved model; there is no simulated or paid fallback.

The public product name and canonical address are Colony and `/colony`.
Legacy `/swarm` and `/swarm.html` URLs permanently redirect to `/colony`.
API paths, source filenames and `SWARM_*` / `IDN_SWARM_*` configuration names
stay unchanged for compatibility; they are implementation identifiers, not
public branding. The existing Colony product listing links directly to `/colony`.

## Request path

Browser → `/swarm-api/status` or `/swarm-api/chat` → Vercel `api/swarm.js` →
isolated IDN `/public/swarm/*` endpoints → admitted volunteer GPU worker.

Vercel production/preview environment variables (server-only):

- `SWARM_GATEWAY_URL`: HTTPS coordinator base, including `/swarm` when mounted
  behind the existing edge. Never set it to the paid model relay.
- `SWARM_PROXY_TOKEN`: at least 32 random characters, matching the coordinator's
  `IDN_SWARM_PROXY_TOKEN`. Do not expose it in browser assets or source control.

If configuration, capacity, authentication or quota storage is unavailable, the
proxy fails closed. It forwards only a keyed hash of Vercel's platform-owned IP
header for fair-use counting; no visitor cookies or account keys are forwarded.
The coordinator imposes an 80-second total deadline, 256 output-token limit,
2,000-character per-message cap and atomic Redis hourly/global daily quotas.
The initial limits are 10 requests per IP per UTC clock hour and 1,000 total per
UTC day. IP limits can affect people sharing a network and do not prevent all
distributed abuse. Provider charges and auto-overages are not enabled.

The coordinator sponsors requests through the existing IDN ledger, receipts and
worker admission checks. Its finite testnet-credit allowance is not cash and is
unrelated to paid provider credits. Contributor credits remain experimental and
non-transferable. No contributor payment is promised.

## Enrollment and privacy

Enrollment is invite-only. Never publish a shared claim code. Contributors need
an operator-issued claim code, a compatible model runtime and the IDN worker
package. Their private node key remains on their machine. Use the pinned vLLM
listing, not development fake engines or the legacy placeholder listing.
The source-side operator runbook is `InferenceDistribute/deploy/production/README.md`.

Visitors must acknowledge that volunteer operators can see prompts and responses.
Do not submit secrets, personal data or confidential content. The page does not
persist prompts or responses; this cannot guarantee a volunteer's retention policy.

## Release checks

Run `npm run build`; `swarm:check` is part of that gate. Verify `/colony`, the
legacy redirects and both API rewrites on Vercel before calling the release live.
An empty worker count is
a functioning coordinator with no capacity, not a successful inference test.
Only claim real GPU inference after a separately enrolled real worker completes
the browser → proxy → coordinator → GPU → response path.
