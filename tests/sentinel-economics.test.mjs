import test from 'node:test';import assert from 'node:assert/strict';import {estimateCosts} from '../assets/sentinel-economics.js';
const base={decisions:100000,baseline:.006,sentinel:.0002,fallback:.2,repair:.05,repairCost:.02,fixed:0};
test('illustrative estimate includes fees, fallbacks and extra repair',()=>{const r=estimateCosts(base);assert.equal(r.original,600);assert.equal(r.routed,240);assert.equal(r.saved,360);assert.equal(r.savingsPercent,60);});
test('negative savings remain visible when fallback and overhead dominate',()=>{const r=estimateCosts({...base,fallback:1,fixed:100});assert.ok(r.saved<0);assert.ok(r.savingsPercent<0);});
test('zero volume and invalid inputs do not produce fictional savings',()=>{assert.equal(estimateCosts({...base,decisions:0}).savingsPercent,null);for(const patch of [{fallback:1.1},{repair:-.1},{baseline:NaN},{decisions:Infinity}])assert.throws(()=>estimateCosts({...base,...patch}));});
