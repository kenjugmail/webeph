import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

// This proxy never knows a provider/billing API key. The coordinator owns the
// sponsored account and enforces durable fair-use quotas before dispatch.
export const config = { maxDuration: 100 };
const offline = { available: false, workers: 0, models: [], reason: 'Common Compute is being prepared. Free inference is not live yet.' };
const fail = (message, code = 'swarm_unavailable') => ({ error: { message, code } });

export function gatewayConfig(env) {
  if (!env.SWARM_GATEWAY_URL || !env.SWARM_PROXY_TOKEN || env.SWARM_PROXY_TOKEN.length < 32) return null;
  try {
    const url = new URL(env.SWARM_GATEWAY_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (!/^\/[a-zA-Z0-9/_-]*$/.test(url.pathname)) return null;
    return { base: `${url.origin}${url.pathname.replace(/\/$/, '')}`, token: env.SWARM_PROXY_TOKEN };
  } catch { return null; }
}

export function createHandler({ env = process.env, fetcher = fetch } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const operation = req.query?.operation;
    if (!['status', 'chat'].includes(operation)) return res.status(404).json(fail('Unknown Common Compute endpoint.', 'not_found'));
    const method = operation === 'status' ? 'GET' : 'POST';
    if (req.method !== method) { res.setHeader('Allow', method); return res.status(405).json(fail('Method not allowed.', 'method_not_allowed')); }
    const settings = gatewayConfig(env);
    if (!settings) return operation === 'status' ? res.status(200).json(offline) : res.status(503).json(fail(offline.reason));
    const headers = { 'x-swarm-proxy-token': settings.token };
    let body;
    if (operation === 'chat') {
      const origin = req.headers.origin;
      if (origin && !['https://ephemerent.com', 'https://www.ephemerent.com'].includes(origin)) return res.status(403).json(fail('Use the Common Compute page on ephemerent.com.', 'invalid_origin'));
      if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return res.status(415).json(fail('Send application/json.', 'invalid_request'));
      // Only the platform-owned IP header is trusted; client-supplied identity
      // and forwarding headers are never passed through to the coordinator.
      const ip = req.headers['x-vercel-forwarded-for'];
      if (typeof ip !== 'string' || !isIP(ip)) return res.status(503).json(fail('Fair-use client identification is unavailable.'));
      headers['x-swarm-client'] = createHmac('sha256', settings.token).update(ip).digest('hex');
      headers['content-type'] = 'application/json';
      try { body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body); } catch { body = ''; }
      if (!body || Buffer.byteLength(body) > 16000) return res.status(413).json(fail('Request too large or empty.', 'invalid_request'));
    }
    try {
      const upstream = await fetcher(`${settings.base}/public/swarm/${operation}`, {
        method, headers, body, redirect: 'error', signal: AbortSignal.timeout(operation === 'status' ? 5000 : 90000),
      });
      // Do not forward response headers, internal auth errors or HTML failures.
      if (!upstream.headers.get('content-type')?.includes('application/json')) throw new Error('Invalid upstream response');
      const text = await upstream.text();
      if (Buffer.byteLength(text) > 65536) throw new Error('Oversized response');
      const data = JSON.parse(text);
      if (operation === 'status') {
        if (!upstream.ok || typeof data.available !== 'boolean' || !Array.isArray(data.models)) throw new Error('Invalid status');
        return res.status(200).json({ available: data.available, workers: Number.isSafeInteger(data.workers) ? data.workers : 0,
          models: data.models.filter(m => typeof m?.id === 'string').map(m => ({ id: m.id })),
          reason: typeof data.reason === 'string' ? data.reason : '', limits: data.limits });
      }
      if (!upstream.ok) {
        if (upstream.status === 429) { res.setHeader('Retry-After', '3600'); return res.status(429).json(fail('Free capacity limit reached. Please retry later.', 'rate_limited')); }
        if ([400, 413, 422].includes(upstream.status)) return res.status(400).json(fail('Check the model, prompt length and request format.', 'invalid_request'));
        return res.status(503).json(fail('Volunteer capacity is unavailable. Please retry later.'));
      }
      const choice = data.choices?.[0];
      if (typeof choice?.message?.content !== 'string' || choice.finish_reason === 'error') throw new Error('Incomplete generation');
      return res.status(200).json({ model: data.model, choices: [{ message: { role: 'assistant', content: choice.message.content }, finish_reason: choice.finish_reason }] });
    } catch {
      return operation === 'status'
        ? res.status(200).json({ ...offline, reason: 'Common Compute is temporarily unavailable. Please retry later.' })
        : res.status(503).json(fail('Common Compute did not finish the request. Please retry later.'));
    }
  };
}

export default createHandler();
