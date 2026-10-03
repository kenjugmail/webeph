import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHandler, gatewayConfig } from '../api/swarm.js';

const env = { SWARM_GATEWAY_URL: 'https://coordinator.example/', SWARM_PROXY_TOKEN: 's'.repeat(40) };
const request = (operation = 'status', overrides = {}) => ({ query: { operation }, method: operation === 'status' ? 'GET' : 'POST', headers: { 'content-type': 'application/json', 'x-vercel-forwarded-for': '203.0.113.1', origin: 'https://ephemerent.com' }, body: { model: 'test', messages: [{ role: 'user', content: 'hello' }] }, ...overrides });
const response = () => ({ code: 200, headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
async function call(req, opts = {}) { const res = response(); await createHandler(opts)(req, res); return res; }

test('unconfigured deployment is honestly offline and never calls a provider', async () => {
  const opts = { env: {}, fetcher: () => { throw Error('must not fetch'); } };
  const state = await call(request(), opts);
  assert.equal(state.code, 200); assert.equal(state.body.available, false); assert.equal(state.body.workers, 0);
  assert.match(state.body.reason, /^Common Compute is being prepared\./);
  assert.equal((await call(request('chat'), opts)).code, 503);
});
test('configuration rejects insecure or credential-bearing URLs', () => {
  for (const url of ['http://host', 'https://secret@host', 'https://host?token=x', 'https://host/path%20encoded']) {
    assert.equal(gatewayConfig({ ...env, SWARM_GATEWAY_URL: url }), null);
  }
  assert.equal(gatewayConfig({ ...env, SWARM_PROXY_TOKEN: 'short' }), null);
  assert.equal(gatewayConfig({ ...env, SWARM_GATEWAY_URL: 'https://host/swarm/' }).base, 'https://host/swarm');
});
test('proxy hashes platform IP and forwards no visitor keys or cookies', async () => {
  let forwarded;
  const req = request('chat'); req.headers.authorization = 'Bearer visitor-key'; req.headers.cookie = 'session=private';
  req.headers['x-swarm-client'] = 'spoofed'; req.headers['x-forwarded-for'] = '1.2.3.4';
  const res = await call(req, { env, fetcher: async (url, init) => {
    forwarded = { url, ...init };
    return Response.json({ model: 'test', choices: [{ message: { content: 'real response' }, finish_reason: 'stop' }], internal: 'private' });
  } });
  assert.equal(res.code, 200); assert.equal(res.body.choices[0].message.content, 'real response'); assert.equal(res.body.internal, undefined);
  assert.equal(forwarded.url, 'https://coordinator.example/public/swarm/chat');
  assert.match(forwarded.headers['x-swarm-client'], /^[a-f0-9]{64}$/);
  assert.equal(forwarded.headers.authorization, undefined); assert.equal(forwarded.headers.cookie, undefined);
  assert.equal(forwarded.redirect, 'error'); assert.equal(res.headers['Cache-Control'], 'no-store');
});
test('rejects unknown routes, methods, cross-origin posts, missing trusted IP and oversized requests', async () => {
  const opts = { env, fetcher: () => { throw Error('must not fetch'); } };
  assert.equal((await call(request('arbitrary'), opts)).code, 404);
  assert.equal((await call(request('chat', { method: 'GET' }), opts)).code, 405);
  assert.equal((await call(request('chat', { headers: { origin: 'https://other.example' } }), opts)).code, 403);
  assert.equal((await call(request('chat', { headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.2' } }), opts)).code, 503);
  assert.equal((await call(request('chat', { body: 'a'.repeat(16001) }), opts)).code, 413);
});
test('upstream failures are sanitized and rate limit stays actionable', async () => {
  for (const status of [401, 402, 500]) {
    const res = await call(request('chat'), { env, fetcher: async () => Response.json({ secret: 'do-not-leak' }, { status }) });
    assert.equal(res.code, 503); assert.ok(!JSON.stringify(res.body).includes('do-not-leak'));
  }
  const limited = await call(request('chat'), { env, fetcher: async () => Response.json({}, { status: 429 }) });
  assert.equal(limited.code, 429); assert.equal(limited.headers['Retry-After'], '3600');
  const unavailable = await call(request(), { env, fetcher: async () => { throw Error('private host details'); } });
  assert.equal(unavailable.body.available, false); assert.ok(!JSON.stringify(unavailable.body).includes('private host'));
  assert.match(unavailable.body.reason, /^Common Compute is temporarily unavailable\./);
});
test('does not present partial errored generations as success', async () => {
  const result = await call(request('chat'), { env, fetcher: async () => Response.json({ choices: [{ message: { content: 'partial' }, finish_reason: 'error' }] }) });
  assert.equal(result.code, 503);
});
test('swarm routes precede generic game API proxy and paid model routes are unchanged', () => {
  const { rewrites } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.ok(rewrites.findIndex(r => r.source === '/api/swarm') < rewrites.findIndex(r => r.source === '/api/:path*'));
  assert.equal(rewrites.find(r => r.source === '/swarm-api/chat').destination, '/api/swarm?operation=chat');
  assert.match(rewrites.find(r => r.source === '/v1/:path*').destination, /\/model-relay\//);
});
