import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateResult, sameInputs, liveDecision } from '../assets/sentinel-lab-core.js';
const {scenarios} = JSON.parse(readFileSync(new URL('../assets/sentinel-scenarios.json',import.meta.url)));
const {recordings} = JSON.parse(readFileSync(new URL('../assets/sentinel-recordings.json',import.meta.url)));
test('all examples have real recordings, including the classification failure',()=>{
  for(const s of scenarios) assert.ok(validateResult(recordings[s.id].response,s.options));
  const challenge=scenarios.find(s=>s.id==='classify');
  assert.notEqual(recordings.classify.response.answer,challenge.expected);
});
test('modified inputs cannot inherit preset outcomes',()=>{
  const s=scenarios[0];assert.equal(sameInputs(s,s),true);assert.equal(sameInputs({...s,state:'changed'},s),false);
  assert.equal(sameInputs({...s,options:{...s.options,wait:'changed'}},s),false);
});
test('malformed distributions and unknown answers are rejected',()=>{
  const opts={a:'one',b:'two'};
  for(const raw of [{answer:'c',p:{a:1,b:0}},{answer:'a',p:{a:NaN,b:0}},{answer:'a',p:{a:.1,b:.2}},{answer:'a',p:{a:.1,b:.9}},{answer:'a',p:{a:1}}])assert.throws(()=>validateResult(raw,opts));
});
test('public mode sends only scenario id, never user key or text',async()=>{
  let sent;
  await liveDecision('public',scenarios[0],'never-send',async(url,init)=>{sent={url,init};return {ok:true,json:async()=>recordings.restore.response};},'restore');
  assert.equal(sent.url,'https://sentinel.ephemerent.com/v1/demo/decide');
  assert.deepEqual(JSON.parse(sent.init.body),{scenario:'restore'});assert.equal(sent.init.headers.Authorization,undefined);
});
test('hosted auth and failures never silently substitute recordings',async()=>{
  await assert.rejects(liveDecision('hosted',scenarios[0],''),/key/);
  let calls=0;
  await assert.rejects(liveDecision('hosted',scenarios[0],'test',async(_url,init)=>{calls++;assert.equal(init.headers.Authorization,'Bearer test');return {ok:false,status:503};}),/unavailable/);
  assert.equal(calls,1);
});
