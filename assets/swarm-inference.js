// Common Compute: free, opt-in volunteer inference. No paid fallback or persistence.
export const SWARM_MAX_PROMPT_CHARS = 2000;
export const SWARM_MAX_PROMPT_BYTES = 6000;
export const SWARM_MAX_TOKENS = 256;
export const SWARM_REQUEST_TIMEOUT_MS = 95_000;

export function normalizeSwarmStatus(data) {
  if (!data || typeof data !== 'object' || typeof data.available !== 'boolean' || !Number.isSafeInteger(data.workers) || data.workers < 0 || !Array.isArray(data.models)) {
    throw new Error('The coordinator returned an unexpected status. Refresh to try again.');
  }
  const models = [...new Set(data.models.filter((model) => typeof model?.id === 'string' && model.id.trim() && model.id.length <= 200).map((model) => model.id))];
  const available = data.available && data.workers > 0 && models.length > 0;
  const reason = typeof data.reason === 'string' ? data.reason.slice(0, 300) : '';
  const requestsPerHour = Number.isSafeInteger(data.limits?.requests_per_hour) && data.limits.requests_per_hour > 0 ? data.limits.requests_per_hour : null;
  const maxTokens = Number.isSafeInteger(data.limits?.max_tokens) && data.limits.max_tokens > 0 ? Math.min(SWARM_MAX_TOKENS, data.limits.max_tokens) : SWARM_MAX_TOKENS;
  return { available, models, workers: data.workers, reason, requestsPerHour, maxTokens };
}

export function validateSwarmPrompt(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) return 'Write a prompt before generating.';
  if (prompt.length > SWARM_MAX_PROMPT_CHARS) return 'Keep your prompt to 2,000 characters or fewer.';
  if (new TextEncoder().encode(prompt).byteLength > SWARM_MAX_PROMPT_BYTES) return 'This prompt exceeds 6,000 UTF-8 bytes. Please shorten it.';
  return '';
}

export function makeSwarmPayload({ prompt, model, consent, status }) {
  if (!status?.available || !status.models.includes(model)) throw new Error('No capacity is available for this model. Refresh capacity before trying again.');
  if (consent !== true) throw new Error('Acknowledge the volunteer-machine privacy notice before sending.');
  const validation = validateSwarmPrompt(prompt);
  if (validation) throw new Error(validation);
  return { model, messages: [{ role: 'user', content: prompt.trim() }], max_tokens: status.maxTokens || SWARM_MAX_TOKENS, stream: false };
}

async function withSwarmTimeout(timeoutMs, run) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await run(controller.signal); } finally { clearTimeout(timer); }
}

