#!/usr/bin/env node
import readline from 'node:readline';
import {
  encryptItchKeyUrl,
  itchKeyFingerprint,
} from '../supabase/functions/_shared/genesis-fall-core.mjs';

const encryptionSecret = process.env.GENESIS_KEY_ENCRYPTION_KEY;
const format = process.argv.includes('--format=csv') ? 'csv' : 'jsonl';
if (!encryptionSecret) {
  process.stderr.write('GENESIS_KEY_ENCRYPTION_KEY is required. No keys were processed.\n');
  process.exitCode = 2;
} else {
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  let count = 0;
  if (format === 'csv') process.stdout.write('key_ciphertext,key_fingerprint\n');
  for await (const line of input) {
    const url = line.trim();
    if (!url) continue;
    const record = {
      key_ciphertext: await encryptItchKeyUrl(url, encryptionSecret),
      key_fingerprint: await itchKeyFingerprint(url, encryptionSecret),
    };
    process.stdout.write(format === 'csv'
      ? `${record.key_ciphertext},${record.key_fingerprint}\n`
      : `${JSON.stringify(record)}\n`);
    count += 1;
  }
  process.stderr.write(`Encrypted ${count} ownership link(s); plaintext was not written to stdout.\n`);
}
