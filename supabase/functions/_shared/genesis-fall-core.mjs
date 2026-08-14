export const GENESIS_PRICE_CENTS = 2000;
export const GENESIS_CURRENCY = 'usd';
export const GENESIS_LOW_STOCK_THRESHOLD = 25;
export const GENESIS_METADATA = Object.freeze({
  product: 'genesis_fall',
  release_channel: 'beta',
  release_version: '0.1.0-beta.1',
  fulfillment: 'itch_download_key',
});

export function checkoutAvailableForCount(count) {
  return Number.isInteger(Number(count)) && Number(count) >= GENESIS_LOW_STOCK_THRESHOLD;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function constantTimeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const base64 = String(value).replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(String(value)))));
}

export async function emailHash(email, secret) {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes('@') || normalized.length > 254) throw new Error('invalid_email');
  return hmacHex(secret, normalized);
}

async function aesKey(secret) {
  const bytes = base64UrlToBytes(secret);
  if (bytes.byteLength !== 32) throw new Error('invalid_encryption_key');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function validateItchKeyUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:'
      && (url.hostname === 'itch.io' || url.hostname.endsWith('.itch.io'))
      && /\/download\//.test(url.pathname)
      && url.username === ''
      && url.password === '';
  } catch {
    return false;
  }
}

