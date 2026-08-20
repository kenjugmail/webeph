/* Shared motion and navigation controller.
   One requestAnimationFrame scheduler serves every registered scene. */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = new Map();
  let frameId = 0;

  document.documentElement.classList.add('motion-ready');

  function sceneProgress(element) {
    const rect = element.getBoundingClientRect();
    if (rect.height > window.innerHeight) {
      const scrollable = Math.max(1, rect.height - window.innerHeight);
      return Math.max(0, Math.min(1, -rect.top / scrollable));
    }
    const travel = Math.max(1, rect.height + window.innerHeight);
    return Math.max(0, Math.min(1, (window.innerHeight - rect.top) / travel));
  }

  function drawFrame(now) {
    frameId = 0;
    if (document.hidden) return;

    let needsAnotherFrame = false;
    scenes.forEach((scene, element) => {
      if (!scene.visible) return;
      const target = sceneProgress(element);
      if (scene.progress === null || reduced.matches || scene.rate <= 0) {
        scene.progress = target;
      } else {
        const elapsed = scene.lastTime ? Math.min(.064, (now - scene.lastTime) / 1000) : 1 / 60;
        const blend = 1 - Math.exp(-scene.rate * elapsed);
        scene.progress += (target - scene.progress) * blend;
        if (Math.abs(target - scene.progress) < .0001) scene.progress = target;
        else needsAnotherFrame = true;
      }
      scene.lastTime = now;

      const progress = scene.progress;
      element.style.setProperty('--scene-progress', progress.toFixed(4));

      const stepCount = Number(element.dataset.sceneSteps || 0);
      if (stepCount > 0) {
        const step = Math.min(stepCount - 1, Math.floor(progress * stepCount));
        if (element.dataset.sceneStep !== String(step)) element.dataset.sceneStep = String(step);
      }

      scene.callbacks.forEach((record) => {
        record.callback(now, progress, target);
        if (record.continuous && !reduced.matches) needsAnotherFrame = true;
      });
    });

    if (needsAnotherFrame && !reduced.matches) frameId = requestAnimationFrame(drawFrame);
  }

  function schedule() {
    if (!frameId && !document.hidden) frameId = requestAnimationFrame(drawFrame);
  }

  const sceneObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const scene = scenes.get(entry.target);
          if (!scene) return;
          scene.visible = entry.isIntersecting;
          scene.lastTime = 0;
          entry.target.toggleAttribute('data-scene-active', entry.isIntersecting);
        });
        schedule();
      }, { rootMargin: '0px', threshold: 0.02 })
    : null;

  function ensureScene(element) {
    let scene = scenes.get(element);
    if (!scene) {
      const declaredRate = Number(element.dataset.sceneEase || 0);
      scene = {
        visible: sceneObserver === null,
        callbacks: new Map(),
        progress: null,
        lastTime: 0,
        declaredRate: Number.isFinite(declaredRate) ? Math.max(0, declaredRate) : 0,
        rate: Number.isFinite(declaredRate) ? Math.max(0, declaredRate) : 0
      };
      scenes.set(element, scene);
      if (sceneObserver) sceneObserver.observe(element);
    }
    return scene;
  }

  function refreshSceneOptions(scene) {
    let rate = scene.declaredRate;
    scene.callbacks.forEach((record) => {
      if (record.rate > rate) rate = record.rate;
    });
    scene.rate = rate;
  }

  window.EphemerentMotion = {
    register(element, callback, options) {
      if (!element || typeof callback !== 'function') return function () {};
      const scene = ensureScene(element);
      const settings = options || {};
      const requestedRate = Number(settings.rate || 0);
      scene.callbacks.set(callback, {
        callback,
        continuous: settings.continuous !== false,
        rate: Number.isFinite(requestedRate) ? Math.max(0, requestedRate) : 0
      });
      refreshSceneOptions(scene);
      schedule();
      return function unregister() {
        scene.callbacks.delete(callback);
        refreshSceneOptions(scene);
        if (!scene.callbacks.size && !element.hasAttribute('data-scene')) {
          sceneObserver?.unobserve(element);
          scenes.delete(element);
        }
      };
    },
    reduced() { return reduced.matches; },
    schedule
  };

  function mountSceneHooks() {
    document.querySelectorAll('[data-scene]').forEach(ensureScene);
    schedule();
  }

  function mountReveals() {
    const items = document.querySelectorAll('.reveal:not(.in), .rv:not(.in), [data-motion="reveal"]');
    if (reduced.matches || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('in'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
    items.forEach((item) => observer.observe(item));
  }

  function mountNavigation() {
    const nav = document.querySelector('.nav, .ebar');
    if (!nav) return;

    const inner = nav.querySelector('.nav-inner, .ebar-in');
    const links = nav.querySelector('.nav-links, .enav');
    if (!inner || !links) return;

    if (!links.id) links.id = nav.classList.contains('ebar') ? 'lab-navigation' : 'product-navigation';

    const cleanPath = (path) => ({
      '/Ephemerent.html': '/',
      '/research.html': '/research',
      '/Orrery.html': '/orrery',
      '/Vellum.html': '/vellum',
      '/Vespera.html': '/vespera',
      '/Shelterix.html': '/shelterix',
      '/arbiter-preview.html': '/arbiter',
      '/organizations.html': '/organizations',
      '/security.html': '/security',
      '/slack.html': '/slack',
      '/download.html': '/download',
      '/privacy.html': '/privacy',
      '/terms.html': '/terms',
    }[path] || path.replace(/\/$/, '') || '/');
    const currentPath = cleanPath(location.pathname);
    links.querySelectorAll('a[href]').forEach((link) => {
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.hash) return;
      if (cleanPath(url.pathname) === currentPath) link.setAttribute('aria-current', 'page');
      else if (link.getAttribute('aria-current') === 'page') link.removeAttribute('aria-current');
    });

    let button = inner.querySelector('.menu-toggle');
    if (!button) {
      button = document.createElement('button');
      button.className = 'menu-toggle';
      button.type = 'button';
      button.setAttribute('aria-controls', links.id);
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Open menu');
      button.innerHTML = '<span class="menu-toggle-label">Menu</span><span class="menu-toggle-lines" aria-hidden="true"><i></i><i></i></span>';
      const auth = inner.querySelector('.auth-nav-slot');
      if (auth) inner.insertBefore(button, auth);
      else inner.appendChild(button);
    } else {
      button.setAttribute('aria-controls', links.id);
      if (!button.getAttribute('aria-expanded')) button.setAttribute('aria-expanded', 'false');
    }

    const buttonLabel = button.querySelector('.menu-toggle-label');
    const pageRegions = Array.from(document.querySelectorAll('main, body > footer'))
      .filter((region) => !nav.contains(region));

    function setPageInert(inert) {
      pageRegions.forEach((region) => {
        if (inert) {
          if (!region.hasAttribute('inert')) region.setAttribute('data-menu-inert', 'true');
          region.setAttribute('inert', '');
        } else if (region.hasAttribute('data-menu-inert')) {
          region.removeAttribute('inert');
          region.removeAttribute('data-menu-inert');
        }
      });
    }

    function setOpen(open, options) {
      const settings = options || {};
      nav.classList.toggle('menu-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (buttonLabel) buttonLabel.textContent = open ? 'Close' : 'Menu';
      document.body.classList.toggle('menu-lock', open);
      setPageInert(open);
      if (open && settings.focusFirst) {
        const first = links.querySelector('a, button');
        if (first instanceof HTMLElement) first.focus({ preventScroll: true });
      } else if (!open && settings.returnFocus) {
        button.focus({ preventScroll: true });
      }
    }

    button.addEventListener('click', (event) => {
      setOpen(!nav.classList.contains('menu-open'), { focusFirst: event.detail === 0 });
    });
    links.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (!nav.classList.contains('menu-open')) return;
      if (event.key === 'Escape') {
        setOpen(false, { returnFocus: true });
        return;
      }
      if (event.key !== 'Tab') return;

      const menuItems = Array.from(links.querySelectorAll('a, button'))
        .filter((item) => item instanceof HTMLElement && item.offsetParent !== null);
      const focusables = [button, ...menuItems];
      if (!focusables.length) return;
      const current = focusables.indexOf(document.activeElement);
      if (event.shiftKey && (current <= 0)) {
        event.preventDefault();
        focusables[focusables.length - 1].focus({ preventScroll: true });
      } else if (!event.shiftKey && current === focusables.length - 1) {
        event.preventDefault();
        focusables[0].focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === button && menuItems[0]) {
        event.preventDefault();
        menuItems[0].focus({ preventScroll: true });
      }
    });

    const mobileNavigation = window.matchMedia('(max-width: 880px)');
    mobileNavigation.addEventListener?.('change', (event) => {
      if (!event.matches && nav.classList.contains('menu-open')) setOpen(false);
    });

    let scrollQueued = false;
    function updateNav() {
      scrollQueued = false;
      nav.classList.toggle('scrolled', window.scrollY > 18);
    }
    window.addEventListener('scroll', () => {
      if (!scrollQueued) {
        scrollQueued = true;
        requestAnimationFrame(updateNav);
      }
      schedule();
    }, { passive: true });
    updateNav();
  }

  function handleVisibility() {
    if (document.hidden && frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    } else {
      schedule();
    }
  }

  reduced.addEventListener?.('change', schedule);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('resize', schedule, { passive: true });

  mountSceneHooks();
  mountReveals();
  mountNavigation();
})();
