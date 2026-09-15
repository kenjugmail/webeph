import {readFileSync} from 'node:fs';
import {basename} from 'node:path';
import {management} from './lib/supabase-management.mjs';
const path=process.argv[2];
if(!path||process.argv[3]!=='--apply')throw new Error('Usage: node scripts/apply-reviewed-migration.mjs supabase/migrations/TIMESTAMP_name.sql --apply');
const match=/^(\d{14})_([a-z0-9_]+)\.sql$/.exec(basename(path));
if(!match)throw new Error('A timestamped migration is required');
const sql=readFileSync(path,'utf8');
const [ ,version,name]=match;
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const prior=await management('/database/query/read-only',{method:'POST',body:{query:`select version from supabase_migrations.schema_migrations where version=${literal(version)}`}});
if(prior.length){console.log(`Migration ${version} already recorded.`);process.exit(0);}
await management('/database/query',{method:'POST',body:{query:`begin; set local lock_timeout='5s'; set local statement_timeout='30s';\n${sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${literal(version)},${literal(name)},array[${literal(sql)}]); commit;`}});
console.log(`Applied and recorded migration ${version}.`);
