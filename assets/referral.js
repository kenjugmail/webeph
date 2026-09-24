/* Orrery referrals. A friend arrives on /orrery?ref=ORRERY-XXXXXXXX; the code is remembered for 30 days on this
 * browser and prefilled at Stripe checkout (50% off their first month). The referrer's free month is credited by
 * the referral-rewards function when that first invoice is paid. Codes and links come from the referral function. */

const STORAGE_KEY = 'orrery-referral';
const CODE_PATTERN = /^ORRERY-[A-HJ-NP-Z2-9]{8}$/;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

export function validReferralCode(value) {
  return typeof value === 'string' && CODE_PATTERN.test(value.trim().toUpperCase());
}

/** Remember ?ref= from the current URL (last one wins). Storage failures are ignored: the link still works. */
export function captureReferral(href = location.href, now = Date.now()) {
  try {
    const code = new URL(href).searchParams.get('ref');
    if (!validReferralCode(code)) return undefined;
    const normalized = code.trim().toUpperCase();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: normalized, at: now }));
    return normalized;
  } catch { return undefined; }
}

export function storedReferral(now = Date.now()) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || !validReferralCode(saved.code) || now - Number(saved.at) > KEEP_MS) return undefined;
    return saved.code;
  } catch { return undefined; }
}

/** Add the remembered code to a Stripe Payment Link as prefilled_promo_code; other URLs pass through unchanged. */
export function withReferral(url, code = storedReferral()) {
  if (!url || !code) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'buy.stripe.com') return url;
    parsed.searchParams.set('prefilled_promo_code', code);
    return parsed.toString();
  } catch { return url; }
}

const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** The account page card: link, copy button, and how many friends joined. Hidden for non-subscribers. */
export async function renderReferralCard(slot, fetchReferral) {
  if (!slot) return;
  let data;
  try { data = await fetchReferral(); } catch { slot.hidden = true; return; }
  if (!data || !data.link) { slot.hidden = true; return; }
  slot.hidden = false;
  const joined = Number(data.redeemed) || 0;
  const rewarded = Number(data.rewarded) || 0;
  slot.innerHTML = `
    <div class="credit-wallet-head">
      <div>
        <span class="mono account-plan-kicker">Refer a friend</span>
        <b>Give 50% off, get a free month</b>
      </div>
      <span class="plan-badge">${joined} joined</span>
    </div>
    <p class="plan-note">Friends who subscribe with your link get ${esc(data.offer || '50% off their first month')}. When their first payment goes through, you get ${esc(data.reward || 'a free month of your plan')}, applied to your next invoice (up to ${Number(data.rewardLimit) || 12} a year${rewarded ? `; ${rewarded} earned so far` : ''}).</p>
    <div class="referral-row">
      <input class="referral-link" type="text" readonly value="${esc(data.link)}" aria-label="Your referral link">
      <button type="button" class="btn btn-primary referral-copy">Copy link</button>
    </div>
    <p class="plan-note">Or share the code <b class="mono">${esc(data.code)}</b> to use at checkout.</p>`;
  const button = slot.querySelector('.referral-copy');
  button?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(data.link); button.textContent = 'Copied'; }
    catch { slot.querySelector('.referral-link')?.select(); button.textContent = 'Press Ctrl+C to copy'; }
    setTimeout(() => { button.textContent = 'Copy link'; }, 2000);
  });
}
