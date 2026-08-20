import {
  processGenesisWebhook,
  publicError,
  verifyStripeSignature,
} from '../_shared/genesis-fall-core.mjs';
import {
  allocationRpc,
  deactivateGenesisPaymentLink,
  expectedStripeContract,
  jsonResponse,
  requiredEnv,
  retrieveCheckoutSession,
  supabaseRpc,
} from '../_shared/genesis-fall-runtime.mjs';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse(405, publicError('unavailable'));
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  try {
    if (!(await verifyStripeSignature(rawBody, signature, requiredEnv('STRIPE_GENESIS_WEBHOOK_SECRET')))) {
      return jsonResponse(400, publicError('invalid_purchase'));
    }
    const event = JSON.parse(rawBody);
    const result = await processGenesisWebhook({
      event,
      expected: expectedStripeContract(),
      emailHmacSecret: requiredEnv('GENESIS_EMAIL_HMAC_SECRET'),
      beginEvent: (eventId, eventType) => supabaseRpc('begin_stripe_webhook_event', {
        p_event_id: eventId,
        p_event_type: eventType,
      }),
      finishEvent: (eventId, succeeded, errorCode) => supabaseRpc('finish_stripe_webhook_event', {
        p_event_id: eventId,
        p_succeeded: succeeded,
        p_error_code: errorCode,
      }),
      retrieveSession: retrieveCheckoutSession,
      allocate: allocationRpc,
      markManualReview: (paymentIntentId, reason, eventId) => supabaseRpc(
        'mark_genesis_fall_order_manual_review',
        { p_payment_intent_id: paymentIntentId, p_reason: reason, p_stripe_event_id: eventId },
      ),
      deactivatePaymentLink: deactivateGenesisPaymentLink,
    });
    return jsonResponse(result.status, result.body);
  } catch {
    return jsonResponse(503, publicError('unavailable'));
  }
});
