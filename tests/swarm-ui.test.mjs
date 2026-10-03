import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeSwarmStatus, validateSwarmPrompt, makeSwarmPayload, fetchSwarmStatus, requestSwarmCompletion, SWARM_REQUEST_TIMEOUT_MS } from '../assets/swarm-inference.js';

const online = () => normalizeSwarmStatus({ available: true, workers: 2, models: [{ id: 'community-model' }], limits: { requests_per_hour: 8, max_tokens: 256 } });

test('capacity is fail-closed and model IDs are validated and deduplicated', () => {
  assert.deepEqual(online(), { available: true, workers: 2, models: ['community-model'], reason: '', requestsPerHour: 8, maxTokens: 256 });
  for (const malformed of [null, {}, { available: 'true', workers: 1, models: [] }, { available: true, workers: -1, models: [] }]) assert.throws(() => normalizeSwarmStatus(malformed));
  assert.equal(normalizeSwarmStatus({ available: true, workers: 0, models: [{ id: 'x' }] }).available, false);
  assert.equal(normalizeSwarmStatus({ available: true, workers: 1, models: [] }).available, false);
  assert.deepEqual(normalizeSwarmStatus({ available: false, workers: 1, models: [{ id: 'x' }, { id: 'x' }, {}, { id: ' ' }, { id: 'a'.repeat(201) }] }).models, ['x']);
  assert.equal(normalizeSwarmStatus({ available: true, workers: 1, models: [{ id: 'x' }], limits: { max_tokens: 1000 } }).maxTokens, 256);
  assert.equal(normalizeSwarmStatus({ available: true, workers: 1, models: [{ id: 'x' }], limits: { max_tokens: 128 } }).maxTokens, 128);
});

test('prompt constraints enforce empty, character and UTF-8 limits', () => {
  assert.match(validateSwarmPrompt(' \n '), /Write a prompt/);
  assert.equal(validateSwarmPrompt('x'.repeat(2000)), '');
  assert.match(validateSwarmPrompt('x'.repeat(2001)), /2,000/);
  assert.equal(validateSwarmPrompt('界'.repeat(2000)), '');
  assert.match(validateSwarmPrompt('界'.repeat(2001)), /2,000/);
  assert.equal(validateSwarmPrompt('😀'.repeat(1000)), '');
});

test('payloads require explicit consent and available model, with no history', () => {
  const args = { prompt: ' Explain gravity. ', model: 'community-model', consent: true, status: online() };
  assert.deepEqual(makeSwarmPayload(args), { model: 'community-model', messages: [{ role: 'user', content: 'Explain gravity.' }], max_tokens: 256, stream: false });
  for (const consent of [false, undefined, 'true']) assert.throws(() => makeSwarmPayload({ ...args, consent }), /privacy notice/);
  assert.throws(() => makeSwarmPayload({ ...args, model: 'unlisted' }), /No capacity/);
  assert.throws(() => makeSwarmPayload({ ...args, status: null }), /No capacity/);
  assert.throws(() => makeSwarmPayload({ ...args, prompt: '' }), /Write a prompt/);
});

test('status checks use only the same-origin status route and do not send prompts or cookies', async () => {
  let request;
  const result = await fetchSwarmStatus(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ available: false, workers: 0, models: [], reason: 'Waiting for contributors' }) };
  });
  assert.equal(result.available, false);
  assert.equal(request.url, '/swarm-api/status');
  assert.equal(request.options.body, undefined);
  assert.equal(request.options.credentials, 'omit');
  assert.equal(request.options.cache, 'no-store');
  assert.ok(request.options.signal instanceof AbortSignal);
  await assert.rejects(fetchSwarmStatus(async () => ({ ok: false })), /coordinator/);
});

test('completion uses one nonstreaming request and returns plain text', async () => {
  const payload = makeSwarmPayload({ prompt: 'Hello', model: 'community-model', consent: true, status: online() });
  let calls = 0;
  const result = await requestSwarmCompletion(payload, async (url, options) => {
    calls += 1;
    assert.equal(url, '/swarm-api/chat');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'omit');
    assert.deepEqual(JSON.parse(options.body), payload);
    return { ok: true, json: async () => ({ choices: [{ message: { content: '<script>untrusted text</script>' }, finish_reason: 'length' }] }) };
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: true, content: '<script>untrusted text</script>', truncated: true });
});

test('worker failures, capacity loss, rate limits and invalid replies remain explicit', async () => {
  for (const status of [400, 413, 422, 429, 500, 502, 503, 504]) {
    let calls = 0;
    const result = await requestSwarmCompletion({}, async () => { calls++; return { ok: false, status }; });
    assert.equal(calls, 1);
    assert.equal(result.ok, false);
    assert.equal(result.unavailable, [502, 503, 504].includes(status));
  }
  for (const body of [null, {}, { choices: [] }, { choices: [{ message: { content: '' } }] }]) {
    const result = await requestSwarmCompletion({}, async () => ({ ok: true, json: async () => body }));
    assert.equal(result.ok, false);
    assert.match(result.message, /no usable text/);
  }
});

test('request timeout aborts and never retries', async () => {
  assert.equal(SWARM_REQUEST_TIMEOUT_MS, 95000);
  let calls = 0;
  const result = await requestSwarmCompletion({}, async (_url, options) => {
    calls++;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  }, 5);
  assert.equal(calls, 1);
  assert.equal(result.unavailable, true);
  assert.match(result.message, /timed out/);
  assert.match(result.message, /Nothing was retried automatically/);
});

test('network and malformed JSON failures do not imply a request was never sent', async () => {
  for (const fetcher of [async () => { throw new TypeError('offline'); }, async () => ({ ok: true, json: async () => { throw new SyntaxError('invalid'); } })]) {
    const result = await requestSwarmCompletion({}, fetcher);
    assert.equal(result.ok, false);
    assert.match(result.message, /may have reached a volunteer/);
  }
});

test('page contract includes privacy consent, offline defaults, contribution disclosures and accessible labels', () => {
  const html = readFileSync(new URL('../swarm.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../assets/swarm-inference.js', import.meta.url), 'utf8');
  assert.match(html, /data-generate disabled/);
  assert.match(html, /data-consent type="checkbox" required/);
  assert.match(html, /Volunteer GPU operators can see your prompts and responses/);
  assert.match(html, /Never send passwords, API keys, personal data, or confidential information/);
  assert.match(html, /invite-only/);
  assert.match(html, /does not install software or use your GPU/);
  assert.match(html, /Contributors cover their own electricity, hardware, and bandwidth/);
  assert.match(html, /mailto:kt@ephemerent.com\?subject=Swarm%20GPU%20contributor/);
  assert.match(html, /<noscript>/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /maxlength="2000"/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|\.innerHTML|setInterval/);
  assert.match(js, /find\('response-text'\)\.textContent = result.content/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
});
