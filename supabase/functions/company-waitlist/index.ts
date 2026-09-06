const allowedOrigins = new Set(['https://ephemerent.com', 'https://www.ephemerent.com']);
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', ...(allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) };
  const reply = (status: number, error?: string) => new Response(JSON.stringify(error ? { error } : { ok: true }), { status, headers });
  if (!allowedOrigins.has(origin)) return reply(403, 'Origin not allowed');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, 'Method not allowed');
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, 'JSON required');
  // Enforce the actual streamed size, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return reply(400, 'Invalid submission');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 16000) { await reader.cancel(); return reply(413, 'Submission too large'); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return reply(400, 'Invalid submission'); }
    if (!body || typeof body !== 'object' || !body.submission || typeof body.submission.email !== 'string') return reply(400, 'Invalid submission');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const api = Deno.env.get('SUPABASE_URL')!;
    const rpc = async (name: string, args: unknown) => fetch(`${api}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(10000) });
    // Email digest is keyed, so the short-lived quota table cannot be used to guess addresses.
    const hmac = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const digest = await crypto.subtle.sign('HMAC', hmac, new TextEncoder().encode(body.submission.email.trim().toLowerCase()));
    const emailHash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
    const quota = await rpc('consume_company_waitlist_quota', { email_hash: emailHash });
    if (!quota.ok) return reply(503, 'Temporarily unavailable');
    if (await quota.json() !== true) return reply(429, 'Too many attempts. Please try later or email kt@ephemerent.com.');
    const result = await rpc('join_company_waitlist', { submission: body.submission });
    if (!result.ok) return reply(result.status >= 500 ? 503 : 400, 'Unable to accept submission');
    return reply(200);
  } catch { return reply(503, 'Temporarily unavailable'); }
});
