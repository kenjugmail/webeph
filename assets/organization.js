import { getCloudSession, mountCloudAccount } from './cloud-auth.js';

function message(text, ok = false) {
  const node = document.getElementById('organization-checkout-status');
  if (!node) return;
  node.textContent = text;
  node.className = `auth-msg ${ok ? 'ok' : 'err'}`;
}

async function startBusinessCheckout() {
  const button = document.getElementById('business-checkout');
  const nameInput = document.getElementById('organization-name');
  const session = await getCloudSession();
  if (!session?.access_token) {
    message('Sign in below before creating an organization.');
    document.getElementById('cloud-auth-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const organizationName = nameInput?.value?.trim() ?? '';
  if (organizationName.length < 2) {
    message('Enter your organization name.');
    nameInput?.focus();
    return;
  }
  button.disabled = true;
  button.textContent = 'Opening secure checkout...';
  try {
    const base = window.ORRERY_CONFIG?.CLOUD_AUTH_URL;
    if (!base) throw new Error('Organization checkout is not configured.');
    const response = await fetch(`${base}/functions/v1/organization-checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tier: 'business',
        organizationName,
        successUrl: `${location.origin}/organizations.html?checkout=success`,
        cancelUrl: `${location.origin}/organizations.html?checkout=cancelled`,
      }),
    });
    const payload = await response.json();
    if (!response.ok || typeof payload.checkoutUrl !== 'string') {
      throw new Error(typeof payload.error === 'string' ? payload.error : 'Checkout could not be started.');
    }
    location.assign(payload.checkoutUrl);
  } catch (error) {
    message(error instanceof Error ? error.message : 'Checkout could not be started.');
    button.disabled = false;
    button.textContent = 'Start Business';
  }
}

const session = await mountCloudAccount(document);
const checkoutButton = document.getElementById('business-checkout');
if (checkoutButton) {
  checkoutButton.addEventListener('click', startBusinessCheckout);
  checkoutButton.textContent = session ? 'Start Business' : 'Sign in to start Business';
}

const checkoutState = new URLSearchParams(location.search).get('checkout');
if (checkoutState === 'success') message('Checkout completed. Open Nexus to finish organization setup.', true);
if (checkoutState === 'cancelled') message('Checkout was cancelled. No organization subscription was started.');
