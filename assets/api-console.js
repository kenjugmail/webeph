/* Orrery API console on /cloud: a key created on your first visit and shown once, a prompt to hand your agent,
 * a first call to paste, a live "waiting for your first request", credit and request stats, a quickstart in
 * curl / TypeScript / Python, ready examples, your keys, and where your credits come from.
 *
 * Data comes from two existing endpoints, both authenticated with the Supabase session token:
 *   relay-admin  GET/POST/DELETE /keys, GET /requests (your last 100 request receipts, metadata only)
 *   model-relay  GET /usage (this month's pools and your purchased-credit balance)
 * Nothing here reads prompts or outputs. Helpers above the DOM section are pure and unit-tested. */
import { formatTokens } from './accountPlan.js';

export const API_BASE_URL = 'https://api.ephemerent.com/v1';
export const API_MODEL = 'arbiter-flash-27b';
export const API_DOCS_URL = 'https://ephemerent.com/developers';
export const API_KEY_ENV = 'ARBITER_API_KEY';
const DAY_MS = 24 * 60 * 60 * 1000;
const RECEIPT_LIMIT = 100; // relay-admin returns at most this many receipts

/** One credit is one millionth of a dollar of provider cost. */
export function creditsToUsd(credits) {
  return Math.max(0, Number(credits) || 0) / 1_000_000;
}

export function formatUsd(usd) {
  const value = Math.max(0, Number(usd) || 0);
  if (value > 0 && value < 0.01) return '<$0.01';
  return `$${value.toFixed(2)}`;
}

export const API_EXAMPLES = [
  {
    id: 'rule',
    title: 'Find the rule',
    blurb: 'A short reasoning puzzle: the model finds the pattern and the next term.',
    tags: ['reasoning'],
    body: { model: API_MODEL, messages: [{ role: 'user', content: 'Find the rule: 2, 6, 12, 20, 30. What comes next?' }], max_tokens: 400 },
  },
  {
    id: 'triage',
    title: 'Support ticket triage',
    blurb: 'Route a double-charge complaint and score its urgency as JSON.',
    tags: ['json', 'classification'],
    body: {
      model: API_MODEL,
      messages: [
        { role: 'system', content: 'Classify the ticket. Reply with JSON: {"category": "billing|bug|account|other", "urgency": 1-5, "reason": string}.' },
        { role: 'user', content: 'I was charged twice for my subscription this month and my bank says both went through. Please fix this today.' },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
    },
  },
  {
    id: 'tools',
    title: 'Tool call',
    blurb: 'The model decides to call your function with typed arguments.',
    tags: ['tools'],
    body: {
      model: API_MODEL,
      messages: [{ role: 'user', content: 'Do I need an umbrella in Tokyo tomorrow?' }],
      tools: [{ type: 'function', function: { name: 'get_forecast', description: 'Weather forecast for a city and day', parameters: { type: 'object', properties: { city: { type: 'string' }, day: { type: 'string' } }, required: ['city', 'day'] } } }],
      max_tokens: 200,
    },
  },
  {
    id: 'review',
    title: 'Code review',
    blurb: 'Spot the bug in a small function and suggest the fix.',
    tags: ['code'],
    body: {
      model: API_MODEL,
      messages: [{ role: 'user', content: 'Find the bug and give the fix:\n\nfunction average(xs) {\n  let total = 0;\n  for (let i = 1; i < xs.length; i++) total += xs[i];\n  return total / xs.length;\n}' }],
      max_tokens: 400,
    },
  },
];

function exampleById(id) {
  return API_EXAMPLES.find((example) => example.id === id) ?? API_EXAMPLES[0];
}

/** Readable request bodies: one line per field, and one line per message or tool, instead of JSON.stringify's
 *  one line per token-sized value. */
function inlineJson(value) {
  if (Array.isArray(value)) return `[${value.map(inlineJson).join(', ')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${inlineJson(item)}`).join(', ')}}`;
  return JSON.stringify(value);
}

function compactJson(value, pad = '') {
  const inner = `${pad}  `;
  const fields = Object.entries(value).map(([key, item]) => {
    const rendered = Array.isArray(item) && item.length > 1 && item.every((entry) => typeof entry === 'object' && entry !== null)
      ? `[\n${item.map((entry) => `${inner}  ${inlineJson(entry)}`).join(',\n')}\n${inner}]`
      : inlineJson(item);
    return `${inner}${JSON.stringify(key)}: ${rendered}`;
  });
  return `{\n${fields.join(',\n')}\n${pad}}`;
}

function indent(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((line, i) => (i === 0 ? line : pad + line)).join('\n');
}

function shellSingleQuote(text) {
  return text.replace(/'/g, `'\\''`);
}

