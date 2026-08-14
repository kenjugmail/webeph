# Genesis Fall Stripe-to-itch fulfillment

This track is private infrastructure for `0.1.0-beta.1`. The committed browser
configuration contains no active purchase URL, and both pages are `noindex`.
Do not enable sales until the exact game candidate, private itch builds, Stripe
test purchase, and fulfillment tests pass.

## Security model

- Stripe Checkout is the payment authority for direct purchases. A redirect is
  never accepted as proof of payment.
- `stripe-genesis-webhook` verifies the Stripe signature against the unparsed
  request body, then re-fetches the Checkout Session from Stripe.
- `claim-genesis-fall` re-fetches the session, validates the exact product,
  Payment Link, test/live mode, product, price, $20 subtotal, completed automatic-tax arithmetic, currency, payment mode/status, metadata, quantity, and purchaser
  email before returning an ownership link.
- Orders store a server-HMAC email hash, not the raw purchaser email.
- Ownership URLs are encrypted before database import with AES-256-GCM. Only
  ciphertext and a keyed fingerprint are stored. The encryption and HMAC
  secrets remain server-side.
- All fulfillment tables have RLS enabled with no browser policies. Only the
  service role can call the security-definer RPCs.
- Event rows contain IDs, bounded states, attempts, and a redacted error code;
  raw Stripe payloads, emails, secrets, and ownership URLs are not logged.
- Refunds and disputes quarantine the order and assigned key for manual review.
  The event row retains a bounded payment-intent reference so quarantine still
  wins when Stripe delivers refund/dispute events before checkout fulfillment.
  Keys are never automatically recycled.

## Stripe test-mode setup

Current sandbox objects (August 13, 2026):

- Product: `prod_V4Im2DiK3zCpw5`
- One-time price: `price_1U4AAtDMKk79cYVGyf4NcoNQ`
- Inactive Payment Link: `plink_1U4AEzDMKk79cYVGSHwVcSYE`
- Webhook destination: `we_1U4AeHDMKk79cYVG3r3Kx7z3`

The webhook endpoint and Edge Functions are deployed in test mode. A signed
refund probe returns HTTP 200, an invalid signature returns HTTP 400, and the
public availability check fails closed while ownership-key inventory is empty.
The Payment Link and website purchase controls remain disabled.

Create these objects manually in **test mode** only:

1. Product: `Genesis Fall — Beta Early Access`.
2. One-time price: `$20.00 USD`, tax-exclusive.
3. Stripe Tax code: `txcd_10201000` (permanently accessible downloaded video
   game). Confirm the code in the current Stripe dashboard before launch.
4. Quantity fixed to one; promotion codes disabled for Beta 1.
5. Automatic tax enabled and purchaser email/billing information required.
6. Product/Payment Link metadata:
   - `product=genesis_fall`
   - `release_channel=beta`
   - `release_version=0.1.0-beta.1`
   - `fulfillment=itch_download_key`
7. Completion redirect:
   `https://ephemerent.com/genesis-fall-access?session_id={CHECKOUT_SESSION_ID}`.
8. Keep the Payment Link inactive until private validation is complete.

Set Edge Function secrets from `supabase/functions/env.example` through
`supabase secrets set`. Never add real values to a tracked file. Use separate,
random secrets for email HMAC and key encryption. The encryption key must be 32
random bytes encoded as base64/base64url. Back up both secrets in the production
secret manager: changing either one without a deliberate data migration breaks
email matching or decryption for existing orders.

Configure the Stripe webhook endpoint for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`
- `charge.dispute.created`

The endpoint is:
`https://PROJECT_REF.supabase.co/functions/v1/stripe-genesis-webhook`.

## Import 100 private itch ownership keys

1. Generate 100 ownership/download-key URLs for the private Genesis Fall itch
   project. Keep the plaintext export outside the repository.
2. On an offline or trusted local machine, set `GENESIS_KEY_ENCRYPTION_KEY` from
   the same secure secret store used for the Edge Function.
3. Encrypt to a temporary CSV containing no plaintext URLs:

   ```sh
   # Inject GENESIS_KEY_ENCRYPTION_KEY from the local secret manager first;
   # do not type the real value into shell history.
   node scripts/genesis-fall-key-tool.mjs --format=csv \
     < /secure/path/genesis-itch-keys.txt \
     > /tmp/genesis-fall-keys.encrypted.csv
   ```

4. Confirm the tool reports exactly 100 records on stderr. Inspect only the
   header and record count; do not paste plaintext keys into logs or tickets.
5. Import the encrypted CSV into `genesis_fall_key_inventory` using the
   Supabase dashboard/service role. Let `id`, `status`, and timestamps use their
   defaults.
6. Verify `select genesis_fall_available_inventory();` returns `100`.
7. Securely delete the plaintext export and temporary encrypted CSV after the
   import and backup policy are satisfied.

The website checks availability before opening Stripe. After a paid allocation,
the webhook deactivates the configured Payment Link whenever fewer than 25 keys
remain. Already-paid, in-flight orders may consume the reserve. Refill and test
inventory, then reactivate the Payment Link manually; never silently reduce the
threshold.

## Local and test-mode matrix

Run locally:

```sh
node --test tests/genesis-fall-fulfillment.test.mjs
node --check assets/genesis-fall.js
node --check assets/genesis-fall-access.js
node --check supabase/functions/_shared/genesis-fall-core.mjs
node --check supabase/functions/_shared/genesis-fall-runtime.mjs
git diff --check
```

Then validate against Stripe/Supabase test mode:

| Scenario | Expected result |
|---|---|
| Valid paid purchase | One order and one key allocation; claim reveals the key |
| Duplicate webhook | HTTP 200; no second order or key |
| Repeated valid claim | Same ownership URL |
| Wrong email | `wrong_email`; no key |
| Wrong product/price/$20 subtotal/tax arithmetic/metadata | `invalid_purchase`; no order/key |
| Unpaid or delayed payment | `pending`; retry after Stripe confirms payment |
| Inventory below 25 | Website blocks checkout and Payment Link becomes inactive |
| No available key after payment | `inventory_pending`/`depleted`; recover after refill |
| Function/database failure | Stripe receives retryable failure; later retry is idempotent |
| Refund or dispute | Order and assigned key enter manual review |
| Error response/log inspection | No email, session, payment ID, secret, or key URL |

Use Stripe CLI only with test credentials to forward signed webhook events.
Confirm that the raw-body signature check fails if the body is modified.

## Private activation and rollback

1. Deploy the migration and both Edge Functions to the private Supabase project.
2. Import 100 encrypted itch keys and verify the 25-key reserve check.
3. Configure test IDs/secrets; keep storefront CTAs disabled.
4. Run every test-mode scenario, including one real test Checkout and repeated
   recovery from the completion URL.
5. Validate both private itch platform builds and ownership attachment.
6. Review the exact staged website diff, legal text, candidate game evidence,
   and purchase copy with the owner.
7. Only after approval, create equivalent live Stripe objects, perform one
   private live purchase/refund reconciliation, and populate the public config.

Rollback is fail-closed: set `PURCHASES_ENABLED=false`, deactivate the Stripe
Payment Link, return itch to Restricted/Draft, and preserve orders and key
assignments for reconciliation. Do not delete paid orders, recycle quarantined
keys, or roll back the database migration while fulfillment records exist.
