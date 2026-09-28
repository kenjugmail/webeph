import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {newGame,step} from '../assets/sentinel-game-engine.js';
const data=JSON.parse(readFileSync(new URL('../assets/sentinel-game-runs.json',import.meta.url)));
test('published engine is the exact Arbiter repair artifact',()=>{const hash=createHash('sha256').update(readFileSync(new URL('../assets/sentinel-game-engine.js',import.meta.url))).digest('hex');assert.equal(hash,data.build.engineSha256);assert.equal(data.build.model,'arbiter-flash-27b');});
test('every recorded action reproduces its actual physics result',()=>{
 for(const [mode,episodes]of Object.entries(data.runs))for(const e of episodes){let s=newGame(e.seed);for(const d of e.decisions){assert.deepEqual(s,d.before);s=step(s,d.action,12);assert.deepEqual(s,d.after);assert.ok(Number.isFinite(d.latencyMs)&&d.latencyMs>=0);if(mode.startsWith('sentinel'))assert.ok(d.probabilities);}assert.equal(s.score,e.score);assert.equal(s.tick,e.ticks);}
});
test('recorded failures are retained and distinguished from scripted success',()=>{assert.deepEqual(data.runs['sentinel-raw'].map(e=>e.score),[0,0,0]);assert.deepEqual(data.runs['sentinel-lookahead'].map(e=>e.score),[0,0,0]);assert.deepEqual(data.runs.heuristic.map(e=>e.score),[5,1,5]);});
