import { getCloudSession, mountCloudAccount } from './cloud-auth.js';

function cfg() {
  return window.ORRERY_CONFIG || {};
}

function message(text, ok = false) {
  const node = document.getElementById('organization-checkout-status');
  if (!node) return;
  node.textContent = text;
  node.className = `auth-msg ${ok ? 'ok' : 'err'}`;
}

function checkoutUrlForOrg(tier) {
  const key = tier === 'enterprise' ? 'ENTERPRISE_CHECKOUT_URL' : 'BUSINESS_CHECKOUT_URL';
  const url = cfg()[key];
  if (typeof url === 'string' && url && !url.includes('YOUR_')) return url;
  return null;
}

async function startOrgCheckout(tier) {
  const buttonId = tier === 'enterprise' ? 'enterprise-checkout' : 'business-checkout';
  const button = document.getElementById(buttonId);
  const nameInput = document.getElementById('organization-name');
  const label = tier === 'enterprise' ? 'Enterprise' : 'Business';
  const session = await getCloudSession();
  if (!session?.access_token) {
    message('Sign in below before starting organization checkout.');
    document.getElementById('cloud-auth-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const organizationName = nameInput?.value?.trim() ?? '';
  if (organizationName.length < 2) {
    message('Enter your organization name.');
    nameInput?.focus();
    return;
  }
  const checkoutUrl = checkoutUrlForOrg(tier);
  if (!checkoutUrl) {
    message(`${label} Stripe checkout is not configured yet. Contact sales for setup help.`);
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = 'Opening Stripe…';
  }
  try {
    const url = new URL(checkoutUrl);
    url.searchParams.set('prefilled_email', session.user?.email || '');
    url.searchParams.set('client_reference_id', organizationName.slice(0, 120));
    location.assign(url.toString());
  } catch (error) {
    message(error instanceof Error ? error.message : 'Checkout could not be started.');
    if (button) {
      button.disabled = false;
      button.textContent = `Start ${label} with Stripe`;
    }
  }
}

const session = await mountCloudAccount(document);
const businessBtn = document.getElementById('business-checkout');
const enterpriseBtn = document.getElementById('enterprise-checkout');
const signedInLabel = session ? 'Start Business with Stripe' : 'Sign in to start Business';
const signedInEnterprise = session ? 'Start Enterprise with Stripe' : 'Sign in to start Enterprise';

if (businessBtn) {
  businessBtn.addEventListener('click', () => startOrgCheckout('business'));
  businessBtn.textContent = signedInLabel;
}
if (enterpriseBtn) {
  enterpriseBtn.addEventListener('click', () => startOrgCheckout('enterprise'));
  enterpriseBtn.textContent = signedInEnterprise;
}

const checkoutState = new URLSearchParams(location.search).get('checkout');
if (checkoutState === 'success') message('Checkout completed. Open Nexus to finish organization setup, or email kt@ephemerent.com for onboarding help.', true);
if (checkoutState === 'cancelled') message('Checkout was cancelled. No organization subscription was started.');
