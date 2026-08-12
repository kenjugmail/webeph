(() => {
  const body = document.body;
  if (!body) return;
  body.classList.add('js');

  const menuButton = document.querySelector('.nw-menu-button');
  const navigation = document.getElementById('news-navigation');
  const closeMenu = ({ restoreFocus = false } = {}) => {
    if (!menuButton || !navigation) return;
    const wasOpen = navigation.getAttribute('data-open') === 'true';
    navigation.removeAttribute('data-open');
    menuButton.setAttribute('aria-expanded', 'false');
    if (restoreFocus && wasOpen) menuButton.focus();
  };

  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const open = navigation.getAttribute('data-open') === 'true';
      if (open) closeMenu();
      else {
        navigation.setAttribute('data-open', 'true');
        menuButton.setAttribute('aria-expanded', 'true');
      }
    });
    navigation.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu({ restoreFocus: true });
    });
    document.addEventListener('pointerdown', (event) => {
      if (navigation.getAttribute('data-open') !== 'true') return;
      if (!navigation.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
    });
    addEventListener('resize', () => {
      if (innerWidth > 640) closeMenu();
    });
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const alignHashTarget = () => {
    if (!location.hash) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  addEventListener('hashchange', alignHashTarget);
  if (location.hash) {
    const fontsReady = document.fonts?.ready || Promise.resolve();
    fontsReady.then(() => {
      requestAnimationFrame(alignHashTarget);
      setTimeout(alignHashTarget, 900);
    });
  }

  const reveals = [...document.querySelectorAll('[data-reveal]')];
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((element) => element.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((element) => revealObserver.observe(element));
  }

  const progress = document.querySelector('[data-reading-progress]');
  const article = document.getElementById('article');
  if (progress && article && !reducedMotion) {
    let ticking = false;
    const updateProgress = () => {
      const rect = article.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const distance = Math.max(1, article.offsetHeight - window.innerHeight);
      const amount = Math.min(1, Math.max(0, (window.scrollY - start) / distance));
      progress.style.transform = `scaleX(${amount})`;
      ticking = false;
    };
    const requestProgress = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateProgress);
    };
    updateProgress();
    addEventListener('scroll', requestProgress, { passive: true });
    addEventListener('resize', requestProgress);
  }

  const toc = document.querySelector('[data-article-toc]');
  const sections = [...document.querySelectorAll('[data-article-section][id]')];
  if (toc && sections.length && 'IntersectionObserver' in window) {
    const links = new Map([...toc.querySelectorAll('a[href^="#"]')].map((link) => [link.hash.slice(1), link]));
    const visible = new Map();
    const updateCurrent = () => {
      const candidates = sections
        .filter((section) => visible.get(section.id))
        .sort((a, b) => Math.abs(a.getBoundingClientRect().top - 120) - Math.abs(b.getBoundingClientRect().top - 120));
      const passed = sections.filter((section) => section.getBoundingClientRect().top < 180);
      const current = candidates[0] || passed[passed.length - 1] || sections[0];
      links.forEach((link, id) => {
        if (id === current.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => visible.set(entry.target.id, entry.isIntersecting));
      updateCurrent();
    }, { rootMargin: '-15% 0px -68% 0px', threshold: 0 });
    sections.forEach((section) => sectionObserver.observe(section));
    updateCurrent();
  }

  const branchFigure = document.querySelector('[data-branch-diagram]');
  if (branchFigure) {
    const buttons = [...branchFigure.querySelectorAll('[data-branch]')];
    const nodes = [...branchFigure.querySelectorAll('[data-branch-node]')];
    const note = branchFigure.querySelector('[data-branch-note] p');
    const notes = {
      fragile: 'Robust refitting helps the fragile subset, but it cannot synthesize the activation direction that average-weighted selection removed.',
      stable: 'Worst-environment selection keeps the stable activation direction available; the same robust refit can now use it to lower the worst-case risk.',
    };
    const selectBranch = (name) => {
      buttons.forEach((button) => {
        const active = button.dataset.branch === name;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      nodes.forEach((node) => node.classList.toggle('is-active', node.dataset.branchNode === name));
      if (note) note.textContent = notes[name] || '';
    };
    buttons.forEach((button) => button.addEventListener('click', () => selectBranch(button.dataset.branch)));
    selectBranch(buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.branch || 'fragile');
  }

  const riskLab = document.querySelector('[data-risk-lab]');
  if (riskLab) {
    const buttons = [...riskLab.querySelectorAll('[data-risk-mode]')];
    const label = riskLab.querySelector('[data-risk-label]');
    const value = riskLab.querySelector('[data-risk-value]');
    const note = riskLab.querySelector('[data-risk-note]');
    const states = {
      average: {
        label: 'Prevalence-weighted score',
        value: '0.07',
        note: 'The frequent rooms dominate the mixture, so a serious code failure can look small in the overall grade.',
      },
      worst: {
        label: 'Worst-environment score',
        value: '0.42',
        note: 'Code now sets the repair target. Its small prevalence no longer discounts the behavior that was lost there.',
      },
    };
    const selectRisk = (mode) => {
      const state = states[mode] || states.average;
      riskLab.classList.toggle('is-average', mode === 'average');
      riskLab.classList.toggle('is-worst', mode === 'worst');
      buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.riskMode === mode)));
      if (label) label.textContent = state.label;
      if (value) value.textContent = state.value;
      if (note) note.textContent = state.note;
    };
    buttons.forEach((button) => button.addEventListener('click', () => selectRisk(button.dataset.riskMode)));
    selectRisk(buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.riskMode || 'average');
  }

  const operatorLab = document.querySelector('[data-operator-lab]');
  if (operatorLab) {
    const buttons = [...operatorLab.querySelectorAll('[data-operator-env]')];
    const planes = [...operatorLab.querySelectorAll('[data-operator-plane]')];
    const title = operatorLab.querySelector('[data-operator-title]');
    const note = operatorLab.querySelector('[data-operator-note]');
    const environments = {
      prose: {
        title: 'Common prose',
        note: 'Frequent activation makes this sheet easy to see in an average calibration sample.',
      },
      dialogue: {
        title: 'Dialogue',
        note: 'A different activation tape scales the same outgoing write into a different contribution sheet.',
      },
      code: {
        title: 'Code · rare spike',
        note: 'Most rows are quiet, but one strong activation writes a direction that can still be irreplaceable.',
      },
    };
    const selectEnvironment = (name) => {
      const environment = environments[name] || environments.prose;
      buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.operatorEnv === name)));
      planes.forEach((plane) => plane.classList.toggle('is-active', plane.dataset.operatorPlane === name));
      if (title) title.textContent = environment.title;
      if (note) note.textContent = environment.note;
    };
    buttons.forEach((button) => button.addEventListener('click', () => selectEnvironment(button.dataset.operatorEnv)));
    selectEnvironment(buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.operatorEnv || 'prose');
  }

  const copyButton = document.querySelector('[data-copy-link]');
  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        copyButton.textContent = 'Link copied';
        setTimeout(() => { copyButton.textContent = 'Copy link'; }, 1800);
      } catch {
        copyButton.textContent = 'Copy unavailable';
      }
    });
  }
})();
