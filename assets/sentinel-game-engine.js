export function newGame(seed=1){
  const s={seed,rng:seed>>>0,tick:0,bird:{x:100,y:240,vy:0,radius:10},pipes:[],score:0,alive:true,width:480,height:480};
  for(let i=0;i<3;i++) s.pipes.push(makePipe(s,400+i*220));
  return s;
}
export function step(state,action,frames=6){
  if(!Number.isInteger(frames)||frames<1||frames>12) throw new Error('frames must be integer 1..12');
  if(action!=='flap'&&action!=='coast') throw new Error('action must be flap or coast');
  const s=structuredClone(state);
  if(!s.alive) return s;
  if(action==='flap') s.bird.vy=-4.5;
  for(let f=0;f<frames;f++){
    s.bird.vy+=0.25; s.bird.y+=s.bird.vy; s.tick++;
    for(const p of s.pipes) p.x-=2.2;
    if(s.pipes[0].x+54<0){ s.pipes.shift(); s.pipes.push(makePipe(s,s.pipes[s.pipes.length-1].x+220)); }
    for(const p of s.pipes){
      if(!p.passed && p.x+54<=s.bird.x-s.bird.radius){ p.passed=true; s.score++; }
    }
    if(collide(s)) s.alive=false;
    if(!s.alive) break;
  }
  return s;
}
export function observe(state){
  const b=state.bird;
  const np=state.pipes.find(p=>p.x+54>=b.x-b.radius)||state.pipes[0];
  return {tick:state.tick,y:b.y,vy:b.vy,score:state.score,alive:state.alive,nextPipe:{distance:np.x-b.x,gapTop:np.gapY-80,gapBottom:np.gapY+80,gapCenter:np.gapY}};
}
function makePipe(s,x){
  const gapY=140+199*lcg(s);
  return {x,width:54,gapY,gapSize:160,passed:false};
}
function lcg(s){ s.rng=(s.rng*1664525+1013904223)>>>0; return s.rng/4294967296; }
function collide(s){
  const b=s.bird;
  if(b.y-b.radius<=0||b.y+b.radius>=s.height) return true;
  for(const p of s.pipes){
    if(b.x+b.radius>=p.x&&b.x-b.radius<=p.x+p.width){
      if(b.y-b.radius<=p.gapY-80||b.y+b.radius>=p.gapY+80) return true;
    }
  }
  return false;
}
