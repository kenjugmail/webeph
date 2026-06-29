# Stripe webhook → automatic entitlements

**Status: not yet wired. This is the single highest-dollar item on the roadmap.**

Today the site ships a `pk_test_` publishable key against live `buy.stripe.com`
links and **no webhook**, so a real payment never upgrades the buyer — entitlements
require a manual SQL `UPDATE` (`supabase/SETUP.md` §8). This doc makes upgrades automatic.

It is delivered as a copy-paste artifact rather than committed live because it needs
three secrets that must not live in the repo, and it changes the Vercel build from
"static only" to "static + serverless function." Do the five steps below in a branch,
dry-run against Stripe test mode, then flip the live key.

---

## 1. Add the function

Create `api/stripe-webhook.js` (Vercel auto-detects `/api/*` as a Node serverless function):

```js
// api/stripe-webhook.js — Stripe → Supabase entitlement sync.
// Verifies the Stripe signature, then writes plan + subscription_status to profiles.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } }; // raw body required for signature check

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // service role: server-only, never shipped to the browser
  { auth: { persistSession: false } }
);

// Map a Stripe Price ID → your plan slug. Fill these from the live Stripe dashboard.
const PRICE_TO_PLAN = {
  // 'price_xxxPro':   'pro',
  // 'price_xxxMax':   'max',
  // 'price_xxxUltra': 'ultra',
};

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(await rawBody(req), sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Bad Stripe signature:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const email = (s.customer_details?.email || s.customer_email || '').toLowerCase();
        const sub = s.subscription ? await stripe.subscriptions.retrieve(s.subscription) : null;
        const priceId = sub?.items?.data?.[0]?.price?.id;
        await applyEntitlement(email, {
          plan: PRICE_TO_PLAN[priceId] || 'pro',
          subscription_status: sub?.status || 'active',
          stripe_customer_id: s.customer,
          stripe_subscription_id: s.subscription,
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const cust = await stripe.customers.retrieve(sub.customer);
        const email = (cust.email || '').toLowerCase();
        const active = sub.status === 'active' || sub.status === 'trialing';
        await applyEntitlement(email, {
          plan: active ? (PRICE_TO_PLAN[sub.items.data[0]?.price?.id] || 'pro') : 'free',
          subscription_status: sub.status,
          stripe_subscription_id: sub.id,
        });
        break;
      }
      default:
        break; // ignore everything else
    }
  } catch (err) {
    console.error('Entitlement write failed:', err);
    return res.status(500).send('Entitlement write failed'); // 5xx → Stripe retries
  }

  return res.status(200).json({ received: true });
}

async function applyEntitlement(email, fields) {
  if (!email) throw new Error('No email on Stripe event');
  // Optional but recommended: append to billing_events for an audit trail.
  await supabase.from('billing_events').insert({ email, payload: fields }).then(() => {}, () => {});
  const { error } = await supabase.from('profiles').update(fields).eq('email', email);
  if (error) throw error;
}
```

## 2. Add dependencies

The repo is currently dependency-free. Add a minimal `package.json` at the root:

```json
{
  "private": true,
  "dependencies": {
    "stripe": "^18.0.0",
    "@supabase/supabase-js": "^2.49.1"
  }
}
```

Vercel installs these only for the function; the static pages are unaffected.

## 3. Set environment variables (Vercel → Project → Settings → Environment Variables)

| Var | Where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys → **live** secret key (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Created in step 4 (`whsec_…`) |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** key (server-only!) |

The service-role key bypasses RLS — it must **only** ever live in this server env, never in
`assets/site-config.js` or any browser-served file.

## 4. Register the webhook in Stripe

Stripe dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://ephemerent.com/api/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

Fill `PRICE_TO_PLAN` with the live Price IDs for Pro/Max/Ultra.

## 5. Flip the publishable key

In `assets/site-config.js`, replace the committed `pk_test_…` `STRIPE_PUBLISHABLE_KEY`
with the **live** publishable key (`pk_live_…`). The publishable key is safe to commit;
the secret key is not.

---

## Verify before trusting it

```bash
# local replay against the deployed function (test mode):
stripe listen --forward-to https://ephemerent.com/api/stripe-webhook
stripe trigger checkout.session.completed
```

Definition of done (from the roadmap, O3-KR1): a live test purchase via the Stripe Link
completes, the webhook fires, and the buyer's `profiles` row flips to the paid plan with
`subscription_status = active` — **with no human running SQL**. Until that passes, treat
every charge as a sev-1: reconcile within 24h and refund any un-entitled payment.