/** curl, TypeScript and Python for one example, reading the key from ARBITER_API_KEY. */
export function apiSnippets(exampleId = 'rule') {
  const { body } = exampleById(exampleId);
  const json = compactJson(body);
  const curl = `curl ${API_BASE_URL}/chat/completions \\
  -H "Authorization: Bearer $${API_KEY_ENV}" \\
  -H "Content-Type: application/json" \\
  -d '${shellSingleQuote(indent(json, 2))}'`;
  const { model: _model, ...rest } = body;
  const tsArgs = compactJson({ model: API_MODEL, ...rest });
  const typescript = `// npm install openai
import OpenAI from "openai";

const client = new OpenAI({ baseURL: "${API_BASE_URL}", apiKey: process.env.${API_KEY_ENV} });
const reply = await client.chat.completions.create(${indent(tsArgs, 0)});
console.log(reply.choices[0].message);`;
  const python = `# pip install openai
import os
from openai import OpenAI

client = OpenAI(base_url="${API_BASE_URL}", api_key=os.environ["${API_KEY_ENV}"])
reply = client.chat.completions.create(**${pythonLiteral({ model: API_MODEL, ...rest })})
print(reply.choices[0].message)`;
  return { curl, typescript, python };
}

/** JSON is valid Python except for true/false/null. */
function pythonLiteral(value) {
  return compactJson(value).replace(/([:,[]\s*)true\b/g, '$1True').replace(/([:,[]\s*)false\b/g, '$1False').replace(/([:,[]\s*)null\b/g, '$1None');
}

/** The first call to paste into a terminal: the key export (when we have the secret) and the curl. */
export function firstCallSnippet(key, exampleId = 'rule') {
  const exportLine = key ? `export ${API_KEY_ENV}=${key}` : `export ${API_KEY_ENV}=<your key>`;
  return `${exportLine}\n\n${apiSnippets(exampleId).curl}`;
}

/** A ready prompt for a coding agent: where the API is, which model, the docs, and how to handle the key. */
export function agentPrompt(key) {
  return [
    'Use the Orrery Arbiter API in this project.',
    '',
    `- Base URL: ${API_BASE_URL} (OpenAI-compatible: /chat/completions, streaming with stream: true, tool calls in the OpenAI schema)`,
    `- Model: ${API_MODEL} (or the routes orrery/fast, orrery/balanced, orrery/verified, which pick a model per request)`,
    `- Docs: ${API_DOCS_URL}`,
    `- API key: ${key || `<paste your key>`}`,
    '',
    `Put the key in an environment variable named ${API_KEY_ENV} (for example in a .env file that is git-ignored) and read it from there.`,
    'Never commit the key, print it, log it, or ship it in browser code.',
    'Use the official OpenAI SDK with the base URL above instead of hand-written HTTP calls.',
    'GET /v1/usage shows the remaining credits; an HTTP 429 means the monthly pool and purchased credits ran out.',
  ].join('\n');
}

/** Requests and spend over the last 7 days from the receipts. `capped` is true when the receipt window
 *  (the last 100) does not reach back 7 days, so the real numbers may be higher. */
export function weekStats(requests, now = Date.now()) {
  const list = Array.isArray(requests) ? requests : [];
  const since = now - 7 * DAY_MS;
  const recent = list.filter((r) => Date.parse(r.created_at ?? r.createdAt ?? '') >= since);
  const credits = recent.reduce((sum, r) => sum + Math.max(0, Number(r.settled_credits ?? r.settledCredits ?? 0) || 0), 0);
  const latest = list.map((r) => Date.parse(r.created_at ?? r.createdAt ?? '')).filter(Number.isFinite).sort((a, b) => b - a)[0];
  return { count: recent.length, credits, capped: list.length >= RECEIPT_LIMIT && recent.length === list.length, latestAt: latest };
}

/** The monthly pools and the purchased wallet, as rows for the credits table and the balance tile. */
export function creditRows(usage) {
  const pools = Array.isArray(usage?.pools) ? usage.pools : [];
  const label = { 'arbiter-runpod': 'Arbiter 27B monthly pool', doubleword: 'Doubleword monthly pool' };
  const rows = pools.filter((pool) => Number(pool.quotaCredits) > 0).map((pool) => {
    const quota = Number(pool.quotaCredits) || 0;
    const used = Number(pool.usedCredits) || 0;
    return { type: label[pool.poolId] ?? pool.poolId, amount: quota, remaining: Math.max(0, quota - used), expires: 'Resets monthly', active: quota - used > 0 };
  });
  const purchased = Math.max(0, Number(usage?.purchasedCredits) || 0);
  if (purchased > 0 || rows.length === 0) rows.push({ type: 'Purchased credits', amount: undefined, remaining: purchased, expires: 'Never', active: purchased > 0 });
  return rows;
}

export function relativeTime(at, now = Date.now()) {
  if (!Number.isFinite(at)) return '';
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

/* ---------------------------------------------------------------- DOM */

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function copyText(button, text, done = 'Copied') {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = done;
  } catch {
    button.textContent = 'Copy failed: select and copy';
  }
  setTimeout(() => { button.textContent = label; }, 1800);
}

function autoCreatedKey(userId) {
  try { return localStorage.getItem(`orrery.api.autoKey.${userId}`) === '1'; } catch { return false; }
}
function markAutoCreated(userId) {
  try { localStorage.setItem(`orrery.api.autoKey.${userId}`, '1'); } catch { /* private window */ }
}

/**
 * Render the console into #cloud-api. `relayFetch(path, init)` calls a Supabase function with the session.
 * Returns a stop() that ends the first-request polling.
 */
export async function mountApiConsole(root, { session, relayFetch, usage }) {
  const host = root.getElementById('cloud-api');
  if (!host || !session?.access_token) return () => {};
  host.hidden = false;
  const userId = session.user?.id ?? 'me';
  let exampleId = 'rule';
  let lang = 'curl';
  let freshKey;          // the secret, only when we created it in this page view
  let freshKeyId;
  let keys = [];
  let requests = [];
  let keysError;
  let plan;
  let poll;
  let landedHere = false; // the first request arrived while this page was open: keep showing the confirmation

  const loadKeys = async () => {
    try {
      const data = await relayFetch('/relay-admin/keys');
      keys = Array.isArray(data?.keys) ? data.keys : [];
      plan = data?.plan;
      keysError = undefined;
    } catch (err) {
      keysError = err instanceof Error ? err.message : String(err);
    }
  };
  const loadRequests = async () => {
    try { requests = (await relayFetch('/relay-admin/requests'))?.requests ?? []; } catch { /* stats stay empty */ }
  };

  await Promise.all([loadKeys(), loadRequests()]);
  // Your first visit gets a key, like a fresh console: only when this account has never had one (revoked keys
  // count), and only once, so revoking every key does not bring a new one back.
  if (keysError === undefined && keys.length === 0 && !autoCreatedKey(userId)) {
    try {
      const out = await relayFetch('/relay-admin/keys', { method: 'POST', body: JSON.stringify({ name: 'default' }) });
      if (out?.key) { freshKey = out.key; freshKeyId = out.record?.id; markAutoCreated(userId); }
      await loadKeys();
    } catch { /* plan limits or issuance off: the create form below still explains */ }
  }

  const activeKeys = () => keys.filter((k) => !(k.revokedAt ?? k.revoked_at));
  const hasRequest = () => requests.length > 0;

  const render = () => {
    const stats = weekStats(requests);
    const rows = creditRows(usage);
    const balanceCredits = rows.reduce((sum, row) => sum + (row.type.startsWith('Doubleword') ? 0 : row.remaining), 0);
    const arbiterPool = rows.find((row) => row.type.startsWith('Arbiter'));
    const purchased = rows.find((row) => row.type === 'Purchased credits');
    const snippets = apiSnippets(exampleId);
    const stepsDone = (activeKeys().length > 0 ? 1 : 0) + (hasRequest() ? 1 : 0);
    const noAccess = keysError !== undefined && /subscription|402/i.test(keysError);
    // Onboarding steps aside once the account is in use, unless a key was just created or the first call just landed.
    const onboarding = freshKey !== undefined || landedHere || !hasRequest();

    host.innerHTML = `
      <div class="auth-optional-head api-head">
        <h2>API</h2>
        <p class="sub">OpenAI-compatible, the same model and credit pools as the desktop. <span class="mono">${esc(API_BASE_URL)}</span> · <span class="mono">${esc(API_MODEL)}</span> · <a href="/developers">Docs</a></p>
      </div>
      ${noAccess ? `<p class="api-empty">API keys come with Pro, Max and Ultra. <a href="/cloud#plans">See plans</a>.</p>` : ''}
      ${freshKey ? `
      <section class="api-card api-newkey" aria-label="Your new API key">
        <h3>Your API key</h3>
        <p class="api-note">We created this key for you. Copy it now; it is shown once.</p>
        <div class="api-secret-row"><code class="api-secret-value">${esc(freshKey)}</code><button type="button" class="btn btn-ghost" data-copy="key">Copy</button></div>
      </section>` : ''}
      ${noAccess ? '' : `
      <section class="api-card api-agent">
        <div>
          <h3>Use with your agent</h3>
          <p class="api-note">Copies a ready prompt with the base URL, model, docs link and how to keep the key safe.</p>
          ${freshKey ? '<p class="api-note api-warn">The prompt contains your key. It is shared with the agent you paste it into.</p>' : '<p class="api-note">The prompt has a placeholder for your key.</p>'}
        </div>
        <button type="button" class="btn btn-primary" data-copy="agent">Copy prompt for your agent</button>
      </section>
      ${onboarding ? `<section class="api-card api-firstcall">
        <h3>Make your first call</h3>
        <p class="api-note">Paste into a terminal. Each call spends credits from your monthly pool first, then purchased credits.</p>
        <div class="api-code"><pre><code>${esc(firstCallSnippet(freshKey, exampleId))}</code></pre><button type="button" class="btn btn-ghost api-code-copy" data-copy="first">Copy</button></div>
        <p class="api-first-request ${hasRequest() ? 'is-done' : ''}" id="api-first-request" role="status" aria-live="polite">${hasRequest()
          ? `<span class="api-dot"></span> First request received ${esc(relativeTime(stats.latestAt))}`
          : '<span class="api-dot"></span> Waiting for your first request'}</p>
      </section>
      <section class="api-card api-steps" aria-label="Getting started">
        <div class="api-steps-head"><h3>Getting started</h3><span class="mono">${stepsDone} of 2</span></div>
        <ol>
          <li class="${activeKeys().length > 0 ? 'done' : ''}"><b>Get your API key</b><span>${freshKey ? 'Created for you on your first visit.' : activeKeys().length > 0 ? 'You have an active key.' : 'Create one below.'}</span></li>
          <li class="${hasRequest() ? 'done' : ''}"><b>Make your first call</b><span>Paste the prompt into your agent, or run the curl command.</span></li>
        </ol>
      </section>` : ''}`}
      <section class="api-stats" aria-label="Credits and usage">
        <div class="api-stat">
          <span class="api-stat-label">Credit balance</span>
          <b>${esc(formatUsd(creditsToUsd(balanceCredits)))}</b>
          <small>${arbiterPool ? `${esc(formatTokens(arbiterPool.remaining))} credits left in this month's Arbiter pool` : 'No monthly Arbiter pool on this plan'}${purchased && purchased.remaining > 0 ? ` · ${esc(formatTokens(purchased.remaining))} purchased, never expire` : ''}</small>
        </div>
        <div class="api-stat">
          <span class="api-stat-label">Spend, last 7 days</span>
          <b>${esc(formatUsd(creditsToUsd(stats.credits)))}</b>
          <small>${esc(formatTokens(stats.credits))} credits · priced at provider cost, 1 credit = $0.000001</small>
        </div>
        <div class="api-stat">
          <span class="api-stat-label">Requests, last 7 days</span>
          <b>${stats.count}${stats.capped ? '+' : ''}</b>
          <small>${stats.count === 0 ? 'No requests yet' : `API and desktop · last ${esc(relativeTime(stats.latestAt))}`}</small>
        </div>
      </section>
      <section class="api-card api-quickstart">
        <div class="api-quick-head">
          <h3>Quickstart</h3>
          <div class="api-tabs" role="tablist" aria-label="Language">
            ${[['curl', 'curl'], ['typescript', 'TypeScript'], ['python', 'Python']].map(([id, name]) => `<button type="button" role="tab" aria-selected="${lang === id}" class="api-tab" data-lang="${id}">${name}</button>`).join('')}
          </div>
        </div>
        <p class="api-note">Base URL <span class="mono">${esc(API_BASE_URL)}</span></p>
        <div class="api-code"><pre><code>${esc(snippets[lang])}</code></pre><button type="button" class="btn btn-ghost api-code-copy" data-copy="quick">Copy</button></div>
      </section>
      <section class="api-card api-examples-card">
        <h3>Try an example</h3>
        <p class="api-note">Swaps the first call and the quickstart to a ready-made request.</p>
        <div class="api-examples">
          ${API_EXAMPLES.map((example) => `<button type="button" class="api-example ${example.id === exampleId ? 'is-active' : ''}" data-example="${example.id}" aria-pressed="${example.id === exampleId}">
            <b>${esc(example.title)}</b><span>${esc(example.blurb)}</span><em>${example.tags.map(esc).join(' · ')}</em></button>`).join('')}
        </div>
      </section>
      <section class="api-card api-keys-card">
        <h3>API keys</h3>
        <div class="api-keys" id="cloud-api-keys">${keysError !== undefined && !noAccess
          ? `<p class="api-empty">API keys are unavailable right now (${esc(keysError)}).</p>`
          : activeKeys().length === 0 ? '<p class="api-empty">No active keys.</p>'
            : activeKeys().map((k) => {
              const prefix = k.prefix ?? k.key_prefix ?? k.keyPrefix ?? '';
              const created = String(k.createdAt ?? k.created_at ?? '').slice(0, 10);
              const last = k.lastUsedAt ?? k.last_used_at;
              return `<div class="api-key-row"><div><b>${esc(k.name || 'key')}</b><span>${esc(prefix)}… · created ${esc(created)} · ${last ? `last used ${esc(relativeTime(Date.parse(last)))}` : 'never used'}</span></div>
                <button type="button" class="btn btn-ghost" data-revoke="${esc(k.id)}">Revoke</button></div>`;
            }).join('')}</div>
        ${noAccess ? '' : `<div class="api-key-create">
          <label class="sr-only" for="cloud-api-key-name">Key name</label>
          <input type="text" class="auth-input" id="cloud-api-key-name" placeholder="Key name (e.g. laptop, CI)" maxlength="120">
          <button type="button" class="btn btn-ghost" id="cloud-api-key-create">Create key</button>
        </div>`}
        <p class="auth-msg" id="cloud-api-msg" role="status" aria-live="polite"></p>
      </section>
      <section class="api-card api-grants">
        <h3>Credits</h3>
        <p class="api-note">Where this account's credits come from. The monthly pool is always spent first.</p>
        <div class="api-table-wrap"><table>
          <thead><tr><th scope="col">Type</th><th scope="col">Amount</th><th scope="col">Remaining</th><th scope="col">Expires</th><th scope="col">Status</th></tr></thead>
          <tbody>${rows.map((row) => `<tr><td>${esc(row.type)}</td><td>${row.amount === undefined ? '—' : `${esc(formatTokens(row.amount))} <small>(${esc(formatUsd(creditsToUsd(row.amount)))})</small>`}</td><td>${esc(formatTokens(row.remaining))} <small>(${esc(formatUsd(creditsToUsd(row.remaining)))})</small></td><td>${esc(row.expires)}</td><td>${row.active ? 'Active' : 'Used up'}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>`;
    bind();
  };

  const say = (text, ok = true) => {
    const msg = root.getElementById('cloud-api-msg');
    if (msg) { msg.textContent = text; msg.style.color = ok ? '' : 'var(--danger, #e5484d)'; }
  };

  const bind = () => {
    host.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', () => {
      const which = button.dataset.copy;
      const text = which === 'key' ? freshKey
        : which === 'agent' ? agentPrompt(freshKey)
          : which === 'first' ? firstCallSnippet(freshKey, exampleId)
            : apiSnippets(exampleId)[lang];
      void copyText(button, text ?? '', which === 'agent' ? 'Prompt copied' : 'Copied');
    }));
    host.querySelectorAll('[data-lang]').forEach((tab) => tab.addEventListener('click', () => { lang = tab.dataset.lang; render(); host.querySelector(`[data-lang="${lang}"]`)?.focus(); }));
    host.querySelectorAll('[data-example]').forEach((button) => button.addEventListener('click', () => { exampleId = button.dataset.example; render(); host.querySelector(`[data-example="${exampleId}"]`)?.focus(); }));
    host.querySelectorAll('[data-revoke]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await relayFetch(`/relay-admin/keys?id=${encodeURIComponent(button.dataset.revoke)}`, { method: 'DELETE' });
        if (button.dataset.revoke === freshKeyId) { freshKey = undefined; freshKeyId = undefined; } // its secret is dead: stop showing it
        await loadKeys(); render(); say('Key revoked. Requests with it fail from now on.');
      } catch (err) { say(err.message, false); button.disabled = false; }
    }));
    const create = root.getElementById('cloud-api-key-create');
    create?.addEventListener('click', async () => {
      const nameEl = root.getElementById('cloud-api-key-name');
      const name = (nameEl?.value || '').trim() || 'api key';
      create.disabled = true; say('');
      try {
        const out = await relayFetch('/relay-admin/keys', { method: 'POST', body: JSON.stringify({ name }) });
        freshKey = out?.key; freshKeyId = out?.record?.id;
        await loadKeys(); render();
        root.querySelector('.api-newkey')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        say('Key created. Copy it above; it is shown once.');
      } catch (err) { say(err.message, false); create.disabled = false; }
    });
  };

  render();
  // Watch for the first request while the page is open (10 minutes at most), then show it landed.
  if (!hasRequest() && keysError === undefined) {
    const startedAt = Date.now();
    poll = setInterval(async () => {
      if (document.hidden) return;
      if (Date.now() - startedAt > 10 * 60 * 1000) { clearInterval(poll); return; }
      await loadRequests();
      if (hasRequest()) { clearInterval(poll); landedHere = true; await loadKeys(); render(); }
    }, 5000);
  }
  return () => clearInterval(poll);
}
