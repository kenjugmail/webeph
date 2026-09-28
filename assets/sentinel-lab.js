import { liveDecision, sameInputs, validateResult } from './sentinel-lab-core.js';
const $ = id => document.getElementById(id);
let scenarios = [], recordings = {}, selected = 0, busy = false, current = null;
const history = [], completed = new Set();
const modeName = mode => ({recorded:'Recorded example',hosted:'Live Orrery API',local:'Live local Sentinel',public:'Live public demo'}[mode]);
function elem(tag, text, className) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if(className) e.className = className; return e; }
function note(text) { $('status').textContent = text; }
function source() { const mode = $('mode').value; $('mode-badge').textContent = modeName(mode); $('mode-badge').classList.toggle('live', mode !== 'recorded'); $('key-label').hidden = mode !== 'hosted'; }
function inputs() { return {state:$('context').value.trim(),question:$('question').value.trim(),options:Object.fromEntries([...$('options').querySelectorAll('input')].map(el => [el.dataset.key,el.value.trim()]))}; }
function validateInputs(body) { if (!body.state || !body.question || Object.values(body.options).some(v=>!v)) throw new Error('Fill in the context, question, and every candidate action.'); if(new Set(Object.values(body.options)).size !== Object.keys(body.options).length) throw new Error('Give each candidate a distinct description.'); }
function setBusy(value) {
  busy = value;
  for (const id of ['run','reset','restart','mode','next','apply','api-key']) $(id).disabled = value;
  for (const el of document.querySelectorAll('.scenario')) el.disabled = value;
  for (const el of [$('context'),$('question'),...$('options').querySelectorAll('input')]) el.readOnly = value || ['recorded','public'].includes($('mode').value);
  $('run').textContent = value ? 'Scoring options…' : $('mode').value === 'recorded' ? 'Play recorded decision ↗' : 'Score the options ↗';
}
function select(index) {
  if (busy) return;
  selected = index; current = null;
  const s = scenarios[index];
  $('scenario-title').textContent = s.headline; $('scenario-category').textContent = s.category;
  $('context').value = s.state; $('question').value = s.question;
  $('options').replaceChildren(...Object.entries(s.options).map(([k,v]) => {
    const row=elem('div',undefined,'option-editor'), label=elem('label',k,'option-key'), input=elem('input');
    input.id=`option-${k}`; label.htmlFor=input.id; input.dataset.key=k; input.value=v; input.maxLength=500; row.append(label,input); return row;
  }));
  document.querySelectorAll('.scenario').forEach((el,i)=>{el.classList.toggle('active',i===index);el.setAttribute('aria-pressed',String(i===index));});
  $('results').hidden=true; $('result-empty').hidden=false; $('outcome').hidden=true;
  $('result-source').textContent='AWAITING REQUEST'; note(''); source(); setBusy(false);
  $('input-note').textContent=$('mode').value==='recorded'?'Recorded mode uses the exact inputs shown here. Connect live inference to try your own.':$('mode').value==='public'?'Live inference on fixed examples. Shared demo capacity is limited; use your API key for your own inputs.':'Edit the context or actions to challenge the model. Changed inputs are scored live; preset simulation outcomes are disabled.';
}
function render(entry) {
  const result=entry.response;
  $('results').hidden=false; $('result-empty').hidden=true;
  $('result-source').textContent=entry.source==='recorded'?'RECORDED RESPONSE':'LIVE RESPONSE';
  $('winner').textContent=result.answer; $('winner-description').textContent=entry.request.options[result.answer];
  $('bars').replaceChildren(...Object.entries(result.p).sort((a,b)=>b[1]-a[1]).map(([key,score])=>{
    const row=elem('div',undefined,'score-row'), label=elem('div',undefined,'score-label'), track=elem('div',undefined,'score-track'),fill=elem('div',undefined,'score-fill');
    label.append(elem('span',key),elem('span',`${(score*100).toFixed(1)}%`)); fill.style.width=`${score*100}%`; track.append(fill); row.append(label,track);return row;
  }));
  $('latency').textContent=`${(entry.latencyMs/1000).toFixed(2)} s`;
  $('latency-label').textContent=entry.source==='recorded'?'Original measured round trip':'Measured round trip';
  $('option-count').textContent=String(Object.keys(result.p).length);
  $('apply').hidden=!entry.preset; $('apply').textContent=selected===3?'Compare with reference label →':'Apply in simulation →';
  $('download').disabled=false;
  $('history').replaceChildren(...history.slice().reverse().slice(0,20).map(h=>{
    const li=elem('li');li.append(elem('strong',h.response.answer),elem('span',`${h.title} · ${modeName(h.source)}`),elem('span',`${(h.latencyMs/1000).toFixed(2)}s`));return li;
  }));
}
$('run').addEventListener('click',async()=>{
  if(busy)return;
  const s=scenarios[selected], mode=$('mode').value, body=inputs();
  current=null;$('results').hidden=true;$('result-empty').hidden=false;$('outcome').hidden=true;
  try{
    validateInputs(body);setBusy(true);note(mode==='recorded'?'Loading the recorded model response…':'Sending this decision to Sentinel…');
    const started=performance.now();let response, latencyMs, recordedAt;
    if(mode==='recorded'){
      if(!sameInputs(body,s))throw new Error('Reset the inputs to play this recording, or choose a live connection.');
      const recording=recordings[s.id];if(!recording)throw new Error('No recording exists for this scenario. Use live inference.');
      response=validateResult(recording.response,body.options);latencyMs=recording.latencyMs;recordedAt=recording.recordedAt;
    }else{response=await liveDecision(mode,body,$('api-key').value,fetch,s.id);latencyMs=performance.now()-started;}
    current={source:mode,scenario:s.id,title:s.title,request:body,response,latencyMs,preset:sameInputs(body,s),at:new Date().toISOString(),...(recordedAt?{recordedAt}:{})};
    history.push(current);render(current);note(mode==='recorded'?`Recorded ${new Date(recordedAt).toLocaleDateString()}. No live request was made.`:'Live model response received. Inspect the scores before applying the action.');
  }catch(error){note(error.name==='TimeoutError'?'The request timed out. No recorded response was substituted.':error.message||'Connection failed. Try again or explicitly choose recorded mode.');$('result-source').textContent='REQUEST FAILED';}
  finally{setBusy(false);}
});
$('apply').addEventListener('click',()=>{
  if(!current||!current.preset||busy)return;
  const s=scenarios[selected],correct=current.response.answer===s.expected;
  $('outcome').hidden=false;$('outcome-text').textContent=correct?s.outcome:s.wrongOutcome;
  $('outcome-metric').textContent=correct?s.metric:'Review required';$('outcome-label').textContent=selected===3?'REFERENCE CHECK':s.metricLabel.toUpperCase();
  if(correct&&selected<3)completed.add(s.id);
  for(const el of $('mission-steps').children)el.classList.toggle('done',completed.has(el.dataset.step));
  $('mission-summary').textContent=`${completed.size} / 3 checkpoints completed`;
  $('next').hidden=!(correct&&selected<2); $('apply').disabled=true;
});
$('next').addEventListener('click',()=>select(Math.min(selected+1,2)));
$('reset').addEventListener('click',()=>select(selected));
$('restart').addEventListener('click',()=>{completed.clear();for(const e of $('mission-steps').children)e.classList.remove('done');$('mission-summary').textContent='Restore → repair → verify';select(0);});
$('mode').addEventListener('change',()=>select(selected));
for(const container of [$('context'),$('question'),$('options')]) container.addEventListener('input',()=>{
  if(busy)return;
  current=null; $('results').hidden=true; $('result-empty').hidden=false; $('outcome').hidden=true;
  $('result-source').textContent='INPUTS CHANGED'; note('Run the decision again to score the updated inputs.');
});
$('connection-toggle').addEventListener('click',()=>{const el=$('connection-panel');el.hidden=!el.hidden;$('connection-toggle').setAttribute('aria-expanded',String(!el.hidden));});
$('present').addEventListener('click',()=>{document.body.classList.toggle('presenting');$('present').textContent=document.body.classList.contains('presenting')?'Exit presentation ⤡':'Present ⤢';});
$('download').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({schema:'sentinel-demo-receipt-v1',scope:'Illustrative synthetic scenarios, not a general quality benchmark. Simulation outcomes are authored, not actual executed tools.',decisions:history},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=elem('a');a.href=url;a.download='sentinel-decision-receipt.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
async function init(){
  try{
    const [s,r]=await Promise.all([fetch('/assets/sentinel-scenarios.json').then(r=>{if(!r.ok)throw new Error('Scenarios unavailable');return r.json();}),fetch('/assets/sentinel-recordings.json').then(r=>r.ok?r.json():{recordings:{}})]);
    scenarios=s.scenarios;recordings=r.recordings||{};
    $('scenario-list').replaceChildren(...scenarios.map((s,i)=>{const b=elem('button',undefined,'scenario');b.append(elem('span',String(i+1).padStart(2,'0')),elem('strong',s.title));b.addEventListener('click',()=>select(i));return b;}));
    if(['127.0.0.1','localhost'].includes(location.hostname)){
      try{const r=await fetch('/__sentinel/status',{signal:AbortSignal.timeout(3000)});const h=await r.json();if(h.localDemo===true&&h.ok){$('mode').querySelector('[value="local"]').disabled=false;$('mode').value='local';}}catch{}
    }
    select(0);
  }catch{note('The demo could not load. Refresh the page or check the connection.');}
}
init();
