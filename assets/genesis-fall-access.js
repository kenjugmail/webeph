(() => {
  'use strict';

  const cfg = window.GENESIS_FALL_CONFIG || {};
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id') || '';
  const form = document.querySelector('[data-claim-form]');
  const email = document.querySelector('[data-claim-email]');
  const submit = document.querySelector('[data-claim-submit]');
  const notice = document.querySelector('[data-claim-notice]');
  const success = document.querySelector('[data-claim-success]');
  const keyLink = document.querySelector('[data-itch-key-link]');

  const messages = {
    pending: 'Stripe has not confirmed this payment yet. Wait a moment, then try again.',
    wrong_email: 'That email does not match the verified Stripe purchase.',
    depleted: 'Key delivery is temporarily paused. Your paid order is recorded; contact support for manual delivery.',
    manual_review: 'This order needs manual review before access can be delivered. Contact support with your Stripe receipt.',
    invalid_purchase: 'This Checkout Session is not a valid paid Genesis Fall Beta purchase.',
    unavailable: 'Access recovery is not configured on this private candidate.',
  };

  const show = (message, kind = 'neutral') => {
    notice.textContent = message;
    notice.dataset.kind = kind;
  };

  if (!sessionId || !sessionId.startsWith('cs_')) {
    show('Open this page from the completion link for your Stripe purchase.', 'error');
    submit.disabled = true;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const functionUrl = String(cfg.CLAIM_FUNCTION_URL || '');
    if (!functionUrl || /YOUR_|PLACEHOLDER/i.test(functionUrl)) {
      show(messages.unavailable, 'error');
      return;
    }

    submit.disabled = true;
    success.hidden = true;
    show('Verifying the paid Checkout Session…');

    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'claim', session_id: sessionId, email: email.value }),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok !== true || !body.itchKeyUrl) {
        show(messages[body.code] || 'Access could not be verified. Contact support if this continues.', 'error');
        return;
      }

      keyLink.href = body.itchKeyUrl;
      success.hidden = false;
      show('Purchase verified. Your private itch ownership link is ready.', 'ready');
    } catch {
      show('The verification service could not be reached. No purchase data was changed; try again later.', 'error');
    } finally {
      submit.disabled = false;
    }
  });
})();
