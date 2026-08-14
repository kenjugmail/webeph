import assert from 'node:assert/strict';
import test from 'node:test';
import { GENESIS_DIRECT_METADATA } from '../supabase/functions/_shared/genesis-fall-core.mjs';
import {
  claimGenesisFallDirect,
  processGenesisDirectWebhook,
  validateArtifactManifest,
} from '../supabase/functions/_shared/genesis-fall-direct-core.mjs';

const expected = {
  productId: 'prod_genesis_live',
  priceId: 'price_genesis_live',
  paymentLinkId: 'plink_genesis_live',
  livemode: true,
};
const emailHmacSecret = 'direct-download-email-hmac-test-secret';

function paidSession(overrides = {}) {
  return {
    id: 'cs_live_genesis_1',
    livemode: true,
    payment_link: expected.paymentLinkId,
    mode: 'payment',
    payment_status: 'paid',
    automatic_tax: { enabled: true, status: 'complete' },
    amount_subtotal: 2000,
    amount_total: 2178,
    total_details: { amount_tax: 178, amount_discount: 0, amount_shipping: 0 },
    currency: 'usd',
    payment_intent: 'pi_live_genesis_1',
    customer_details: { email: 'Buyer@Example.com' },
    metadata: { ...GENESIS_DIRECT_METADATA },
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

function artifacts() {
  return [
    {
      release_version: '0.1.0-beta.1',
      platform: 'macos-arm64',
      object_path: '0.1.0-beta.1/macos-arm64/Genesis-Fall-macos-arm64.zip',
      download_filename: 'Genesis-Fall-0.1.0-beta.1-macos-arm64.zip',
      content_type: 'application/zip',
      sha256: 'a'.repeat(64),
      size_bytes: 1234,
      build_sha: 'abc1234',
      active: true,
    },
    {
      release_version: '0.1.0-beta.1',
      platform: 'windows-x64',
      object_path: '0.1.0-beta.1/windows-x64/Genesis-Fall-windows-x64.zip',
      download_filename: 'Genesis-Fall-0.1.0-beta.1-windows-x64.zip',
      content_type: 'application/zip',
      sha256: 'b'.repeat(64),
      size_bytes: 5678,
      build_sha: 'abc1234',
      active: true,
    },
  ];
}

test('direct artifact manifest requires both bounded release platforms', () => {
  assert.equal(validateArtifactManifest(artifacts()), true);
  assert.equal(validateArtifactManifest(artifacts().slice(0, 1)), false);
  const traversal = artifacts();
  traversal[0].object_path = '../private.zip';
  assert.equal(validateArtifactManifest(traversal), false);
});

test('paid direct claim returns short-lived platform downloads', async () => {
  const result = await claimGenesisFallDirect({
    session: paidSession(),
    submittedEmail: 'buyer@example.com',
    expected,
    emailHmacSecret,
    registerOrder: async () => ({ status: 'paid' }),
    listArtifacts: async () => artifacts(),
    signArtifact: async (artifact) => `https://storage.example.test/${artifact.platform}?token=signed`,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.releaseVersion, '0.1.0-beta.1');
  assert.deepEqual(result.body.downloads.map((item) => item.platform), ['macos-arm64', 'windows-x64']);
  assert.ok(result.body.downloads.every((item) => item.expiresIn === 900));
});

test('direct claim records payment but fails closed until both artifacts exist', async () => {
  const result = await claimGenesisFallDirect({
    session: paidSession(),
    submittedEmail: 'buyer@example.com',
    expected,
    emailHmacSecret,
    registerOrder: async () => ({ status: 'paid' }),
    listArtifacts: async () => artifacts().slice(0, 1),
    signArtifact: async () => assert.fail('incomplete manifests must not be signed'),
  });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'release_pending');
});

test('wrong email cannot mint direct download links', async () => {
  const result = await claimGenesisFallDirect({
    session: paidSession(),
    submittedEmail: 'other@example.com',
    expected,
    emailHmacSecret,
    registerOrder: async () => assert.fail('wrong email must not register'),
    listArtifacts: async () => assert.fail('wrong email must not list artifacts'),
    signArtifact: async () => assert.fail('wrong email must not sign artifacts'),
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 'wrong_email');
});

test('live paid webhook records an order and disables checkout without a complete release', async () => {
  let deactivated = 0;
  let finished;
  const result = await processGenesisDirectWebhook({
    event: { id: 'evt_direct_paid', type: 'checkout.session.completed', data: { object: { id: 'cs_live_genesis_1' } } },
    expected,
    emailHmacSecret,
    beginEvent: async () => true,
    finishEvent: async (...args) => { finished = args; },
    retrieveSession: async () => paidSession(),
    registerOrder: async () => ({ status: 'paid' }),
    markManualReview: async () => {},
    releaseReady: async () => false,
    deactivatePaymentLink: async () => { deactivated += 1; },
  });
  assert.equal(result.status, 200);
  assert.equal(deactivated, 1);
  assert.deepEqual(finished, ['evt_direct_paid', true, null]);
});

test('refund webhook quarantines matching direct purchase', async () => {
  const reviews = [];
  const result = await processGenesisDirectWebhook({
    event: {
      id: 'evt_direct_refund',
      type: 'charge.refunded',
      data: { object: { payment_intent: 'pi_live_genesis_1' } },
    },
    expected,
    emailHmacSecret,
    beginEvent: async () => true,
    finishEvent: async () => {},
    retrieveSession: async () => assert.fail('refund must not retrieve checkout'),
    registerOrder: async () => assert.fail('refund must not register a paid order'),
    markManualReview: async (...args) => reviews.push(args),
    releaseReady: async () => true,
    deactivatePaymentLink: async () => {},
  });
  assert.equal(result.status, 200);
  assert.deepEqual(reviews, [['pi_live_genesis_1', 'refund', 'evt_direct_refund']]);
});
