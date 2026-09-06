(() => {
  const lab = document.querySelector('[data-swc-miss-lab]');
  if (!lab) return;
  const mass = lab.querySelector('[data-swc-mass]');
  const samples = lab.querySelector('[data-swc-samples]');
  const value = lab.querySelector('[data-swc-miss-value]');
  const bar = lab.querySelector('[data-swc-miss-bar]');
  const copy = lab.querySelector('[data-swc-miss-copy]');

  const update = () => {
    const delta = 10 ** -Number(mass.value);
    const count = 10 ** Number(samples.value);
    const miss = Math.exp(count * Math.log1p(-delta));
    const percent = miss * 100;
    value.textContent = `${percent < .01 ? percent.toFixed(4) : percent.toFixed(2)}%`;
    bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    copy.textContent = percent > 50
      ? 'A search is more likely than not to see nothing even though the accepted mass is positive.'
      : percent > 1
        ? 'Zero observed witnesses remains plausible; absence has not been proved.'
        : 'This budget will usually see a witness, but a sampled result still is not an exact mass certificate.';
  };
  mass.addEventListener('change', update);
  samples.addEventListener('change', update);
  update();
})();
