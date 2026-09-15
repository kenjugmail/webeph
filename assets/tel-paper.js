(() => {
  'use strict';
  document.documentElement.classList.add('jr-js');
  const toggle=document.querySelector('.jr-menu-button');
  const navigation=document.getElementById('tel-navigation');
  function closeMenu(){toggle?.setAttribute('aria-expanded','false');navigation?.setAttribute('data-open','false');}
  toggle?.addEventListener('click',()=>{
    const open=toggle.getAttribute('aria-expanded')!=='true';
    toggle.setAttribute('aria-expanded',String(open));navigation?.setAttribute('data-open',String(open));
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  navigation?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
  const rail=document.querySelector('.tel-rail details');
  if(rail&&window.matchMedia('(max-width:760px)').matches)rail.open=false;
  const progress=document.querySelector('[data-tel-progress]');
  let scheduled=false;
  function update(){
    scheduled=false;const extent=document.documentElement.scrollHeight-window.innerHeight;
    if(progress)progress.style.transform=`scaleX(${Math.max(0,Math.min(1,window.scrollY/Math.max(1,extent)))})`;
  }
  window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}},{passive:true});
  window.addEventListener('resize',update);update();
  const links=[...document.querySelectorAll('.tel-rail a[href^="#"]')];
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){
      links.forEach(link=>{if(link.hash===`#${entry.target.id}`)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
    }
  },{rootMargin:'-8% 0px -72% 0px'});
  document.querySelectorAll('[data-tel-section]').forEach(section=>observer.observe(section));
  const copy=document.querySelector('[data-tel-copy]');
  const status=document.querySelector('[data-tel-copy-status]');
  copy?.addEventListener('click',async()=>{
    try{
      const record=JSON.parse(document.getElementById('tel-citation').textContent);
      await navigator.clipboard.writeText(record.citation);status.textContent='Citation copied.';
    }catch{status.textContent='Copy is unavailable here. The title, author, version, and canonical URL are shown on this page.';}
  });
})();
