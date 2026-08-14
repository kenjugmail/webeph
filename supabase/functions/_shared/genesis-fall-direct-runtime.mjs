import { requiredEnv, supabaseRpc } from './genesis-fall-runtime.mjs';

const RELEASE_BUCKET = 'genesis-fall-releases';
const RELEASE_VERSION = '0.1.0-beta.1';

export function expectedDirectStripeContract() {
  return {
    productId: requiredEnv('STRIPE_GENESIS_LIVE_PRODUCT_ID'),
    priceId: requiredEnv('STRIPE_GENESIS_LIVE_PRICE_ID'),
    paymentLinkId: requiredEnv('STRIPE_GENESIS_LIVE_PAYMENT_LINK_ID'),
    livemode: true,
  };
}

async function stripeLiveRequest(path, options = {}) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      authorization: `Bearer ${requiredEnv('STRIPE_GENESIS_LIVE_RESTRICTED_KEY')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: options.body,
  });
  if (!response.ok) throw new Error('stripe_live_request_failed');
  return response.json();
}

export function retrieveDirectCheckoutSession(sessionId) {
  if (!String(sessionId || '').startsWith('cs_')) throw new Error('invalid_session_id');
  return stripeLiveRequest(
    `checkout/sessions/${encodeURIComponent(sessionId)}?expand%5B%5D=line_items.data.price.product`,
  );
}

export async function deactivateDirectPaymentLink() {
  const paymentLinkId = requiredEnv('STRIPE_GENESIS_LIVE_PAYMENT_LINK_ID');
  await stripeLiveRequest(`payment_links/${encodeURIComponent(paymentLinkId)}`, {
    method: 'POST',
    body: new URLSearchParams({ active: 'false' }),
  });
}

export function registerDirectOrderRpc(input) {
  return supabaseRpc('register_genesis_fall_direct_order', {
    p_checkout_session_id: input.checkoutSessionId,
    p_payment_intent_id: input.paymentIntentId,
    p_purchaser_email_hash: input.purchaserEmailHash,
    p_stripe_product_id: input.productId,
    p_stripe_price_id: input.priceId,
    p_stripe_payment_link_id: input.paymentLinkId,
    p_stripe_livemode: input.livemode,
    p_amount_subtotal: input.amountSubtotal,
    p_tax_amount: input.taxAmount,
    p_amount_total: input.amountTotal,
    p_currency: input.currency,
    p_checkout_mode: input.mode,
    p_payment_status: input.paymentStatus,
    p_stripe_event_id: input.stripeEventId || null,
  });
}

export function markDirectManualReview(paymentIntentId, reason, eventId) {
  return supabaseRpc('mark_genesis_fall_direct_order_manual_review', {
    p_payment_intent_id: paymentIntentId,
    p_reason: reason,
    p_stripe_event_id: eventId,
  });
}

export function directReleaseReady() {
  return supabaseRpc('genesis_fall_direct_release_ready');
}

function serviceHeaders(extra = {}) {
  const serviceRole = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: serviceRole,
    authorization: `Bearer ${serviceRole}`,
    ...extra,
  };
}

export async function listDirectArtifacts() {
  const url = requiredEnv('SUPABASE_URL');
  const query = new URLSearchParams({
    select: 'release_version,platform,object_path,download_filename,content_type,sha256,size_bytes,build_sha,active',
    release_version: `eq.${RELEASE_VERSION}`,
    active: 'eq.true',
    order: 'platform.asc',
  });
  const response = await fetch(`${url}/rest/v1/genesis_fall_release_artifacts?${query}`, {
    headers: serviceHeaders(),
  });
  if (!response.ok) throw new Error('artifact_manifest_failed');
  return response.json();
}

function encodedObjectPath(value) {
  const segments = String(value || '').split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('invalid_artifact_path');
  }
  return segments.map(encodeURIComponent).join('/');
}

export async function signDirectArtifact(artifact) {
  const url = requiredEnv('SUPABASE_URL');
  const objectPath = encodedObjectPath(artifact.object_path);
  const response = await fetch(
    `${url}/storage/v1/object/sign/${RELEASE_BUCKET}/${objectPath}`,
    {
      method: 'POST',
      headers: serviceHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ expiresIn: 900 }),
    },
  );
  if (!response.ok) throw new Error('artifact_sign_failed');
  const body = await response.json();
  if (!body?.signedURL || !String(body.signedURL).startsWith('/object/sign/')) {
    throw new Error('invalid_signed_url');
  }
  const signedUrl = new URL(`${url}/storage/v1${body.signedURL}`);
  signedUrl.searchParams.set('download', artifact.download_filename);
  return signedUrl.toString();
}
