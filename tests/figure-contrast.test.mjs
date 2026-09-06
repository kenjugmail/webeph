import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import test from 'node:test';

test('figure audit uses local panels and still rejects unreadable labels', async () => {
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(`<svg width="700" height="400" viewBox="0 0 700 400">
      <rect width="700" height="400" fill="#111111"/>
      <text x="20" y="40" fill="#eeeeee" font-size="16">Light on dark</text>
      <g transform="translate(200 100)">
        <rect width="300" height="150" fill="#eeeeee"/>
        <text x="20" y="50" fill="${request.url === '/bad' ? '#eeeeee' : '#111111'}" font-size="16">Panel label</text>
      </g>
    </svg>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const run = (page) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/check-figure.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, BASE: base, PAGES: page, LOOKS: 'light' },
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
  try {
    const valid = await run('/valid');
    assert.equal(valid.code, 0, valid.output);
    const invalid = await run('/bad');
    assert.equal(invalid.code, 1, invalid.output);
    assert.match(invalid.output, /Panel label/);
    assert.match(invalid.output, /1\.00:1/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
