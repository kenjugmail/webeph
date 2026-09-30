/* Orrery Founding 100: the first 100 developers get 30 days of Pro with no card, granted by the founder with the
 * operator grant in buddyide (cohort `founding-100`, see docs/FOUNDING-PACK.md). A seat needs a confirmed account,
 * so the page first gets people signed up, then has them ask for the seat from that account's email. */

export const FOUNDING_TRIAL_DAYS = 30;
export const FOUNDING_SEATS = 100;
export const FOUNDING_COHORT = 'founding-100';

const SIGN_UP_URL = '/signin?next=%2Forrery%2Ffounding';

/** What the claim buttons do: create an account first, then request the seat from that account's email. */
export function foundingCta(email) {
  if (!email) return { href: SIGN_UP_URL, label: 'Create your free account', step: 'signup' };
  const body = `Account email: ${email}\n\nWhat I build:\nMy current AI coding setup (agents, models):\nThe first real task I'll give Orrery:\n`;
  return {
    href: `mailto:kt@ephemerent.com?subject=${encodeURIComponent('Orrery Founding 100 seat')}&body=${encodeURIComponent(body)}`,
    label: 'Request my founding seat',
    step: 'request',
  };
}

/** "73 of 100 seats left", or undefined when the count is unusable (the page then shows no counter at all). */
export function seatsLabel(seats) {
  const total = Number(seats?.total);
  const claimed = Number(seats?.claimed);
  if (!Number.isInteger(total) || !Number.isInteger(claimed) || total <= 0 || claimed < 0) return undefined;
  const left = Math.max(0, total - claimed);
  return left === 0 ? 'All founding seats are taken' : `${left} of ${total} founding seats left`;
}

/** Public seat count from the `orrery_founding_seats` RPC; undefined on any failure. */
export async function fetchSeats(config = {}, fetchImpl = globalThis.fetch) {
  if (!config.CLOUD_AUTH_URL || !config.CLOUD_AUTH_KEY) return undefined;
  try {
    const response = await fetchImpl(`${config.CLOUD_AUTH_URL}/rest/v1/rpc/orrery_founding_seats`, {
      method: 'POST',
      headers: { apikey: config.CLOUD_AUTH_KEY, 'Content-Type': 'application/json' },
      body: '{}',
    });
    return response.ok ? await response.json() : undefined;
  } catch { return undefined; }
}
