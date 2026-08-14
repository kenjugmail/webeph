import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GENESIS_METADATA,
  checkoutAvailableForCount,
  claimGenesisFall,
  encryptItchKeyUrl,
  itchKeyFingerprint,
  processGenesisWebhook,
  publicError,
  redactedJson,
  validateCheckoutSession,
  verifyStripeSignature,
} from '../supabase/functions/_shared/genesis-fall-core.mjs';

const expected = {
  productId: 'prod_genesisfall',
  priceId: 'price_beta1',
  paymentLinkId: 'plink_genesis_test',
  livemode: false,
};
const emailSecret = 'test-email-hmac-secret-that-is-not-used-outside-tests';
const encryptionSecret = Buffer.alloc(32, 7).toString('base64url');
const itchUrl = 'https://example-studio.itch.io/example-game/download/test-ownership-key';

function paidSession(overrides = {}) {
  return {
    id: 'cs_test_genesis_1',
    livemode: false,
    payment_link: expected.paymentLinkId,
    mode: 'payment',
    payment_status: 'paid',
    automatic_tax: { enabled: true, status: 'complete' },
    amount_subtotal: 2000,
    amount_total: 2000,
    total_details: { amount_tax: 0, amount_discount: 0, amount_shipping: 0 },
    currency: 'usd',
    payment_intent: 'pi_test_genesis_1',
    customer_details: { email: 'Buyer@Example.com' },
    metadata: { ...GENESIS_METADATA },
    line_items: {
      data: [{
        quantity: 1,
        price: {
          id: expected.priceId,
          unit_amount: 2000,
          currency: 'usd',
          product: { id: expected.productId },
        },
      }],
    },
    ...overrides,
  };
}

async function ciphertext() {
  return encryptItchKeyUrl(itchUrl, encryptionSecret);
}

test('duplicate webhook is acknowledged without reprocessing', async () => {
  let retrieved = false;
  const result = await processGenesisWebhook({
    event: { id: 'evt_duplicate', type: 'checkout.session.completed', data: { object: { id: 'cs_test' } } },
    expected,
    emailHmacSecret: emailSecret,
    beginEvent: async () => false,
    finishEvent: async () => assert.fail('duplicate event must not finish twice'),
    retrieveSession: async () => { retrieved = true; },
    allocate: async () => assert.fail('duplicate event must not allocate'),
    markManualReview: async () => {},
    deactivatePaymentLink: async () => {},
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.duplicate, true);
  assert.equal(retrieved, false);
});

test('repeated claims return the same allocated ownership link', async () => {
  const envelope = await ciphertext();
  let allocations = 0;
  const allocate = async () => {
    allocations += 1;
    return { status: 'fulfilled', key_ciphertext: envelope, available_inventory: 99 };
  };
  const request = {
    session: paidSession(),
    submittedEmail: 'buyer@example.com',
    expected,
    emailHmacSecret: emailSecret,
    keyEncryptionSecret: encryptionSecret,
    allocate,
  };
  const first = await claimGenesisFall(request);
  const second = await claimGenesisFall(request);
  assert.equal(first.status, 200);
  assert.deepEqual(second, first);
  assert.equal(first.body.itchKeyUrl, itchUrl);
  assert.equal(allocations, 2, 'database allocator is called idempotently on each verification');
});

test('wrong purchaser email never reaches allocation', async () => {
  const result = await claimGenesisFall({
    session: paidSession(),
    submittedEmail: 'other@example.com',
    expected,
    emailHmacSecret: emailSecret,
    keyEncryptionSecret: encryptionSecret,
    allocate: async () => assert.fail('wrong email must not allocate'),
  });
  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { ok: false, code: 'wrong_email' });
});

test('wrong product is rejected', async () => {
  const session = paidSession();
  session.line_items.data[0].price.product.id = 'prod_wrong';
  assert.deepEqual(validateCheckoutSession(session, expected), { ok: false, code: 'invalid_purchase' });
});

test('unpaid session remains pending', async () => {
  const result = await claimGenesisFall({
    session: paidSession({ payment_status: 'unpaid' }),
    submittedEmail: 'buyer@example.com',
    expected,
    emailHmacSecret: emailSecret,
    keyEncryptionSecret: encryptionSecret,
    allocate: async () => assert.fail('unpaid session must not allocate'),
  });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'pending');
});

test('a taxed purchase keeps an exact $20 merchandise subtotal', () => {
  const session = paidSession({
    amount_total: 2165,
    total_details: { amount_tax: 165, amount_discount: 0, amount_shipping: 0 },
  });
  const result = validateCheckoutSession(session, expected);
  assert.equal(result.ok, true);
  assert.equal(result.value.amountSubtotal, 2000);
  assert.equal(result.value.taxAmount, 165);
  assert.equal(result.value.amountTotal, 2165);
});

test('refund and dispute events mark only matching orders for manual review', async (t) => {
  for (const [type, reason] of [['charge.refunded', 'refund'], ['charge.dispute.created', 'dispute']]) {
    await t.test(type, async () => {
      const calls = [];
      const result = await processGenesisWebhook({
        event: { id: `evt_${reason}`, type, data: { object: { payment_intent: 'pi_test_genesis_1' } } },
        expected,
        emailHmacSecret: emailSecret,
        beginEvent: async () => true,
        finishEvent: async () => {},
        retrieveSession: async () => assert.fail('review event does not retrieve a Checkout Session'),
        allocate: async () => assert.fail('review event does not allocate'),
        markManualReview: async (...args) => calls.push(args),
        deactivatePaymentLink: async () => {},
      });
      assert.equal(result.status, 200);
      assert.deepEqual(calls, [['pi_test_genesis_1', reason, `evt_${reason}`]]);
    });
  }
});

