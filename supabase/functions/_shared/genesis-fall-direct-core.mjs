import {
  GENESIS_DIRECT_METADATA,
  constantTimeEqual,
  emailHash,
  publicError,
  validateCheckoutSession,
} from './genesis-fall-core.mjs';

function paymentIntentFromEventObject(object) {
  return typeof object?.payment_intent === 'string' ? object.payment_intent : object?.payment_intent?.id;
}

export function directExpectedContract(expected) {
  return { ...expected, metadata: GENESIS_DIRECT_METADATA };
}

export function validateArtifactManifest(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length !== 2) return false;
  const platforms = new Set();
  for (const artifact of artifacts) {
    if (!['macos-arm64', 'windows-x64'].includes(artifact?.platform)
        || artifact.release_version !== GENESIS_DIRECT_METADATA.release_version
        || !/^[A-Za-z0-9._/-]{8,240}$/.test(String(artifact.object_path || ''))
        || String(artifact.object_path).includes('..')
        || !/^[A-Za-z0-9._-]{8,160}\.zip$/.test(String(artifact.download_filename || ''))
        || !/^[a-f0-9]{64}$/.test(String(artifact.sha256 || ''))
        || !Number.isInteger(Number(artifact.size_bytes))
        || Number(artifact.size_bytes) < 1
        || artifact.active !== true) {
      return false;
    }
    platforms.add(artifact.platform);
  }
  return platforms.size === 2;
}

export async function claimGenesisFallDirect({
  session,
  submittedEmail,
  expected,
  emailHmacSecret,
  registerOrder,
  listArtifacts,
  signArtifact,
}) {
  const validated = validateCheckoutSession(session, directExpectedContract(expected));
  if (!validated.ok) {
    return { status: validated.code === 'pending' ? 409 : 400, body: publicError(validated.code) };
  }

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

  const order = await registerOrder({ ...validated.value, purchaserEmailHash: stripeHash });
  if (order.status === 'manual_review') return { status: 409, body: publicError('manual_review') };
  if (order.status !== 'paid') return { status: 503, body: publicError('unavailable') };

  const artifacts = await listArtifacts();
  if (!validateArtifactManifest(artifacts)) {
    return { status: 409, body: publicError('release_pending') };
  }

  const downloads = [];
  for (const artifact of artifacts) {
    const signedUrl = await signArtifact(artifact);
    if (!/^https:\/\//.test(String(signedUrl || ''))) {
      return { status: 503, body: publicError('unavailable') };
    }
    downloads.push({
      platform: artifact.platform,
      filename: artifact.download_filename,
      sha256: artifact.sha256,
      sizeBytes: Number(artifact.size_bytes),
      buildSha: artifact.build_sha,
      url: signedUrl,
      expiresIn: 900,
    });
  }
  downloads.sort((left, right) => left.platform.localeCompare(right.platform));
  return {
    status: 200,
    body: {
      ok: true,
      releaseVersion: GENESIS_DIRECT_METADATA.release_version,
      downloads,
    },
  };
}

export async function processGenesisDirectWebhook({
  event,
  expected,
  emailHmacSecret,
  beginEvent,
  finishEvent,
  retrieveSession,
  registerOrder,
  markManualReview,
  releaseReady,
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

    const session = await retrieveSession(event.data?.object?.id);
    const validated = validateCheckoutSession(session, directExpectedContract(expected));
    if (!validated.ok) {
      await finishEvent(event.id, false, validated.code);
      return { status: validated.code === 'pending' ? 409 : 400, body: publicError(validated.code) };
    }

    const purchaserEmailHash = await emailHash(validated.value.email, emailHmacSecret);
    const order = await registerOrder({
      ...validated.value,
      purchaserEmailHash,
      stripeEventId: event.id,
    });
    if (order.status === 'manual_review') {
      await finishEvent(event.id, true, null);
      return { status: 200, body: { ok: true, manualReview: true } };
    }
    if (order.status !== 'paid') throw new Error('direct_order_failed');

    if (!(await releaseReady())) await deactivatePaymentLink();
    await finishEvent(event.id, true, null);
    return { status: 200, body: { ok: true } };
  } catch (error) {
    const code = String(error?.message || 'processing_failed')
      .replace(/[^a-z0-9_]/gi, '_')
      .toLowerCase()
      .slice(0, 64);
    await finishEvent(event.id, false, code || 'processing_failed');
    return { status: 503, body: publicError('unavailable') };
  }
}