export async function fetchSwarmStatus(fetchImpl = globalThis.fetch) {
  return withSwarmTimeout(10_000, async (signal) => {
    const response = await fetchImpl('/swarm-api/status', { signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('The coordinator is unavailable. Refresh capacity to try again.');
    return normalizeSwarmStatus(await response.json());
  });
}

export async function requestSwarmCompletion(payload, fetchImpl = globalThis.fetch, timeoutMs = SWARM_REQUEST_TIMEOUT_MS) {
  try {
    return await withSwarmTimeout(timeoutMs, async (signal) => {
      const response = await fetchImpl('/swarm-api/chat', {
        method: 'POST', signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) {
        if (response.status === 429) return { ok: false, unavailable: false, message: 'The free request limit has been reached or Common Compute is busy. Please wait before trying again.' };
        if ([502, 503, 504].includes(response.status)) return { ok: false, unavailable: true, message: 'Volunteer capacity is unavailable or the worker did not respond. Refresh capacity before trying again.' };
        if (response.status === 400 || response.status === 413 || response.status === 422) return { ok: false, unavailable: false, message: 'The request was not accepted. Check the model and shorten your prompt, then try again.' };
        return { ok: false, unavailable: false, message: 'The request could not be completed. Please try again later.' };
      }
      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) return { ok: false, unavailable: false, message: 'The worker returned no usable text. You can try another prompt.' };
      return { ok: true, content, truncated: body.choices[0].finish_reason === 'length' };
    });
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return { ok: false, unavailable: true, message: 'The request timed out. The worker may still be processing it. Nothing was retried automatically; refresh capacity before retrying.' };
    return { ok: false, unavailable: true, message: 'The response could not be received. The request may have reached a volunteer. Nothing was retried automatically; refresh capacity before retrying.' };
  }
}

export function mountSwarmInference(root) {
  if (!root) return;
  const find = (name) => root.querySelector(`[data-${name}]`);
  const form = find('prompt-form');
  const prompt = find('prompt');
  const model = find('model');
  const consent = find('consent');
  const generate = find('generate');
  const refresh = find('refresh');
  const clear = find('clear');
  const responsePane = find('response-pane');
  let status = null;
  let checking = false;
  let generating = false;

  function updateControls() {
    const validation = prompt.value ? validateSwarmPrompt(prompt.value) : '';
    find('prompt-count').textContent = `${prompt.value.length.toLocaleString('en-US')} / 2,000`;
    find('input-error').textContent = validation;
    prompt.setAttribute('aria-invalid', validation ? 'true' : 'false');
    generate.disabled = generating || checking || !status?.available || !status.models.includes(model.value) || !consent.checked || Boolean(validateSwarmPrompt(prompt.value));
    refresh.disabled = generating || checking;
    clear.disabled = generating;
    model.disabled = generating || checking || !status?.available;
    prompt.disabled = generating;
    consent.disabled = generating;
  }

  function setCapacity(available, title, description) {
    find('capacity-state').dataset.capacityState = available ? 'available' : 'offline';
    find('capacity-title').textContent = title;
    find('capacity-description').textContent = description;
    find('availability-note').textContent = description;
  }

  async function refreshCapacity() {
    if (checking || generating) return;
    checking = true;
    status = null;
    const previousModel = model.value;
    find('capacity-state').dataset.capacityState = 'checking';
    find('capacity-title').textContent = 'Checking capacity';
    find('capacity-description').textContent = 'Contacting the coordinator. No prompts are sent during this check.';
    find('availability-note').textContent = 'Checking whether volunteer capacity is available…';
    find('worker-count').textContent = '—';
    find('model-count').textContent = '—';
    model.replaceChildren(new Option('Checking available models…', ''));
    updateControls();
    try {
      status = await fetchSwarmStatus();
      find('worker-count').textContent = String(status.workers);
      find('model-count').textContent = String(status.models.length);
      model.replaceChildren(...(status.available ? status.models.map((id) => new Option(id, id)) : [new Option('No model currently available', '')]));
      if (status.available && status.models.includes(previousModel)) model.value = previousModel;
      const description = status.available
        ? 'Volunteer capacity is available. It can change at any time; short requests help keep Common Compute shared.'
        : status.reason || 'No volunteer inference capacity is available right now. The preview is waiting for contributors. Refresh later or request an invitation below.';
      setCapacity(status.available, status.available ? 'Ready when you are' : 'Waiting for capacity', description);
      find('limits').textContent = `Responses are capped at ${status.maxTokens} tokens.${status.requestsPerHour ? ` Limit: ${status.requestsPerHour} requests per hour.` : ' Capacity and request limits may apply.'}`;
      find('last-checked').textContent = `Checked ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      model.replaceChildren(new Option('Coordinator unavailable', ''));
      setCapacity(false, 'Coordinator unavailable', 'We could not check volunteer capacity. No inference is available until the coordinator responds. Refresh to try again.');
      find('last-checked').textContent = 'Capacity not verified';
    } finally {
      checking = false;
      updateControls();
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (checking || generating) return;
    let payload;
    try { payload = makeSwarmPayload({ prompt: prompt.value, model: model.value, consent: consent.checked, status }); }
    catch (error) { find('input-error').textContent = error.message; return; }
    generating = true;
    responsePane.setAttribute('aria-busy', 'true');
    find('response-empty').hidden = true;
    find('response-text').hidden = true;
    find('response-text').textContent = '';
    find('response-label').textContent = 'GENERATING';
    find('request-status').textContent = 'Waiting for a volunteer worker. This can take up to 95 seconds. Please keep this tab open.';
    generate.textContent = 'Generating…';
    updateControls();
    const result = await requestSwarmCompletion(payload);
    generating = false;
    responsePane.setAttribute('aria-busy', 'false');
    generate.textContent = 'Generate ↗';
    if (result.ok) {
      find('response-text').textContent = result.content;
      find('response-text').hidden = false;
      find('response-label').textContent = 'COMPLETE';
      find('request-status').textContent = result.truncated ? 'Response received. The output token limit was reached.' : 'Response received from Common Compute.';
    } else {
      find('response-label').textContent = 'NOT COMPLETED';
      find('request-status').textContent = result.message;
      if (result.unavailable) {
        status = null;
        model.replaceChildren(new Option('Refresh to check capacity', ''));
        find('worker-count').textContent = '—';
        find('model-count').textContent = '—';
        find('last-checked').textContent = 'Capacity needs a refresh';
        setCapacity(false, 'Capacity needs a refresh', 'The last request did not complete. Refresh to check whether volunteer capacity is available before retrying.');
      }
    }
    updateControls();
  });
  prompt.addEventListener('input', updateControls);
  consent.addEventListener('change', updateControls);
  model.addEventListener('change', updateControls);
  refresh.addEventListener('click', refreshCapacity);
  clear.addEventListener('click', () => {
    if (generating) return;
    prompt.value = '';
    consent.checked = false;
    find('response-text').textContent = '';
    find('response-text').hidden = true;
    find('response-empty').hidden = false;
    find('response-label').textContent = 'NOT STARTED';
    find('request-status').textContent = '';
    updateControls();
    prompt.focus();
  });
  return refreshCapacity();
}

if (typeof document !== 'undefined') mountSwarmInference(document.querySelector('[data-swarm-inference]'));
