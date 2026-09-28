import {newGame,step} from './sentinel-game-engine.js';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
let data,state=newGame(7),running=false,runToken=0,count=0,flap=false,playerFrame=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function draw(){
  const s=state;ctx.clearRect(0,0,480,480);ctx.fillStyle='#101f1b';ctx.fillRect(0,0,480,480);
  ctx.strokeStyle='#23392e';ctx.lineWidth=1;
  for(let x=0;x<=480;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,480);ctx.stroke();}
  for(let y=0;y<=480;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(480,y);ctx.stroke();}
  ctx.fillStyle='#294b3d';for(const p of s.pipes){ctx.fillRect(p.x,0,p.width,p.gapY-p.gapSize/2);ctx.fillRect(p.x,p.gapY+p.gapSize/2,p.width,480);ctx.fillStyle='#83a78d';ctx.fillRect(p.x-3,p.gapY-p.gapSize/2-8,p.width+6,8);ctx.fillRect(p.x-3,p.gapY+p.gapSize/2,p.width+6,8);ctx.fillStyle='#294b3d';}
  ctx.save();ctx.translate(s.bird.x,s.bird.y);ctx.rotate(Math.max(-.4,Math.min(.7,s.bird.vy*.09)));ctx.shadowColor='#d4ed95';ctx.shadowBlur=16;ctx.fillStyle=s.alive?'#d4ed95':'#e6a28a';ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#203525';ctx.beginPath();ctx.arc(4,-3,2,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.strokeStyle='#6b846e';ctx.strokeRect(.5,.5,479,479);
  ctx.fillStyle='#a3afa5';ctx.font='10px monospace';ctx.fillText(`FRAME ${String(s.tick).padStart(4,'0')}`,18,25);ctx.textAlign='right';ctx.fillText(`PIPES ${s.score}`,462,25);ctx.textAlign='left';
  if(!s.alive){ctx.fillStyle='#101513bb';ctx.fillRect(0,190,480,90);ctx.fillStyle='#eff1e7';ctx.textAlign='center';ctx.font='24px sans-serif';ctx.fillText('Run ended',240,225);ctx.font='12px sans-serif';ctx.fillText(`${s.score} pipes passed · inspect the decision trail`,240,251);ctx.textAlign='left';}
  $('score').textContent=s.score;$('decisions').textContent=count;
}
function reset(){runToken++;running=false;cancelAnimationFrame(playerFrame);state=newGame(Number($('seed').value));count=0;flap=false;const mode=$('controller').value;$('seed-label').textContent=$('seed').value;$('game-source').textContent=mode==='human'?'Human-controlled game':mode.startsWith('sentinel')?'Recorded Sentinel trial':'Recorded scripted baseline';$('start').textContent=mode==='human'?'Start playing ↗':mode.startsWith('sentinel')?'Watch Sentinel ↗':'Watch baseline ↗';$('start').disabled=!data;$('flap').disabled=mode!=='human';$('action').textContent='—';$('decision-latency').textContent='—';$('action-bars').replaceChildren();$('game-status').textContent=mode==='human'?'Press Start, then Space or tap Flap.':mode.startsWith('sentinel')?'Recorded model actions, including mistakes. No scripted rescue or substituted choices.':'This is a scripted baseline, not a model controlling the game.';$('mode-explanation').textContent=mode==='human'?'You control the bird directly. The game engine was generated and repaired by Arbiter.':mode==='sentinel-lookahead'?'Recorded Sentinel choices with exact simulator forecasts supplied for each action. The forecasts are not a learned world model.':mode==='sentinel-raw'?'Recorded Sentinel choices from observed numerical state. Physics pauses during each recorded inference interval, then advances 12 frames. This is not live inference.':'A separately labeled scripted policy for comparison. Zero model inference calls.';draw();}
async function play(){
  if(running)return;running=true;$('start').disabled=true;const token=++runToken,mode=$('controller').value;
  if(mode==='human'){
    canvas.tabIndex=0;canvas.focus();
    let last=performance.now(),acc=0;
    function frame(now){if(token!==runToken)return;acc+=Math.min(now-last,100);last=now;while(acc>=1000/60&&state.alive){state=step(state,flap?'flap':'coast',1);if(flap)count++;flap=false;acc-=1000/60;}draw();if(state.alive)playerFrame=requestAnimationFrame(frame);else{running=false;$('game-status').textContent=`Your run ended with ${state.score} pipes. Reset to try again.`;}}
    $('game-status').textContent='You are playing. Space or tap to flap.';playerFrame=requestAnimationFrame(frame);return;
  }
  const episode=data.runs[mode].find(e=>e.seed===Number($('seed').value));
  for(const d of episode.decisions){
    if(token!==runToken)return;
    $('game-status').textContent=mode.startsWith('sentinel')?'Replaying recorded inference interval…':'Scripted controller selecting an action…';
    await sleep(d.latencyMs);if(token!==runToken)return;
    $('action').textContent=d.action;$('decision-latency').textContent=d.latencyMs?`${(d.latencyMs/1000).toFixed(2)} s`:'No model';count++;
    $('action-bars').replaceChildren();
    for(const [name,p] of Object.entries(d.probabilities||{})){
      const row=document.createElement('div');row.className='score-row';const label=document.createElement('div');label.className='score-label';label.textContent=`${name} · ${(p*100).toFixed(1)}%`;const track=document.createElement('div');track.className='score-track';const fill=document.createElement('div');fill.className='score-fill';fill.style.width=`${p*100}%`;track.append(fill);row.append(label,track);$('action-bars').append(row);
    }
    $('game-status').textContent=`Recorded action: ${d.action}. Advancing game physics.`;
    for(let f=0;f<12&&state.alive;f++){if(token!==runToken)return;state=step(state,f===0?d.action:'coast',1);draw();await sleep(1000/60);}
    state=structuredClone(d.after);draw();
  }
  if(token!==runToken)return;running=false;$('game-status').textContent=`Recorded run ended: ${episode.score} pipes, ${episode.ticks} frames, ${episode.endedBecause}. Reset or choose another controller.`;
}
$('start').onclick=play;$('reset-game').onclick=reset;$('controller').onchange=reset;$('seed').onchange=reset;$('flap').onclick=()=>{if($('controller').value==='human')flap=true;};canvas.addEventListener('pointerdown',()=>{if($('controller').value==='human')flap=true;});document.addEventListener('keydown',e=>{if(e.code==='Space'&&$('controller').value==='human'&&running&&!['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)){e.preventDefault();flap=true;}});
fetch('/assets/sentinel-game-runs.json').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(d=>{data=d;$('build-time').textContent=`${d.build.initialSeconds.toFixed(1)}s initial + ${d.build.repairSeconds.toFixed(1)}s repair`;reset();}).catch(()=>{$('game-status').textContent='Trial evidence could not load. Refresh to retry.';});draw();
