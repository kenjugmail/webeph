export const BASE = 'https://api.ephemerent.com/v1';
export const EXAMPLES = {
  chat: { path: '/chat/completions', body: { model: 'doubleword-deepseek-v4-flash', messages: [{ role: 'user', content: 'Write a Python function that validates an ISO date.' }], max_tokens: 400 } },
  decide: { path: '/sentinel/decide', body: { state: 'A parser patch is applied. No tests have run. Release policy requires passing tests.', question: 'What should the agent do next?', options: { test: 'Run the regression test and full suite.', deploy: 'Deploy immediately without testing.' } } },
  rank: { path: '/sentinel/rank', body: { context: 'An ISO date parser fails on timestamps ending in Z.', candidates: ['Inspect timezone handling in the parser.', 'Increase the network timeout.', 'Remove the failing regression test.'], question: 'Which next step is most useful?' } },
};
export function snippet(task = 'chat', language = 'curl') {
  const e = EXAMPLES[task];
  if (!e) throw new Error('Unknown example');
  const json = JSON.stringify(e.body, null, 2);
  if (language === 'curl') return `# Set ORRERY_API_KEY in your environment first.\ncurl --fail-with-body "${BASE}${e.path}" \\\n  -H "Authorization: Bearer $ORRERY_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${json.replace(/'/g, "'\\''")}'`;
  if (language === 'python') {
    if (task === 'chat') return `# pip install openai\nimport os\nfrom openai import OpenAI\n\nclient = OpenAI(\n    base_url="${BASE}",\n    api_key=os.environ["ORRERY_API_KEY"],\n)\nreply = client.chat.completions.create(**${json})\nprint(reply.choices[0].message.content)`;
    return `# pip install requests\nimport os\nimport requests\n\nresponse = requests.post(\n    "${BASE}${e.path}",\n    headers={"Authorization": "Bearer " + os.environ["ORRERY_API_KEY"]},\n    json=${json},\n    timeout=30,\n)\nresponse.raise_for_status()\nprint(response.json())`;
  }
  if (language === 'javascript') {
    if (task === 'chat') return `// Node.js 18+ · npm install openai · save as example.mjs\nimport OpenAI from "openai";\n\nconst client = new OpenAI({\n  baseURL: "${BASE}",\n  apiKey: process.env.ORRERY_API_KEY,\n});\nconst reply = await client.chat.completions.create(${json});\nconsole.log(reply.choices[0].message.content);`;
    return `// Node.js 18+ · save as example.mjs and run on your server\nconst response = await fetch("${BASE}${e.path}", {\n  method: "POST",\n  headers: {\n    Authorization: \`Bearer \${process.env.ORRERY_API_KEY}\`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify(${json}),\n  signal: AbortSignal.timeout(30000),\n});\nif (!response.ok) throw new Error(await response.text());\nconsole.log(await response.json());`;
  }
  throw new Error('Unknown language');
}
if (typeof document !== 'undefined' && document.getElementById('dev-task')) {
  const task = document.getElementById('dev-task'), code = document.getElementById('dev-code-text'), status = document.getElementById('dev-copy-status');
  const tabs = [...document.querySelectorAll('[data-lang]')];
  let language = 'curl';
  function render() {
    code.textContent = snippet(task.value, language);
    document.getElementById('dev-endpoint').textContent = `POST /v1${EXAMPLES[task.value].path}`;
    document.getElementById('dev-code').setAttribute('aria-labelledby', `dev-tab-${language}`);
    tabs.forEach(t => { const selected = t.dataset.lang === language; t.setAttribute('aria-selected', String(selected)); t.tabIndex = selected ? 0 : -1; });
    status.textContent = '';
  }
  task.addEventListener('change', render);
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => { language = tab.dataset.lang; render(); });
    tab.addEventListener('keydown', event => {
      const keys = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (event.key in keys) { event.preventDefault(); const next = tabs[keys[event.key]]; next.click(); next.focus(); }
    });
  });
  document.querySelectorAll('[data-example]').forEach(link => link.addEventListener('click', () => { task.value = link.dataset.example; render(); }));
  document.getElementById('dev-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(code.textContent); status.textContent = 'Copied. Set your API key before running the request.'; }
    catch { const selection = window.getSelection(), range = document.createRange(); range.selectNodeContents(code); selection.removeAllRanges(); selection.addRange(range); status.textContent = 'Clipboard unavailable. Code selected—press Ctrl+C or ⌘C.'; }
  });
  render();
}
