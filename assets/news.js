(() => {
  const body = document.body;
  if (!body) return;
  body.classList.add('js');

  const menuButton = document.querySelector('.nw-menu-button');
  const navigation = document.getElementById('news-navigation');
  const pageRegions = [...document.querySelectorAll('main, body > footer')]
    .filter((region) => !region.contains(navigation));
  const menuItems = () => navigation
    ? [...navigation.querySelectorAll('a, button')].filter((item) => item.offsetParent !== null)
    : [];
  const setBackgroundInert = (inert) => pageRegions.forEach((region) => {
    if (inert) region.setAttribute('inert', '');
    else region.removeAttribute('inert');
  });
  const closeMenu = ({ restoreFocus = false } = {}) => {
    if (!menuButton || !navigation) return;
    const wasOpen = navigation.getAttribute('data-open') === 'true';
    navigation.removeAttribute('data-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open menu');
    setBackgroundInert(false);
    if (restoreFocus && wasOpen) menuButton.focus();
  };

  if (menuButton && navigation) {
    menuButton.addEventListener('click', (event) => {
      const open = navigation.getAttribute('data-open') === 'true';
      if (open) closeMenu();
      else {
        navigation.setAttribute('data-open', 'true');
        menuButton.setAttribute('aria-expanded', 'true');
        menuButton.setAttribute('aria-label', 'Close menu');
        setBackgroundInert(true);
        if (event.detail === 0) menuItems()[0]?.focus();
      }
    });
    navigation.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (navigation.getAttribute('data-open') !== 'true') return;
      if (event.key === 'Escape') {
        closeMenu({ restoreFocus: true });
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = [menuButton, ...menuItems()];
      const current = focusables.indexOf(document.activeElement);
      if (event.shiftKey && current <= 0) {
        event.preventDefault();
        focusables[focusables.length - 1]?.focus();
      } else if (!event.shiftKey && current === focusables.length - 1) {
        event.preventDefault();
        menuButton.focus();
      } else if (!event.shiftKey && document.activeElement === menuButton) {
        event.preventDefault();
        focusables[1]?.focus();
      }
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
  const chapterRibbon = document.querySelector('[data-chapter-ribbon]');
  if ((toc || chapterRibbon) && sections.length && 'IntersectionObserver' in window) {
    const links = new Map([...(toc?.querySelectorAll('a[href^="#"]') || [])].map((link) => [link.hash.slice(1), link]));
    const chapterLink = chapterRibbon?.querySelector('[data-chapter-current-link]');
    const chapterIndex = chapterRibbon?.querySelector('[data-chapter-current-index]');
    const chapterProgress = chapterRibbon?.querySelector('[data-chapter-progress]');
    const visible = new Map();
    let activeSection = sections[0];
    let chapterTicking = false;

    const updateChapterProgress = () => {
      chapterTicking = false;
      if (!activeSection || !chapterProgress) return;
      const rect = activeSection.getBoundingClientRect();
      const travel = Math.max(1, rect.height - Math.min(window.innerHeight * 0.34, 280));
      const amount = Math.min(1, Math.max(0, (76 - rect.top) / travel));
      chapterProgress.style.transform = `scaleX(${amount})`;
    };
    const requestChapterProgress = () => {
      if (chapterTicking) return;
      chapterTicking = true;
      requestAnimationFrame(updateChapterProgress);
    };
    const updateCurrent = () => {
      const candidates = sections
        .filter((section) => visible.get(section.id))
        .sort((a, b) => Math.abs(a.getBoundingClientRect().top - 120) - Math.abs(b.getBoundingClientRect().top - 120));
      const passed = sections.filter((section) => section.getBoundingClientRect().top < 180);
      const current = candidates[0] || passed[passed.length - 1] || sections[0];
      activeSection = current;
      links.forEach((link, id) => {
        if (id === current.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      const currentLink = links.get(current.id);
      if (chapterLink) {
        chapterLink.href = `#${current.id}`;
        chapterLink.textContent = currentLink?.textContent?.trim() || current.querySelector('h2')?.textContent?.trim() || current.id;
        chapterLink.setAttribute('aria-current', 'location');
      }
      if (chapterIndex) chapterIndex.textContent = String(sections.indexOf(current) + 1).padStart(2, '0');
      if (chapterRibbon) chapterRibbon.dataset.chapterCurrent = current.id;
      requestChapterProgress();
    };
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => visible.set(entry.target.id, entry.isIntersecting));
      updateCurrent();
    }, { rootMargin: '-15% 0px -68% 0px', threshold: 0 });
    sections.forEach((section) => sectionObserver.observe(section));
    addEventListener('scroll', requestChapterProgress, { passive: true });
    addEventListener('resize', requestChapterProgress);
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
      branchFigure.dataset.branchActive = name;
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
    const modeButtons = [...riskLab.querySelectorAll('[data-risk-mode]')];
    const predictionButtons = [...riskLab.querySelectorAll('[data-risk-predict]')];
    const resetButton = riskLab.querySelector('[data-risk-reset]');
    const predictionNote = riskLab.querySelector('[data-risk-prediction-note]');
    const explorer = riskLab.querySelector('[data-risk-explorer]');
    const prevalenceInput = riskLab.querySelector('[data-risk-prevalence]');
    const prevalenceOutput = riskLab.querySelector('[data-risk-prevalence-output]');
    const scaleLabel = riskLab.querySelector('[data-risk-scale-label]');
    const crossoverMarker = riskLab.querySelector('[data-risk-crossover]');
    const currentMarker = riskLab.querySelector('[data-risk-current]');
    const candidateElements = [...riskLab.querySelectorAll('[data-risk-candidate]')];
    const label = riskLab.querySelector('[data-risk-label]');
    const value = riskLab.querySelector('[data-risk-value]');
    const note = riskLab.querySelector('[data-risk-note]');
    const storageKey = 'ephemerent-news:robust-risk-v1:prediction';
    const candidates = candidateElements.map((element) => ({
      element,
      id: element.dataset.riskCandidate,
      label: element.querySelector('header strong')?.textContent?.trim() || element.dataset.riskCandidate,
      losses: {
        prose: Number(element.dataset.lossProse),
        dialogue: Number(element.dataset.lossDialogue),
        code: Number(element.dataset.lossCode),
      },
    }));
    const formatRisk = (number) => number.toFixed(4);
    const markerPosition = (percent) => `${Math.max(0, Math.min(100, ((percent - 1) / 29) * 100))}%`;
    let mode = 'average';
    let prediction = '';
    try { prediction = sessionStorage.getItem(storageKey) || ''; } catch {}

    const setPrediction = (choice, persist = true) => {
      prediction = choice || '';
      predictionButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.riskPredict === prediction)));
      riskLab.classList.toggle('is-locked', !prediction);
      if (explorer) explorer.inert = !prediction;
      if (resetButton) resetButton.hidden = !prediction;
      if (predictionNote) predictionNote.textContent = prediction
        ? `${candidates.find((candidate) => candidate.id === prediction)?.label || 'Prediction'} recorded locally. The default five-percent result is now revealed.`
        : 'Choose before revealing the default result. Your prediction stays in this browser tab.';
      if (persist) {
        try {
          if (prediction) sessionStorage.setItem(storageKey, prediction);
          else sessionStorage.removeItem(storageKey);
        } catch {}
      }
    };

    const updateRisk = () => {
      const rareShare = Number(prevalenceInput?.value || 5) / 100;
      const shares = {
        prose: (1 - rareShare) * Number(riskLab.dataset.proseSplit || 0.7),
        dialogue: (1 - rareShare) * Number(riskLab.dataset.dialogueSplit || 0.3),
        code: rareShare,
      };
      const states = candidates.map((candidate) => {
        const contributions = Object.fromEntries(Object.entries(candidate.losses).map(([environment, loss]) => [environment, mode === 'average' ? loss * shares[environment] : loss]));
        const score = mode === 'average' ? Object.values(contributions).reduce((sum, item) => sum + item, 0) : Math.max(...Object.values(candidate.losses));
        return { ...candidate, contributions, score };
      });
      const selected = [...states].sort((a, b) => a.score - b.score)[0];
      const maxContribution = Math.max(...states.flatMap((state) => Object.values(state.contributions)), 0.0001);
      states.forEach((state) => {
        state.element.classList.toggle('is-selected', state.id === selected?.id);
        const scoreOutput = state.element.querySelector('[data-risk-score]');
        if (scoreOutput) scoreOutput.textContent = formatRisk(state.score);
        state.element.querySelectorAll('[data-risk-env]').forEach((row) => {
          const environment = row.dataset.riskEnv;
          const share = shares[environment];
          const loss = state.losses[environment];
          const contribution = state.contributions[environment];
          const shareOutput = row.querySelector('[data-risk-share]');
          const lossOutput = row.querySelector('[data-risk-loss]');
          const contributionOutput = row.querySelector('[data-risk-contribution]');
          if (shareOutput) shareOutput.textContent = `${(share * 100).toFixed(1).replace('.0', '')}% prevalence`;
          if (lossOutput) lossOutput.textContent = loss.toFixed(2);
          if (contributionOutput) contributionOutput.textContent = formatRisk(contribution);
          row.style.setProperty('--risk-bar', `${(contribution / maxContribution) * 100}%`);
        });
      });
      if (prevalenceOutput) prevalenceOutput.textContent = `${(rareShare * 100).toFixed(0)}%`;
      if (label) label.textContent = mode === 'average' ? 'Weighted mean selects' : 'Worst room selects';
      if (value) value.textContent = selected?.label || '';
      if (scaleLabel) scaleLabel.textContent = mode === 'average' ? 'Weighted contribution · loss × prevalence' : 'Environment loss · prevalence ignored';
      if (note) note.textContent = mode === 'average'
        ? rareShare < 0.09523809523809523
          ? `At ${(rareShare * 100).toFixed(0)}%, code is still too rare to outweigh frequency-first’s advantage in the two common rooms.`
          : `At ${(rareShare * 100).toFixed(0)}%, the code room carries enough weight for robust capacity to have the lower mean risk.`
        : 'Worst-room selection ignores prevalence. Frequency-first peaks at 0.84; robust capacity peaks at 0.27.';
      riskLab.classList.toggle('is-average', mode === 'average');
      riskLab.classList.toggle('is-worst', mode === 'worst');
      modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.riskMode === mode)));
      if (crossoverMarker) crossoverMarker.style.left = markerPosition(9.5238095238);
      if (currentMarker) currentMarker.style.left = markerPosition(rareShare * 100);
    };

    predictionButtons.forEach((button) => button.addEventListener('click', () => setPrediction(button.dataset.riskPredict)));
    resetButton?.addEventListener('click', () => {
      if (prevalenceInput) prevalenceInput.value = '5';
      mode = 'average';
      setPrediction('');
      updateRisk();
      predictionButtons[0]?.focus();
    });
    prevalenceInput?.addEventListener('input', updateRisk);
    modeButtons.forEach((button) => button.addEventListener('click', () => { mode = button.dataset.riskMode || 'average'; updateRisk(); }));
    setPrediction(prediction, false);
    updateRisk();
  }

  const gptExplorer = document.querySelector('[data-gpt-explorer]');
  if (gptExplorer) {
    const layerButtons = [...gptExplorer.querySelectorAll('[data-gpt-layer]')];
    const ratioButtons = [...gptExplorer.querySelectorAll('[data-gpt-ratio]')];
    const methodRows = [...gptExplorer.querySelectorAll('[data-gpt-method]')];
    const ledgerRows = [...gptExplorer.querySelectorAll('[data-gpt-row]')];
    const status = gptExplorer.querySelector('[data-gpt-status]');
    const ledger = gptExplorer.querySelector('[data-gpt-ledger]');
    let layer = '2';
    let ratio = '25';
    if (ledger) ledger.open = false;
    const updateGpt = () => {
      const points = methodRows.map((row) => {
        const method = row.dataset.gptMethod;
        const sourceRow = ledgerRows.find((candidate) => candidate.dataset.layer === layer && candidate.dataset.method === method);
        const cell = sourceRow?.querySelector(`[data-ratio="${ratio}"]`);
        return { row, mean: Number(cell?.dataset.mean), sd: Number(cell?.dataset.sd), text: cell?.textContent?.trim() || 'Unavailable' };
      });
      const minimum = Math.min(...points.map((point) => point.mean));
      points.forEach((point) => {
        point.row.classList.toggle('is-lowest', Math.abs(point.mean - minimum) < 1e-9);
        const bar = point.row.querySelector('i b');
        const output = point.row.querySelector('output');
        if (bar) bar.style.width = `${Math.min(100, (point.mean / 16) * 100)}%`;
        if (output) output.textContent = point.text;
      });
      layerButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.gptLayer === layer)));
      ratioButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.gptRatio === ratio)));
      if (status) status.textContent = `Layer ${layer} at ${ratio}% local reduction. Values are measured means ± sample standard deviation across three corpus splits.`;
    };
    layerButtons.forEach((button) => button.addEventListener('click', () => { layer = button.dataset.gptLayer || '2'; updateGpt(); }));
    ratioButtons.forEach((button) => button.addEventListener('click', () => { ratio = button.dataset.gptRatio || '25'; updateGpt(); }));
    updateGpt();
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
