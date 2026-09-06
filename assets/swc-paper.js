(() => {
  const paper = document.querySelector('.swc-paper');
  if (!paper) return;
  const progress = document.querySelector('[data-swc-progress]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (progress && !reduced) {
    let queued = false;
    const update = () => {
      const start = paper.offsetTop;
      const distance = Math.max(1, paper.offsetHeight - innerHeight);
      progress.style.transform = `scaleX(${Math.max(0, Math.min(1, (scrollY - start) / distance))})`;
      queued = false;
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    update();
  }

  const sections = [...document.querySelectorAll('[data-swc-section][id]')];
  const links = new Map([...document.querySelectorAll('[data-swc-toc] a[href^="#"]')].map((link) => [link.hash.slice(1), link]));
  if (!sections.length || !links.size || !('IntersectionObserver' in window)) return;
  const visible = new Set();
  const choose = () => {
    const candidates = sections.filter((section) => visible.has(section.id));
    const passed = sections.filter((section) => section.getBoundingClientRect().top < 160);
    const current = candidates[0] || passed.at(-1) || sections[0];
    links.forEach((link, id) => id === current.id ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current'));
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.isIntersecting ? visible.add(entry.target.id) : visible.delete(entry.target.id));
    choose();
  }, { rootMargin: '-12% 0px -75% 0px' });
  sections.forEach((section) => observer.observe(section));
  choose();
})();