test('depleted inventory is recoverable and does not reveal a key', async () => {
  const result = await claimGenesisFall({
    session: paidSession(),
    submittedEmail: 'buyer@example.com',
    expected,
    emailHmacSecret: emailSecret,
    keyEncryptionSecret: encryptionSecret,
    allocate: async () => ({ status: 'depleted', available_inventory: 0 }),
  });
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { ok: false, code: 'depleted' });
});

test('manual-review orders never reveal an assigned key', async () => {
  const result = await claimGenesisFall({
    session: paidSession(),
    submittedEmail: 'buyer@example.com',
    expected,
    emailHmacSecret: emailSecret,
    keyEncryptionSecret: encryptionSecret,
    allocate: async () => ({ status: 'manual_review', key_ciphertext: await ciphertext() }),
  });
  assert.equal(result.status, 409);
  assert.deepEqual(result.body, { ok: false, code: 'manual_review' });
});

test('checkout reserve blocks fewer than 25 available keys', () => {
  assert.equal(checkoutAvailableForCount(100), true);
  assert.equal(checkoutAvailableForCount(25), true);
  assert.equal(checkoutAvailableForCount(24), false);
  assert.equal(checkoutAvailableForCount(0), false);
  assert.equal(checkoutAvailableForCount('not-a-count'), false);
});

test('successful allocation deactivates checkout below the reserve', async () => {
  let deactivated = 0;
  const result = await processGenesisWebhook({
    event: { id: 'evt_low_stock', type: 'checkout.session.completed', data: { object: { id: 'cs_test_genesis_1' } } },
    expected,
    emailHmacSecret: emailSecret,
    beginEvent: async () => true,
    finishEvent: async () => {},
    retrieveSession: async () => paidSession(),
    allocate: async () => ({ status: 'fulfilled', key_ciphertext: await ciphertext(), available_inventory: 24 }),
    markManualReview: async () => {},
    deactivatePaymentLink: async () => { deactivated += 1; },
  });
  assert.equal(result.status, 200);
  assert.equal(deactivated, 1);
});

test('metadata, amount, mode, quantity, and price contract are exact', async (t) => {
  const cases = [
    ['metadata', () => paidSession({ metadata: { ...GENESIS_METADATA, release_version: 'wrong' } })],
    ['subtotal', () => paidSession({ amount_subtotal: 1999, amount_total: 1999 })],
    ['tax arithmetic', () => paidSession({ amount_total: 2100, total_details: { amount_tax: 99, amount_discount: 0, amount_shipping: 0 } })],
    ['mode', () => paidSession({ mode: 'subscription' })],
    ['payment link', () => paidSession({ payment_link: 'plink_wrong' })],
    ['livemode', () => paidSession({ livemode: true })],
    ['automatic tax', () => paidSession({ automatic_tax: { enabled: false, status: null } })],
    ['quantity', () => { const value = paidSession(); value.line_items.data[0].quantity = 2; return value; }],
    ['price', () => { const value = paidSession(); value.line_items.data[0].price.id = 'price_wrong'; return value; }],
  ];
  for (const [name, fixture] of cases) {
    await t.test(name, () => {
      assert.deepEqual(validateCheckoutSession(fixture(), expected), { ok: false, code: 'invalid_purchase' });
    });
  }
});

test('webhook failure can retry and recover idempotently', async () => {
  let attempt = 0;
  const event = { id: 'evt_retry', type: 'checkout.session.completed', data: { object: { id: 'cs_test_genesis_1' } } };
  const finishes = [];
  const run = () => processGenesisWebhook({
    event,
    expected,
    emailHmacSecret: emailSecret,
    beginEvent: async () => true,
    finishEvent: async (...args) => finishes.push(args),
    retrieveSession: async () => paidSession(),
    allocate: async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('temporary_database_failure');
      return { status: 'fulfilled', key_ciphertext: await ciphertext(), available_inventory: 99 };
    },
    markManualReview: async () => {},
    deactivatePaymentLink: async () => {},
  });
  assert.equal((await run()).status, 503);
  assert.equal((await run()).status, 200);
  assert.equal(finishes[0][1], false);
  assert.equal(finishes[1][1], true);
});

test('public error responses redact identifiers and ownership links', () => {
  const body = publicError('internal_cs_test_pi_test');
  assert.equal(redactedJson(body), '{"ok":false,"code":"unavailable"}');
  assert.throws(() => redactedJson({ ok: false, detail: 'cs_test_secret' }), /private_identifier/);
  assert.throws(() => redactedJson({ ok: false, detail: itchUrl }), /private_identifier/);
});

test('ownership encryption round-trips and fingerprint is stable without plaintext storage', async () => {
  const one = await ciphertext();
  const two = await ciphertext();
  assert.notEqual(one, two, 'random nonce changes ciphertext');
  assert.equal(one.includes('test-ownership-key'), false);
  assert.equal(await itchKeyFingerprint(itchUrl, encryptionSecret), await itchKeyFingerprint(itchUrl, encryptionSecret));
});

test('Stripe signature verification uses raw body and rejects stale timestamps', async () => {
  const raw = '{"id":"evt_signed"}';
  const secret = 'whsec_test_only';
  const timestamp = 1_700_000_000;
  const { hmacHex } = await import('../supabase/functions/_shared/genesis-fall-core.mjs');
  const signature = await hmacHex(secret, `${timestamp}.${raw}`);
  const header = `t=${timestamp},v1=${signature}`;
  assert.equal(await verifyStripeSignature(raw, header, secret, { nowSeconds: timestamp }), true);
  assert.equal(await verifyStripeSignature(`${raw} `, header, secret, { nowSeconds: timestamp }), false);
  assert.equal(await verifyStripeSignature(raw, header, secret, { nowSeconds: timestamp + 301 }), false);
});
