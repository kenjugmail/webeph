import { claimGenesisFall, publicError } from '../_shared/genesis-fall-core.mjs';
import {
  allocationRpc,
  corsHeaders,
  expectedStripeContract,
  inventoryAvailable,
  jsonResponse,
  requiredEnv,
  retrieveCheckoutSession,
} from '../_shared/genesis-fall-runtime.mjs';

Deno.serve(async (request) => {
  let cors;
  try {
    cors = corsHeaders(request);
  } catch {
    return jsonResponse(503, publicError('unavailable'));
  }
  if (!cors) return jsonResponse(403, publicError('unavailable'));
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResponse(405, publicError('unavailable'), cors);

  try {
    const body = await request.json();
    if (body?.action === 'availability') {
      return jsonResponse(200, { ok: true, checkoutAvailable: await inventoryAvailable() }, cors);
    }
    if (body?.action !== 'claim') return jsonResponse(400, publicError('invalid_purchase'), cors);

    const sessionId = String(body.session_id || '');
    if (!sessionId.startsWith('cs_') || sessionId.length > 255) {
      return jsonResponse(400, publicError('invalid_purchase'), cors);
    }

    const result = await claimGenesisFall({
      session: await retrieveCheckoutSession(sessionId),
      submittedEmail: body.email,
      expected: expectedStripeContract(),
      emailHmacSecret: requiredEnv('GENESIS_EMAIL_HMAC_SECRET'),
      keyEncryptionSecret: requiredEnv('GENESIS_KEY_ENCRYPTION_KEY'),
      allocate: allocationRpc,
    });
    return jsonResponse(result.status, result.body, cors);
  } catch {
    return jsonResponse(503, publicError('unavailable'), cors);
  }
});
