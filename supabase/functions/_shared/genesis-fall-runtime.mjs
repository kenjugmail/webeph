import { checkoutAvailableForCount } from './genesis-fall-core.mjs';

export function requiredEnv(name) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

export function expectedStripeContract() {
  const livemode = requiredEnv('STRIPE_GENESIS_LIVEMODE');
  if (!['true', 'false'].includes(livemode)) throw new Error('invalid_stripe_genesis_livemode');
  return {
    productId: requiredEnv('STRIPE_GENESIS_PRODUCT_ID'),
    priceId: requiredEnv('STRIPE_GENESIS_PRICE_ID'),
    paymentLinkId: requiredEnv('STRIPE_GENESIS_PAYMENT_LINK_ID'),
    livemode: livemode === 'true',
  };
}

export async function stripeRequest(path, options = {}) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      authorization: `Bearer ${requiredEnv('STRIPE_SECRET_KEY')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: options.body,
  });
  if (!response.ok) throw new Error('stripe_request_failed');
  return response.json();
}

export async function retrieveCheckoutSession(sessionId) {
  if (!String(sessionId || '').startsWith('cs_')) throw new Error('invalid_session_id');
  return stripeRequest(`checkout/sessions/${encodeURIComponent(sessionId)}?expand%5B%5D=line_items.data.price.product`);
}

export async function deactivateGenesisPaymentLink() {
  const paymentLinkId = requiredEnv('STRIPE_GENESIS_PAYMENT_LINK_ID');
  await stripeRequest(`payment_links/${encodeURIComponent(paymentLinkId)}`, {
    method: 'POST',
    body: new URLSearchParams({ active: 'false' }),
  });
}

export async function supabaseRpc(name, params = {}) {
  const url = requiredEnv('SUPABASE_URL');
  const serviceRole = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serviceRole,
      authorization: `Bearer ${serviceRole}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(`database_${name}_failed`);
  const payload = await response.text();
  return payload ? JSON.parse(payload) : null;
}

export function allocationRpc(input) {
  return supabaseRpc('allocate_genesis_fall_order', {
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

export async function inventoryAvailable() {
  const count = Number(await supabaseRpc('genesis_fall_available_inventory'));
  return checkoutAvailableForCount(count);
}

export function corsHeaders(request) {
  const configuredOrigin = requiredEnv('GENESIS_SITE_ORIGIN');
  const origin = request.headers.get('origin');
  if (origin !== configuredOrigin) return null;
  return {
    'access-control-allow-origin': configuredOrigin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

export function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
