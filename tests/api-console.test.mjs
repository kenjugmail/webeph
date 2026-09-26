import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { agentPrompt, apiSnippets, API_EXAMPLES, creditRows, creditsToUsd, firstCallSnippet, formatUsd, keyLimitState, runTestRequest, summarizeTestReply, weekStats } from '../assets/api-console.js';

test('credits are millionths of a dollar and small spend never shows as $0.00', () => {
  assert.equal(creditsToUsd(14_000_000), 14);
  assert.equal(formatUsd(creditsToUsd(12_400_000)), '$12.40');
  assert.equal(formatUsd(creditsToUsd(3_000)), '<$0.01');
  assert.equal(formatUsd(0), '$0.00');
});

test('every example is valid JSON in curl, and the first call exports the key only when we have it', () => {
  for (const example of API_EXAMPLES) {
    const { curl, typescript, python } = apiSnippets(example.id);
    // The curl body must survive the shell: run it through sh and parse what curl would receive.
    const body = curl.slice(curl.indexOf("-d '") + 3);
    const received = execFileSync('sh', ['-c', `printf '%s' ${body}`], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(received), example.body);
    assert.match(typescript, /process\.env\.ARBITER_API_KEY/);
    assert.match(python, /os\.environ\["ARBITER_API_KEY"\]/);
    assert.doesNotMatch(python, /: (true|false|null)\b/);
  }
  assert.match(firstCallSnippet('ork_live_abc'), /^export ARBITER_API_KEY=ork_live_abc\n/);
  assert.match(firstCallSnippet(undefined), /^export ARBITER_API_KEY=<your key>\n/);
});

test('the agent prompt carries the base URL, docs and key-handling rules', () => {
  const prompt = agentPrompt('ork_live_abc');
  for (const part of ['https://api.ephemerent.com/v1', 'arbiter-flash-27b', 'https://ephemerent.com/developers', 'ork_live_abc', 'ARBITER_API_KEY', 'Never commit the key']) assert.ok(prompt.includes(part), part);
  assert.ok(agentPrompt(undefined).includes('<paste your key>'));
});

test('week stats count only the last 7 days and flag a capped receipt window', () => {
  const now = Date.parse('2026-09-26T12:00:00Z');
  const at = (days) => new Date(now - days * 86_400_000).toISOString();
  const stats = weekStats([{ created_at: at(1), settled_credits: 2_000 }, { created_at: at(3), settled_credits: 500 }, { created_at: at(9), settled_credits: 9_999 }], now);
  assert.deepEqual({ count: stats.count, credits: stats.credits, capped: stats.capped }, { count: 2, credits: 2_500, capped: false });
  const full = Array.from({ length: 100 }, () => ({ created_at: at(0.5), settled_credits: 1 }));
  assert.equal(weekStats(full, now).capped, true);
  assert.equal(weekStats(undefined, now).count, 0);
});

test('credit rows list active pools and the purchased wallet', () => {
  const rows = creditRows({ pools: [{ poolId: 'arbiter-runpod', quotaCredits: 14_000_000, usedCredits: 4_000_000 }, { poolId: 'doubleword', quotaCredits: 0, usedCredits: 0 }], purchasedCredits: 10_000_000 });
  assert.deepEqual(rows.map((row) => [row.type, row.remaining, row.expires]), [['Arbiter 27B monthly pool', 10_000_000, 'Resets monthly'], ['Purchased credits', 10_000_000, 'Never']]);
  assert.deepEqual(creditRows(undefined).map((row) => row.type), ['Purchased credits']);
});

test('plan limits: Pro has one key, so the first-visit key fills it', () => {
  assert.deepEqual(keyLimitState(1, 'pro', { keyCount: 1, requestsPerMinute: 30, tokensPerMinute: 100_000 }), { atLimit: true, summary: 'Pro: 1 key · 30 requests/min · 100K tokens/min per key' });
  assert.equal(keyLimitState(2, 'max', { keyCount: 5, requestsPerMinute: 120, tokensPerMinute: 500_000 }).atLimit, false);
  assert.deepEqual(keyLimitState(0, undefined, undefined), { atLimit: false, summary: '' });
});

test('a test reply shows the answer or tool call, who served it, and plain errors', () => {
  const headers = new Map([['x-orrery-model', 'arbiter-flash-27b'], ['x-orrery-provider', 'arbiter'], ['x-orrery-fallback-product', 'doubleword-deepseek-v4-flash']]);
  const ok = summarizeTestReply({ choices: [{ message: { content: '42' } }], usage: { prompt_tokens: 20, completion_tokens: 5 } }, headers, 200, 812.4);
  assert.deepEqual({ ok: ok.ok, text: ok.text, model: ok.model, fallback: ok.fallback, tokens: ok.tokens, ms: ok.ms }, { ok: true, text: '42', model: 'arbiter-flash-27b', fallback: 'doubleword-deepseek-v4-flash', tokens: { input: 20, output: 5 }, ms: 812 });
  const tool = summarizeTestReply({ choices: [{ message: { content: null, tool_calls: [{ function: { name: 'get_forecast', arguments: '{"city":"Tokyo"}' } }] } }] }, new Map(), 200, 10);
  assert.deepEqual(tool.toolCalls, ['get_forecast({"city":"Tokyo"})']);
  assert.match(summarizeTestReply({ error: { message: 'bad key' } }, new Map(), 401, 5).error, /not accepted/);
  assert.match(summarizeTestReply({ error: { message: 'Monthly pool exhausted' } }, new Map(), 429, 5).error, /used up/);
});

test('the test request sends the example with the key, and a network failure reads plainly', async () => {
  let sent;
  const fakeFetch = async (url, init) => { sent = { url, init }; return { status: 200, headers: new Map(), json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }; };
  const result = await runTestRequest('ork_live_abc', 'rule', fakeFetch);
  assert.equal(result.ok, true);
  assert.equal(sent.url, 'https://api.ephemerent.com/v1/chat/completions');
  assert.equal(sent.init.headers.authorization, 'Bearer ork_live_abc');
  assert.equal(JSON.parse(sent.init.body).model, 'arbiter-flash-27b');
  const offline = await runTestRequest('k', 'rule', async () => { throw new TypeError('Failed to fetch'); });
  assert.match(offline.error, /did not reach the API/);
});