export async function encryptItchKeyUrl(url, encryptionSecret) {
  if (!validateItchKeyUrl(url)) throw new Error('invalid_itch_key_url');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesKey(encryptionSecret),
    encoder.encode(url),
  ));
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`;
}

export async function decryptItchKeyUrl(envelope, encryptionSecret) {
  const [version, ivPart, ciphertextPart, extra] = String(envelope || '').split('.');
  if (version !== 'v1' || !ivPart || !ciphertextPart || extra !== undefined) throw new Error('invalid_key_envelope');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(ivPart) },
    await aesKey(encryptionSecret),
    base64UrlToBytes(ciphertextPart),
  );
  const url = decoder.decode(plaintext);
  if (!validateItchKeyUrl(url)) throw new Error('invalid_itch_key_url');
  return url;
}

export async function itchKeyFingerprint(url, encryptionSecret) {
  if (!validateItchKeyUrl(url)) throw new Error('invalid_itch_key_url');
  return hmacHex(encryptionSecret, `genesis-fall-itch-key\0${url}`);
}

function expandedProductId(product) {
  return typeof product === 'string' ? product : product?.id;
}

export function validateCheckoutSession(session, expected) {
  if (!session || typeof session !== 'object') return { ok: false, code: 'invalid_purchase' };
  const paymentLinkId = typeof session.payment_link === 'string' ? session.payment_link : session.payment_link?.id;
  if (paymentLinkId !== expected.paymentLinkId || session.livemode !== expected.livemode) {
    return { ok: false, code: 'invalid_purchase' };
  }
  if (session.mode !== 'payment') return { ok: false, code: 'invalid_purchase' };
  if (session.payment_status !== 'paid') return { ok: false, code: 'pending' };
  if (session.automatic_tax?.enabled !== true || session.automatic_tax?.status !== 'complete') {
    return { ok: false, code: 'invalid_purchase' };
  }
  const taxAmount = session.total_details?.amount_tax;
  const discountAmount = session.total_details?.amount_discount ?? 0;
  const shippingAmount = session.total_details?.amount_shipping ?? 0;
  if (session.amount_subtotal !== GENESIS_PRICE_CENTS
      || !Number.isInteger(taxAmount) || taxAmount < 0
      || discountAmount !== 0 || shippingAmount !== 0
      || session.amount_total !== GENESIS_PRICE_CENTS + taxAmount
      || session.currency !== GENESIS_CURRENCY) {
    return { ok: false, code: 'invalid_purchase' };
  }

  for (const [key, value] of Object.entries(GENESIS_METADATA)) {
    if (session.metadata?.[key] !== value) return { ok: false, code: 'invalid_purchase' };
  }

  const lines = session.line_items?.data;
  if (!Array.isArray(lines) || lines.length !== 1 || lines[0]?.quantity !== 1) {
    return { ok: false, code: 'invalid_purchase' };
  }
  const price = lines[0]?.price;
  const productId = expandedProductId(price?.product);
  if (productId !== expected.productId || price?.id !== expected.priceId) {
    return { ok: false, code: 'invalid_purchase' };
  }
  if (price?.unit_amount !== GENESIS_PRICE_CENTS || price?.currency !== GENESIS_CURRENCY) {
    return { ok: false, code: 'invalid_purchase' };
  }

  const email = normalizeEmail(session.customer_details?.email);
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;
  if (!email || !paymentIntentId || !String(session.id || '').startsWith('cs_')) {
    return { ok: false, code: 'invalid_purchase' };
  }

  return {
    ok: true,
    value: {
      checkoutSessionId: session.id,
      paymentIntentId,
      email,
      productId,
      priceId: price.id,
      paymentLinkId,
      livemode: session.livemode,
      amountSubtotal: session.amount_subtotal,
      taxAmount,
      amountTotal: session.amount_total,
      currency: session.currency,
      mode: session.mode,
      paymentStatus: session.payment_status,
    },
  };
}

export function publicError(code) {
  const allowed = new Set(['pending', 'wrong_email', 'depleted', 'manual_review', 'invalid_purchase', 'unavailable']);
  return { ok: false, code: allowed.has(code) ? code : 'unavailable' };
}

export async function claimGenesisFall({
  session,
  submittedEmail,
  expected,
  emailHmacSecret,
  keyEncryptionSecret,
  allocate,
}) {
  const validated = validateCheckoutSession(session, expected);
  if (!validated.ok) return { status: validated.code === 'pending' ? 409 : 400, body: publicError(validated.code) };

  let submittedHash;
  let stripeHash;
  try {
    [submittedHash, stripeHash] = await Promise.all([
      emailHash(submittedEmail, emailHmacSecret),
      emailHash(validated.value.email, emailHmacSecret),
    ]);
  } catch {
    return { status: 400, body: publicError('wrong_email') };
  }
  if (!constantTimeEqual(submittedHash, stripeHash)) {
    return { status: 403, body: publicError('wrong_email') };
  }

  const allocation = await allocate({ ...validated.value, purchaserEmailHash: stripeHash });
  if (allocation.status === 'depleted') return { status: 503, body: publicError('depleted') };
  if (allocation.status === 'manual_review') return { status: 409, body: publicError('manual_review') };
  if (allocation.status !== 'fulfilled' || !allocation.key_ciphertext) {
    return { status: 503, body: publicError('unavailable') };
  }

  try {
    const itchKeyUrl = await decryptItchKeyUrl(allocation.key_ciphertext, keyEncryptionSecret);
    return { status: 200, body: { ok: true, itchKeyUrl } };
  } catch {
    return { status: 503, body: publicError('manual_review') };
  }
}

function paymentIntentFromEventObject(object) {
  return typeof object?.payment_intent === 'string' ? object.payment_intent : object?.payment_intent?.id;
}

export async function processGenesisWebhook({
  event,
  expected,
  emailHmacSecret,
  beginEvent,
  finishEvent,
  retrieveSession,
  allocate,
  markManualReview,
  deactivatePaymentLink,
}) {
  if (!event?.id || !event?.type) return { status: 400, body: publicError('invalid_purchase') };
  const started = await beginEvent(event.id, event.type);
  if (!started) return { status: 200, body: { ok: true, duplicate: true } };

  try {
    if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      const paymentIntentId = paymentIntentFromEventObject(event.data?.object);
      if (paymentIntentId) {
        await markManualReview(
          paymentIntentId,
          event.type === 'charge.refunded' ? 'refund' : 'dispute',
          event.id,
        );
      }
      await finishEvent(event.id, true, null);
      return { status: 200, body: { ok: true } };
    }

    if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      await finishEvent(event.id, true, null);
      return { status: 200, body: { ok: true, ignored: true } };
    }

    const sessionId = event.data?.object?.id;
    const session = await retrieveSession(sessionId);
    const validated = validateCheckoutSession(session, expected);
    if (!validated.ok) {
      await finishEvent(event.id, false, validated.code);
      return { status: validated.code === 'pending' ? 409 : 400, body: publicError(validated.code) };
    }

    const purchaserEmailHash = await emailHash(validated.value.email, emailHmacSecret);
    const allocation = await allocate({
      ...validated.value,
      purchaserEmailHash,
      stripeEventId: event.id,
    });

    if (allocation.status === 'depleted') {
      await deactivatePaymentLink();
      await finishEvent(event.id, false, 'inventory_depleted');
      return { status: 503, body: publicError('depleted') };
    }
    if (allocation.status === 'manual_review') {
      await finishEvent(event.id, true, null);
      return { status: 200, body: { ok: true, manualReview: true } };
    }
    if (allocation.status !== 'fulfilled') throw new Error('allocation_failed');

    if (Number(allocation.available_inventory) < GENESIS_LOW_STOCK_THRESHOLD) {
      await deactivatePaymentLink();
    }
    await finishEvent(event.id, true, null);
    return { status: 200, body: { ok: true } };
  } catch (error) {
    const code = String(error?.message || 'processing_failed').replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 64);
    await finishEvent(event.id, false, code || 'processing_failed');
    return { status: 503, body: publicError('unavailable') };
  }
}

export async function verifyStripeSignature(rawBody, signatureHeader, webhookSecret, options = {}) {
  const toleranceSeconds = options.toleranceSeconds ?? 300;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const parts = String(signatureHeader || '').split(',').map((part) => part.trim());
  const timestamp = Number(parts.find((part) => part.startsWith('t='))?.slice(2));
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!Number.isFinite(timestamp) || signatures.length === 0 || Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return false;
  }
  const expected = await hmacHex(webhookSecret, `${timestamp}.${rawBody}`);
  return signatures.some((signature) => constantTimeEqual(signature, expected));
}

export function redactedJson(value) {
  const serialized = JSON.stringify(value);
  if (/cs_|pi_|sk_|whsec_|buy\.stripe\.com|\/download\//i.test(serialized)) {
    throw new Error('response_contains_private_identifier');
  }
  return serialized;
}
