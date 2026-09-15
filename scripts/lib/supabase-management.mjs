import { execFileSync } from 'node:child_process';
export const PROJECT_REF = 'wjjthkqwcyahamhjkeux';
function token() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  if (process.platform === 'darwin') {
    for (const account of ['supabase', 'access-token']) {
      try {
        let value = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-a', account, '-w'], {stdio:['ignore','pipe','ignore']}).toString().trim();
        if (value.startsWith('go-keyring-base64:')) value = Buffer.from(value.slice(18), 'base64').toString();
        if (value.startsWith('sbp_')) return value;
      } catch { /* Try the legacy CLI profile. */ }
    }
  }
  throw new Error('Sign in to the Supabase CLI or set SUPABASE_ACCESS_TOKEN locally.');
}
export async function management(path, {method='GET',body}={}) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}${path}`, {method, headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'}, ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
  if(!r.ok) throw new Error(`Supabase management request failed (${r.status})`);
  const content=await r.text();
  return content ? JSON.parse(content) : null;
}
export const readQuery = query => management('/database/query/read-only', {method:'POST',body:{query}});
