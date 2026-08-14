(() => {
  'use strict';

  const cfg = window.GENESIS_FALL_CONFIG || {};
  const placeholder = (value) => !value || /YOUR_|PLACEHOLDER/i.test(String(value));

  const setStatus = (message, kind = 'neutral') => {
    const status = document.querySelector('[data-purchase-status]');
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  };

  async function checkoutAvailable() {
    if (placeholder(cfg.CLAIM_FUNCTION_URL)) return false;
    const response = await fetch(cfg.CLAIM_FUNCTION_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'availability' }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) return false;
    const body = await response.json();
    return body && body.checkoutAvailable === true;
  }

  async function openStripe() {
    setStatus('Checking private inventory…');
    try {
      if (!(await checkoutAvailable())) {
        setStatus('Direct checkout is not available yet.', 'error');
        return;
      }
      window.location.assign(cfg.STRIPE_CHECKOUT_URL);
    } catch {
      setStatus('Checkout could not be verified. Please try again later.', 'error');
    }
  }

  function activatePurchases() {
    if (cfg.PURCHASES_ENABLED !== true) return;

    const stripe = document.querySelector('[data-stripe-checkout]');
    if (stripe && !placeholder(cfg.STRIPE_CHECKOUT_URL)) {
      stripe.disabled = false;
      stripe.removeAttribute('aria-disabled');
      stripe.addEventListener('click', openStripe);
    }

    const itch = document.querySelector('[data-itch-checkout]');
    if (itch && !placeholder(cfg.ITCH_PAGE_URL)) {
      itch.href = cfg.ITCH_PAGE_URL;
      itch.removeAttribute('aria-disabled');
      itch.removeAttribute('tabindex');
    }

    setStatus('Purchasing is available through Stripe or itch.', 'ready');
  }

  activatePurchases();
})();
