export function validateResult(raw, options) {
  const names = Object.keys(options);
  if (!raw || typeof raw.answer !== 'string' || !names.includes(raw.answer) || !raw.p || typeof raw.p !== 'object') throw new Error('The model returned an incomplete decision.');
  if (Object.keys(raw.p).length !== names.length || !names.every(k => Number.isFinite(raw.p[k]) && raw.p[k] >= 0 && raw.p[k] <= 1)) throw new Error('The model returned invalid scores.');
  const sum = names.reduce((s, k) => s + raw.p[k], 0);
  if (Math.abs(sum - 1) > .02) throw new Error('The model returned an invalid score distribution.');
  const ranked = names.map(k => [k, raw.p[k]]).sort((a,b) => b[1] - a[1]);
  if (raw.p[raw.answer] < ranked[0][1]) throw new Error('The model choice and ranking disagree.');
  return { answer: raw.answer, p: Object.fromEntries(names.map(k => [k, raw.p[k]])), model: typeof raw.model === 'string' ? raw.model : 'sentinel-1' };
}

export function sameInputs(body, scenario) {
  return body.state === scenario.state && body.question === scenario.question && JSON.stringify(body.options) === JSON.stringify(scenario.options);
}

export async function liveDecision(mode, body, key, fetchImpl = fetch, scenario) {
  if (!['hosted','local','public'].includes(mode)) throw new Error('Choose a live connection first.');
  if (mode === 'hosted' && !key.trim()) throw new Error('Enter your Orrery API key in Connection settings.');
  const response = await fetchImpl(mode === 'public' ? 'https://sentinel.ephemerent.com/v1/demo/decide' : mode === 'hosted' ? 'https://api.ephemerent.com/v1/sentinel/decide' : '/__sentinel/decide', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
    headers: {'Content-Type': 'application/json', ...(mode === 'hosted' ? {Authorization: `Bearer ${key.trim()}`} : {})},
    body: JSON.stringify(mode === 'public' ? {scenario} : body),
  });
  const errors = {400:'Check the context, question, and candidate actions.',401:'API key not accepted. Check your Orrery credentials.',402:'Your account needs available API credits.',403:'This key does not have access to Sentinel.',429:'Rate or usage limit reached. Retry later.',503:'Sentinel is unavailable or busy. Try again shortly.'};
  if (!response.ok) throw new Error(errors[response.status] || `The request failed (HTTP ${response.status}).`);
  return validateResult(await response.json(), body.options);
}
