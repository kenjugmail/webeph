export function estimateCosts({decisions,baseline,sentinel,fallback,repair,repairCost,fixed}){
  const values=[decisions,baseline,sentinel,fallback,repair,repairCost,fixed];
  if(values.some(v=>!Number.isFinite(v)||v<0)||fallback>1||repair>1)throw new Error('Enter non-negative values; percentages must be between 0 and 100.');
  const original=decisions*baseline,decisionFees=decisions*sentinel,fallbackFees=decisions*fallback*baseline,repairFees=decisions*repair*repairCost;
  const routed=decisionFees+fallbackFees+repairFees+fixed;
  return {original,routed,saved:original-routed,savingsPercent:original>0?100*(original-routed)/original:null,decisionFees,fallbackFees,repairFees,fixed,avoidedCalls:decisions*(1-fallback),breakEvenFallback:decisions*baseline>0?(original-decisionFees-repairFees-fixed)/(decisions*baseline):null};
}
function init(){
  const form=document.getElementById('cost-form');if(!form)return;
  const money=v=>v.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
  function update(){
    try{
      const val=id=>{const s=document.getElementById(id).value;if(s==='')throw new Error('Complete every assumption.');return Number(s);};
      const r=estimateCosts({decisions:val('cost-volume'),baseline:val('cost-baseline'),sentinel:val('cost-sentinel'),fallback:val('cost-fallback')/100,repair:val('cost-repair')/100,repairCost:val('cost-repair-price'),fixed:val('cost-fixed')});
      document.getElementById('cost-before').textContent=money(r.original);document.getElementById('cost-after').textContent=money(r.routed);document.getElementById('cost-saved').textContent=money(r.saved);document.getElementById('cost-percent').textContent=r.savingsPercent===null?'No baseline spend':`${r.savingsPercent.toFixed(1)}% ${r.saved>=0?'estimated reduction':'estimated increase'}`.replace(/^-/,'');
      document.getElementById('cost-breakdown').textContent=`Decision fees ${money(r.decisionFees)} + fallback calls ${money(r.fallbackFees)} + additional repairs ${money(r.repairFees)} + fixed overhead ${money(r.fixed)}.`;
      document.getElementById('cost-result').classList.toggle('over-budget',r.saved<0);document.getElementById('cost-error').textContent='';
    }catch(e){document.getElementById('cost-error').textContent=e.message;for(const id of ['cost-before','cost-after','cost-saved','cost-percent'])document.getElementById(id).textContent='—';document.getElementById('cost-breakdown').textContent='';}
  }
  form.addEventListener('input',update);form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('reset',()=>queueMicrotask(update));update();
}
if(typeof document!=='undefined')init();
