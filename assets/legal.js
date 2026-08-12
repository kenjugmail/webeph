(function () {
  'use strict';

  function mountLegalIndex() {
    const list = document.querySelector('[data-legal-index]');
    const headings = Array.from(document.querySelectorAll('.legal-body h2'));
    if (!list || !headings.length || list.children.length) return;

    const used = new Set();
    headings.forEach((heading, index) => {
      let id = heading.id || heading.textContent.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `section-${index + 1}`;
      const base = id;
      let suffix = 2;
      while (used.has(id) || (document.getElementById(id) && document.getElementById(id) !== heading)) {
        id = `${base}-${suffix}`;
        suffix += 1;
      }
      used.add(id);
      heading.id = id;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${id}`;
      link.textContent = heading.textContent;
      item.appendChild(link);
      list.appendChild(item);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLegalIndex, { once: true });
  else mountLegalIndex();
}());
