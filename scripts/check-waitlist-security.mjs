import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const config=readFileSync('assets/site-config.js','utf8');
const url=config.match(/CLOUD_AUTH_URL: '([^']+)/)[1];
const anon=config.match(/CLOUD_AUTH_KEY: '([^']+)/)[1];
const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref','wjjthkqwcyahamhjkeux','-o','json'],{stdio:['ignore','pipe','ignore']}).toString());
const service=keys.find(k=>k.name==='service_role').api_key;
const adminHeaders={apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'};
const email=`waitlist-security-${randomUUID()}@example.com`;
const submission={name:'Automated verification',company:'Ephemerent verification',email,company_size:'1–10',timeline:'Just exploring',pilot:'No',problem:'=1+1',interests:['Internal company knowledge assistant'],consent:true};
const rpc=(name,args,headers=adminHeaders)=>fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(args)});
const edge=(data,origin='https://ephemerent.com')=>fetch(`${url}/functions/v1/company-waitlist`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json',Origin:origin},body:JSON.stringify({submission:data})});
let userId;
try {
 const password=randomUUID()+randomUUID();
 const created=await fetch(url+'/auth/v1/admin/users',{method:'POST',headers:adminHeaders,body:JSON.stringify({email,password,email_confirm:true})});
 assert.equal(created.status,200,'test identity creation');userId=(await created.json()).id;
 const login=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 assert.equal(login.status,200);const token=(await login.json()).access_token;
 for(const headers of [{apikey:anon,'Content-Type':'application/json'},{apikey:anon,Authorization:`Bearer ${token}`,'Content-Type':'application/json'}]) {
  for(const table of ['company_waitlist','company_waitlist_inbox','company_waitlist_quota']){
   const response=await fetch(`${url}/rest/v1/${table}?select=*`,{headers});assert([401,403].includes(response.status),`${table} private`);
  }
  for(const [method,body] of [['POST',JSON.stringify({email,name:'test',company:'test',details:{}})],['PATCH',JSON.stringify({name:'changed'})],['DELETE',undefined]]){
   const response=await fetch(`${url}/rest/v1/company_waitlist?email=eq.${encodeURIComponent(email)}`,{method,headers,body});assert([401,403].includes(response.status),`${method} denied`);
  }
  assert([401,403].includes((await rpc('join_company_waitlist',{submission},headers)).status),'direct write RPC denied');
  assert([401,403].includes((await rpc('consume_company_waitlist_quota',{email_hash:'a'.repeat(64)},headers)).status),'quota RPC denied');
 }
 console.log('Anonymous and ordinary signed-in access denied for tables, view, writes and private RPCs.');
 for(const invalid of [{consent:'true'},{company:' '},{interests:['Unexpected option']},{timeline:'invalid'},{problem:'x'.repeat(3001)},{website:'javascript:alert(1)'},{extra:'not allowed'},{name:{nested:true}}]){
  const response=await rpc('join_company_waitlist',{submission:{...submission,...invalid}});assert.equal(response.status,400,'invalid payload denied');
 }
 assert.equal((await edge(submission,'https://example.com')).status,403);
 assert.equal((await edge({...submission,notes:'x'.repeat(17000)})).status,413);
 for(let i=0;i<5;i++) assert.equal((await edge(submission)).status,200,`accepted attempt ${i+1}`);
 assert.equal((await edge(submission)).status,429,'sixth attempt limited');
 const read=await fetch(`${url}/rest/v1/company_waitlist_inbox?email=eq.${encodeURIComponent(email)}`,{headers:adminHeaders});assert.equal(read.status,200);
 const rows=await read.json();assert.equal(rows.length,1);assert.equal(rows[0].problem,"'=1+1");assert.equal(rows[0].consent,'true');
 console.log('Server validation, origin rejection, size limit, live writes, duplicate handling, private inbox, CSV formula escaping, and rate limit passed.');
} finally {
 const removed=await fetch(`${url}/rest/v1/company_waitlist?email=eq.${encodeURIComponent(email)}`,{method:'DELETE',headers:adminHeaders});assert.equal(removed.status,204);
 if(userId){const removedUser=await fetch(`${url}/auth/v1/admin/users/${userId}`,{method:'DELETE',headers:adminHeaders});assert.equal(removedUser.status,200);}
 console.log('Test signup and temporary identity removed.');
}
