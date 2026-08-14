import {
  processGenesisDirectWebhook,
} from '../_shared/genesis-fall-direct-core.mjs';
import {
  deactivateDirectPaymentLink,
  directReleaseReady,
  expectedDirectStripeContract,
  markDirectManualReview,
  registerDirectOrderRpc,
  retrieveDirectCheckoutSession,
} from '../_shared/genesis-fall-direct-runtime.mjs';
import {
  jsonResponse,
  requiredEnv,
  supabaseRpc,
} from '../_shared/genesis-fall-runtime.mjs';
import {
  publicError,
  verifyStripeSignature,
} from '../_shared/genesis-fall-core.mjs';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse(405, publicError('unavailable'));
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  try {
    if (!(await verifyStripeSignature(
      rawBody,
      signature,
      requiredEnv('STRIPE_GENESIS_LIVE_WEBHOOK_SECRET'),
    ))) {
      return jsonResponse(400, publicError('invalid_purchase'));
    }
    const event = JSON.parse(rawBody);
    const result = await processGenesisDirectWebhook({
      event,
      expected: expectedDirectStripeContract(),
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
      retrieveSession: retrieveDirectCheckoutSession,
      registerOrder: registerDirectOrderRpc,
      markManualReview: markDirectManualReview,
      releaseReady: directReleaseReady,
      deactivatePaymentLink: deactivateDirectPaymentLink,
    });
    return jsonResponse(result.status, result.body);
  } catch {
    return jsonResponse(503, publicError('unavailable'));
  }
});
