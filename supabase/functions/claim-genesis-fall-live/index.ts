import { claimGenesisFallDirect } from '../_shared/genesis-fall-direct-core.mjs';
import {
  directReleaseReady,
  expectedDirectStripeContract,
  listDirectArtifacts,
  registerDirectOrderRpc,
  retrieveDirectCheckoutSession,
  signDirectArtifact,
} from '../_shared/genesis-fall-direct-runtime.mjs';
import {
  corsHeaders,
  jsonResponse,
  requiredEnv,
} from '../_shared/genesis-fall-runtime.mjs';
import { publicError } from '../_shared/genesis-fall-core.mjs';

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
      return jsonResponse(200, { ok: true, checkoutAvailable: await directReleaseReady() }, cors);
    }
    if (body?.action !== 'claim') return jsonResponse(400, publicError('invalid_purchase'), cors);

    const sessionId = String(body.session_id || '');
    if (!sessionId.startsWith('cs_') || sessionId.length > 255) {
      return jsonResponse(400, publicError('invalid_purchase'), cors);
    }

    const result = await claimGenesisFallDirect({
      session: await retrieveDirectCheckoutSession(sessionId),
      submittedEmail: body.email,
      expected: expectedDirectStripeContract(),
      emailHmacSecret: requiredEnv('GENESIS_EMAIL_HMAC_SECRET'),
      registerOrder: registerDirectOrderRpc,
      listArtifacts: listDirectArtifacts,
      signArtifact: signDirectArtifact,
    });
    return jsonResponse(result.status, result.body, cors);
  } catch {
    return jsonResponse(503, publicError('unavailable'), cors);
  }
});
