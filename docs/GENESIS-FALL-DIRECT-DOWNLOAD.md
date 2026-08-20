# Genesis Fall direct-download fulfillment

Genesis Fall Beta Early Access is a one-time $20 Stripe purchase. Paid buyers
return to `https://ephemerent.com/genesis-fall-access`, verify the purchaser
email against the Checkout Session, and receive 15-minute signed links for the
private macOS ARM64 and Windows x64 packages.

## Safety model

- Stripe Checkout is the payment authority; a redirect is never payment proof.
- The live flow accepts only the exact product, price, Payment Link, metadata,
  one-item quantity, $20 subtotal, completed automatic-tax result, USD payment,
  and live mode.
- Purchaser email is stored only as a server-HMAC hash.
- Release objects live in the private `genesis-fall-releases` Storage bucket.
- Browser clients cannot list the manifest, read the bucket, or mint URLs.
- The claim function returns 15-minute links only after paid-session and email
  verification. It returns checksums and build IDs with every link.
- Both platform artifacts must be active before availability becomes true.
- Refund and dispute events quarantine the order from further claims.
- The Payment Link remains inactive until both exact release packages and the
  end-to-end paid/refund test pass.

## Required live Stripe objects

- Product metadata:
  - `product=genesis_fall`
  - `release_channel=beta`
  - `release_version=0.1.0-beta.1`
  - `fulfillment=direct_download`
- One-time price: `$20.00 USD`, tax exclusive.
- Tax code: `txcd_10201000`.
- Quantity fixed at one and promotion codes disabled for Beta 1.
- Redirect:
  `https://ephemerent.com/genesis-fall-access?session_id={CHECKOUT_SESSION_ID}`.
- Webhook events:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `charge.refunded`
  - `charge.dispute.created`

Use a restricted live Stripe key for Checkout Session reads and Payment Link
read/write operations. Store it only in Supabase secrets and the operator’s
secret manager. Never commit, log, or expose it to browser configuration.

## Artifact publication

For each package:

1. Build from the same immutable release commit.
2. Validate package contents and smoke it on its listed platform.
3. ZIP the complete platform directory.
4. Record SHA-256, byte size, build SHA, release version, platform, private
   Storage path, and download filename.
5. Upload the ZIP to the private `genesis-fall-releases` bucket.
6. Insert an inactive manifest row.
7. Verify object size and checksum after upload.
8. Atomically deactivate the prior row and activate the verified row.

The live availability endpoint must remain false until exactly one active
`0.1.0-beta.1` artifact exists for both `macos-arm64` and `windows-x64`.

## Launch gate

Before enabling the website or Payment Link:

- migration and live Edge Functions deployed;
- restricted Stripe secret and webhook secret installed;
- both private artifacts uploaded, checksummed, and active;
- signed URL expiry and private-bucket denial tested;
- valid purchase, duplicate webhook, repeat claim, wrong email, wrong product,
  unpaid session, refund, dispute, and failure recovery tested;
- exact macOS and Windows ZIPs installed and smoked;
- purchase copy, platform disclosures, unsigned warnings, Terms, and Privacy
  reviewed;
- one private live purchase is downloaded on both platforms and refunded.

Rollback is fail-closed: disable the website purchase flag and Payment Link,
deactivate release manifest rows if artifacts are unsafe, and preserve payment
and review records for reconciliation.
