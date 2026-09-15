import{execFileSync}from'node:child_process';import{existsSync,readFileSync,unlinkSync}from'node:fs';import{management}from'./lib/supabase-management.mjs';
await management('/secrets',{method:'POST',body:[{name:'COMPANION_ROLLOUT',value:'off'},{name:'COMPANION_INTERNAL_USERS',value:''}]});
const file='output/audit/companion-fixtures.json';if(existsSync(file)){
 const rows=JSON.parse(readFileSync(file));const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref','wjjthkqwcyahamhjkeux','-o','json'],{stdio:['ignore','pipe','ignore']}));const key=keys.find(x=>x.name==='service_role').api_key;
 for(const row of rows){if(!row.session?.user?.email?.startsWith('companion-audit-'))throw Error('Refusing to delete non-fixture account');const r=await fetch(`https://wjjthkqwcyahamhjkeux.supabase.co/auth/v1/admin/users/${row.id}`,{method:'DELETE',headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw Error('Fixture cleanup failed');}unlinkSync(file);
}
console.log('Companion rollout disabled; temporary test identities removed.');
