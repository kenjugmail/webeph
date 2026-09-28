import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {EXAMPLES,snippet} from '../assets/orrery-developers.js';
test('every published task has shell-safe JSON and syntactically valid Python and JavaScript',()=>{
 for(const [task,e] of Object.entries(EXAMPLES)){
  const curl=snippet(task,'curl');
  const body=curl.slice(curl.indexOf("-d '")+3);
  assert.deepEqual(JSON.parse(execFileSync('sh',['-c',`printf %s ${body}`],{encoding:'utf8'})),e.body);
  execFileSync('python3',['-c','import ast,sys; ast.parse(sys.stdin.read())'],{input:snippet(task,'python')});
  execFileSync(process.execPath,['--input-type=module','--check'],{input:snippet(task,'javascript')});
 }
});
test('downloaded examples match the interactive quickstart',()=>{
 const download=JSON.parse(readFileSync(new URL('../assets/orrery-api-examples.json',import.meta.url)));
 assert.deepEqual(download.examples,EXAMPLES);
 assert.throws(()=>snippet('missing'));
});
