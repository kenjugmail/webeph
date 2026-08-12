import {
  cloudConfigured,
  getCloudSession,
  getResearchProfile,
  getSupabaseClient,
} from './cloud-auth.js';

document.documentElement.classList.add('jr-js');

const page = document.body?.dataset?.journalPage || '';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function setMetaContent(selector, value) {
  const element = $(selector);
  if (element && value) element.setAttribute('content', String(value));
}

const STATUS_LABELS = {
  draft: 'Private draft',
  submitted: 'Submitted',
  screening: 'Screening',
  peer_review: 'Peer review with AI',
  changes_requested: 'Changes requested',
  accepted: 'Accepted after peer review',
  published: 'Published',
  withdrawn: 'Withdrawn',
  retracted: 'Retracted',
};

const TYPE_EXTENSIONS = {
  manuscript: ['.pdf', '.md', '.markdown', '.html', '.htm', '.txt'],
  source: ['.tex', '.zip', '.tar', '.gz', '.py', '.js', '.ts', '.ipynb'],
  figure: ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.avif'],
  data: ['.csv', '.tsv', '.json', '.jsonl', '.parquet'],
};

const FILE_GROUPS = [
  { key: 'manuscript', label: 'Manuscript' },
  { key: 'source', label: 'Source' },
  { key: 'reproducibility', label: 'Reproducibility' },
  { key: 'submission', label: 'Submission' },
];

const RELATED_STORIES = {
  'distribution-robust-functional-subset-projection-for-structured-neural-network-width-compression': '/news/drfsp-robust-compression',
};

const ARTICLE_SOCIAL_IMAGES = {
  'distribution-robust-functional-subset-projection-for-structured-neural-network-width-compression': 'https://ephemerent.com/assets/og-journal-drfsp.png',
};

const REVIEW_HEADINGS = new Map([
  ['summary', 'Summary'],
  ['overview', 'Overview'],
  ['decision', 'Decision'],
  ['scope and contribution', 'Scope and contribution'],
  ['evidence', 'Evidence checked'],
  ['evidence checked', 'Evidence checked'],
  ['assessment', 'Assessment'],
  ['strengths', 'Strengths'],
  ['concerns', 'Concerns'],
  ['limitations', 'Limitations'],
  ['limitations that must remain attached to the claim', 'Limitations'],
  ['recommendation', 'Recommendation'],
  ['final recommendation', 'Final recommendation'],
  ['open questions', 'Open questions'],
  ['reproducibility', 'Reproducibility'],
  ['reproducibility and presentation', 'Reproducibility and presentation'],
  ['methods', 'Methods'],
  ['clarity', 'Clarity'],
  ['safety', 'Safety'],
]);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeUrl(value) {
  try {
    const url = new URL(value, location.origin);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch (_) { /* A missing or invalid link is simply not rendered. */ }
  return '';
}

function formatDate(value) {
  if (!value) return 'Not dated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not dated';
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MiB`;
}

function authorName(author) {
  if (!author) return '';
  if (typeof author === 'string') return author;
  return author.name || author.display_name || author.model || '';
}

function authorLine(authors) {
  const names = Array.isArray(authors) ? authors.map(authorName).filter(Boolean) : [];
  return names.length ? names.join(' · ') : 'Author list supplied in the record';
}

function slugify(value) {
  return String(value || 'work')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'work';
}

function filename(value) {
  return String(value || 'file')
    .normalize('NFKC')
    .replace(/[/\\]+/g, '-')
    .replace(/[^\w.()\- ]+/g, '')
    .trim()
    .slice(0, 150) || 'file';
}

function extension(value) {
  const match = String(value || '').toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : '';
}

function fileRole(value, index = 0) {
  const ext = extension(value);
  if (index === 0 && TYPE_EXTENSIONS.manuscript.includes(ext)) return 'manuscript';
  for (const [role, extensions] of Object.entries(TYPE_EXTENSIONS)) {
    if (extensions.includes(ext)) return role;
  }
  return 'supplement';
}

function fileGroup(file, index = 0) {
  const role = String(file?.file_role || '').toLowerCase();
  const mime = String(file?.mime_type || '').toLowerCase();
  const name = String(file?.original_filename || '').toLowerCase();
  if (/cover|checklist|metadata|readme|submission|letter/.test(`${role} ${name}`)) return 'submission';
  if (/figure|data|dataset|artifact|resource|supplement|result|notebook/.test(`${role} ${name}`) || mime.startsWith('image/') || /csv|json|parquet/.test(mime)) return 'reproducibility';
  if (/source|code|latex|tex/.test(`${role} ${name}`) || /javascript|python|x-tex/.test(mime)) return 'source';
  if (/manuscript|article|paper|primary/.test(role) || mime === 'application/pdf' || /^text\/(plain|markdown|html)/.test(mime)) return 'manuscript';
  if (/zip|gzip|tar/.test(mime) || ['.zip', '.tar', '.gz'].includes(extension(name))) return 'source';
  return index === 0 ? 'manuscript' : 'reproducibility';
}

function fileFormat(file) {
  const ext = extension(file?.original_filename).replace('.', '');
  if (ext) return ext.toUpperCase();
  return String(file?.mime_type || 'file').split('/').pop().toUpperCase();
}

function parseReviewSections(value) {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  const sections = [];
  let current = { title: 'Review', lines: [] };
  const pushCurrent = () => {
    const body = current.lines.join('\n').trim();
    if (body) sections.push({ title: current.title, body });
  };
  lines.forEach((line) => {
    const colonMatch = line.match(/^\s*(?:#{1,3}\s*)?([A-Za-z][A-Za-z &/+\-]{1,42})\s*:\s*(.*)$/);
    const markdownMatch = line.match(/^\s*(?:#{1,3}\s+)([A-Za-z][A-Za-z &/+\-]{1,60})\s*$/);
    const plainHeading = String(line || '').trim().toLowerCase();
    const match = colonMatch || markdownMatch;
    const normalized = match?.[1]?.trim().toLowerCase() || (REVIEW_HEADINGS.has(plainHeading) ? plainHeading : '');
    const allowed = normalized ? REVIEW_HEADINGS.get(normalized) : '';
    if (allowed) {
      pushCurrent();
      current = { title: allowed, lines: [] };
      if (colonMatch?.[2]) current.lines.push(colonMatch[2]);
      return;
    }
    current.lines.push(line);
  });
  pushCurrent();
  return sections.length ? sections : [{ title: 'Review', body: String(value || '').trim() }];
}

function mountJournalNavigation() {
  $$('.jr-menu-button').forEach((button) => {
    const nav = document.getElementById(button.getAttribute('aria-controls'));
    if (!nav) return;
    const close = (returnFocus = false) => {
      nav.removeAttribute('data-open');
      button.setAttribute('aria-expanded', 'false');
      if (returnFocus) button.focus();
    };
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      if (open) nav.dataset.open = 'true';
      else nav.removeAttribute('data-open');
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') close(true);
    });
    document.addEventListener('click', (event) => {
      if (button.getAttribute('aria-expanded') === 'true' && !nav.contains(event.target) && !button.contains(event.target)) close();
    });
    window.matchMedia('(min-width: 961px)').addEventListener?.('change', (event) => {
      if (event.matches) close();
    });
  });
}

function setMessage(element, message, tone = '') {
  if (!element) return;
  element.textContent = message || '';
  if (tone) element.dataset.tone = tone;
  else delete element.dataset.tone;
}

function renderAbstract(root, value, fallback = '') {
  if (!root) return;
  root.replaceChildren();
  const source = String(value || fallback || '').trim();
  if (!source) return;
  source.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const paragraph = document.createElement('p');
    const labelMatch = part.match(/^([A-Za-z][A-Za-z -]{1,22}):\s*([\s\S]+)$/);
    if (labelMatch) {
      const label = document.createElement('span');
      label.className = 'jr-abstract-term';
      label.textContent = labelMatch[1];
      const copy = document.createElement('span');
      copy.textContent = labelMatch[2];
      paragraph.append(label, copy);
    } else {
      paragraph.textContent = part;
    }
    root.appendChild(paragraph);
  });
}

function noClientMessage() {
  return !cloudConfigured()
    ? 'The journal account connection is not configured on this preview yet.'
    : 'The journal record is not available yet. Try again after the database migration is applied.';
}

async function clientOrNull() {
  if (!cloudConfigured()) return null;
  return getSupabaseClient();
}

function authLink(next) {
  return `/login.html?context=research&next=${encodeURIComponent(next)}`;
}

async function renderIndex() {
  const list = $('[data-journal-list]');
  if (!list) return;
  list.setAttribute('aria-busy', 'true');
  const count = $('[data-journal-archive-count]');
  const sb = await clientOrNull();
  if (!sb) {
    list.innerHTML = '<div class="jr-empty-row">The first record is being prepared. The archive will open as soon as a published work is ready.</div>';
    if (count) count.textContent = 'Archive · opening';
    list.removeAttribute('aria-busy');
    return;
  }

  const { data, error } = await sb
    .from('research_publications')
    .select('id,article_id,slug,title,summary,public_authors,article_type,published_at,status')
    .in('status', ['published', 'retracted'])
    .order('published_at', { ascending: false });

  if (error) {
    list.innerHTML = `<div class="jr-empty-row jr-error">${escapeHtml(noClientMessage())}</div>`;
    if (count) count.textContent = 'Archive · unavailable';
    list.removeAttribute('aria-busy');
    return;
  }

  const rows = data || [];
  if (count) count.textContent = `Archive · ${rows.length} ${rows.length === 1 ? 'record' : 'records'}`;
  if (!rows.length) {
    list.innerHTML = '<div class="jr-empty-row">The archive is quiet by design. The first accepted record will appear here.</div>';
    list.removeAttribute('aria-busy');
    return;
  }

  list.innerHTML = rows.map((row) => {
    const href = `/journal/article/${encodeURIComponent(row.slug || '')}`;
    return `<a class="jr-archive-row" href="${escapeHtml(href)}">
      <span class="jr-archive-id">${escapeHtml(row.article_id || 'ER / pending')}</span>
      <span><span class="jr-archive-title">${escapeHtml(row.title)}</span><span class="jr-archive-authors">${escapeHtml(authorLine(row.public_authors))}</span></span>
      <span class="jr-archive-summary"><span class="jr-archive-type">${escapeHtml(row.status === 'retracted' ? 'Retracted' : row.article_type || 'Research')}</span><br>${escapeHtml(row.summary || 'Open record')}</span>
      <span class="jr-archive-arrow" aria-hidden="true">→</span>
    </a>`;
  }).join('');
  list.removeAttribute('aria-busy');
}

function renderArticleNotice(root, title, message) {
  if (!root) return;
  root.innerHTML = `<section class="jr-container jr-form-page"><div class="jr-status-note jr-error jr-article-error"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p><a class="jr-button" href="/journal">Back to archive</a></div></section>`;
}

async function renderArticle() {
  const root = $('[data-journal-article-root]');
  if (!root) return;
  const querySlug = new URLSearchParams(location.search).get('slug');
  const pathSlug = location.pathname.match(/^\/journal\/article\/([^/]+)/)?.[1] || '';
  const slug = querySlug || (pathSlug ? decodeURIComponent(pathSlug) : '');
  if (!slug) {
    renderArticleNotice(root, 'No article selected', 'Choose a published record from the archive.');
    return;
  }
  const sb = await clientOrNull();
  if (!sb) {
    renderArticleNotice(root, 'Archive opening', noClientMessage());
    return;
  }

  const { data: submission, error } = await sb
    .from('research_publications')
    .select('*')
    .eq('slug', slug)
    .in('status', ['published', 'retracted'])
    .maybeSingle();
  if (error || !submission) {
    renderArticleNotice(root, 'Record not available', 'This article may still be private, may have moved, or may not exist.');
    return;
  }

  document.title = `${submission.title} — Ephemerent Research`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = submission.summary || 'A published article in Ephemerent Research.';
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  const canonicalUrl = `https://ephemerent.com/journal/article/${encodeURIComponent(submission.slug)}`;
  const socialImage = ARTICLE_SOCIAL_IMAGES[submission.slug] || 'https://ephemerent.com/assets/og-research.png';
  if (canonical) canonical.href = canonicalUrl;
  const socialDescription = submission.summary || 'A published article in Ephemerent Research.';
  setMetaContent('meta[property="og:title"]', submission.title);
  setMetaContent('meta[property="og:description"]', socialDescription);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[property="og:image"]', socialImage);
  setMetaContent('meta[property="article:published_time"]', submission.published_at);
  setMetaContent('meta[property="article:modified_time"]', submission.updated_at || submission.published_at);
  setMetaContent('meta[name="twitter:title"]', submission.title);
  setMetaContent('meta[name="twitter:description"]', socialDescription);
  setMetaContent('meta[name="twitter:image"]', socialImage);
  const structuredData = $('#article-structured-data');
  if (structuredData) {
    const authors = Array.isArray(submission.public_authors) ? submission.public_authors : [];
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ScholarlyArticle',
      headline: submission.title,
      description: socialDescription,
      url: canonicalUrl,
      image: socialImage,
      datePublished: submission.published_at,
      dateModified: submission.updated_at || submission.published_at,
      identifier: submission.article_id,
      license: submission.license === 'CC BY 4.0' ? 'https://creativecommons.org/licenses/by/4.0/' : submission.license,
      isAccessibleForFree: true,
      author: authors.map((author) => ({
        '@type': author.type === 'organization' ? 'Organization' : author.type === 'ai_system' ? 'SoftwareApplication' : 'Person',
        name: author.name,
      })),
      publisher: { '@type': 'Organization', name: 'Ephemerent Research', url: 'https://ephemerent.com/journal' },
      about: Array.isArray(submission.keywords) ? submission.keywords : [],
    });
  }

  $('[data-article-id]').textContent = submission.article_id || 'Ephemerent Research record';
  $('[data-article-type]').textContent = submission.article_type || 'Research';
  $('[data-article-status]').textContent = STATUS_LABELS[submission.status] || 'Published';
  $('[data-article-title]').textContent = submission.title || 'Untitled work';
  $('[data-article-summary]').textContent = submission.summary || '';
  $('[data-article-authors]').textContent = authorLine(submission.public_authors);
  $('[data-article-accountable]').textContent = submission.accountable_name || 'Accountable submitter on file';
  $('[data-article-date]').textContent = formatDate(submission.published_at);
  $('[data-article-license]').textContent = submission.license || 'License not specified';
  $('[data-article-keywords]').textContent = Array.isArray(submission.keywords) && submission.keywords.length ? submission.keywords.join(' · ') : 'None listed';
  $('[data-article-disclosure]').innerHTML = `<strong>${submission.ai_disclosure ? 'AI contribution' : 'Authorship disclosure'}</strong><p>${escapeHtml(submission.ai_disclosure || 'No AI contribution statement was supplied.')}</p>`;
  const notice = $('[data-article-notice]');
  if (submission.public_notice || submission.status === 'retracted') {
    notice.classList.remove('jr-hidden');
    notice.innerHTML = `<strong>${escapeHtml(submission.public_notice_type === 'correction' ? 'Correction on record' : submission.public_notice_type === 'withdrawal' ? 'Withdrawal notice' : submission.status === 'retracted' ? 'Retraction notice' : 'Editorial notice')}</strong><p>${escapeHtml(submission.public_notice || 'This record has been retracted. The editorial status is part of the public record.')}</p>`;
  }
  const linksRoot = $('[data-article-links]');
  const externalLinks = Array.isArray(submission.external_links) ? submission.external_links.map(safeUrl).filter(Boolean) : [];
  linksRoot.innerHTML = externalLinks.length
    ? externalLinks.map((link) => `<li><a class="jr-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(new URL(link).hostname)}</a></li>`).join('')
    : '<li><span>No external links listed.</span></li>';
  renderAbstract($('[data-article-abstract]'), submission.abstract, submission.summary);

  const [fileResult, versionResult] = await Promise.all([
    sb.from('research_public_files').select('id,version_id,bucket_id,storage_path,original_filename,file_role,mime_type,byte_size,sha256,created_at').eq('submission_id', submission.id).order('created_at'),
    sb.from('research_public_versions').select('id,version_number,title,created_at,published_at,public_notice_type,public_notice').eq('submission_id', submission.id).order('version_number', { ascending: false }),
  ]);
  const versions = versionResult.data || [];
  const currentVersion = versions.find((version) => version.published_at) || versions[0];
  const files = (fileResult.data || []).filter((file) => !currentVersion || file.version_id === currentVersion.id);
  const filesRoot = $('[data-article-files]');
  if (fileResult.error) {
    filesRoot.innerHTML = '<div class="jr-thread-empty jr-error">Public files are temporarily unavailable.</div>';
  } else if (!files.length) {
    filesRoot.innerHTML = '<div class="jr-thread-empty">No public files are attached to this version.</div>';
  } else {
    const grouped = Object.fromEntries(FILE_GROUPS.map(({ key }) => [key, []]));
    files.forEach((file, index) => grouped[fileGroup(file, index)].push(file));
    filesRoot.innerHTML = FILE_GROUPS.filter(({ key }) => grouped[key].length).map(({ key, label }) => `<section class="jr-file-group"><h3>${escapeHtml(label)} <span>${grouped[key].length} ${grouped[key].length === 1 ? 'file' : 'files'}</span></h3><ul class="jr-file-group-list">${grouped[key].map((file) => {
      const publicUrl = sb.storage.from(file.bucket_id || 'research-public').getPublicUrl(file.storage_path).data.publicUrl;
      return `<li><a class="jr-file-link" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener"><span class="jr-file-name">${escapeHtml(file.original_filename)}</span><span class="jr-file-meta">${escapeHtml(fileFormat(file))} · ${escapeHtml(formatBytes(file.byte_size))} ↗</span></a></li>`;
    }).join('')}</ul></section>`).join('');
  }
  const versionsRoot = $('[data-article-versions]');
  versionsRoot.innerHTML = versions.length
    ? versions.map((version) => `<li><strong>V${escapeHtml(version.version_number)}</strong><span>${escapeHtml(formatDate(version.published_at || version.created_at))}<br>Immutable snapshot${version.public_notice ? ` · ${escapeHtml(version.public_notice_type || 'notice')}` : ''}</span></li>`).join('')
    : '<li><span>Version history will appear with the first publication.</span></li>';

  const currentVersionLabel = $('[data-article-current-version]');
  if (currentVersionLabel) currentVersionLabel.textContent = currentVersion ? `Version ${currentVersion.version_number}` : 'Unversioned';

  const actionsRoot = $('[data-article-actions]');
  if (actionsRoot) {
    const firstPdf = files.find((file) => String(file.mime_type || '').toLowerCase() === 'application/pdf' || extension(file.original_filename) === '.pdf');
    const relatedStory = RELATED_STORIES[submission.slug];
    const actions = [];
    if (firstPdf) {
      const pdfUrl = sb.storage.from(firstPdf.bucket_id || 'research-public').getPublicUrl(firstPdf.storage_path).data.publicUrl;
      actions.push(`<a class="jr-button jr-button-primary" href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">Read the paper <span aria-hidden="true">↗</span></a>`);
    }
    if (relatedStory) actions.push(`<a class="jr-button" href="${escapeHtml(relatedStory)}">Read the visual explainer</a>`);
    actions.push('<a class="jr-button" href="#article-files">Research files</a>', '<a class="jr-button" href="#review-ledger">Review ledger</a>');
    actionsRoot.innerHTML = actions.join('');
  }

  if (currentVersion) await renderDiscussion(sb, submission, currentVersion, versions);
}

function threadItem(item, kind, showReport = false) {
  const label = item.is_author_response ? 'Author response' : 'Comment';
  const report = showReport ? `<button class="jr-text-button" type="button" data-report-id="${escapeHtml(item.id)}" data-report-kind="${kind}">Report</button>` : '';
  return `<article class="jr-thread-item"><div class="jr-thread-meta"><span>${escapeHtml(label)}</span><span>${escapeHtml(item.display_name || 'Reader')} · ${escapeHtml(formatDate(item.created_at))} ${report}</span></div><p class="jr-thread-body">${escapeHtml(item.body)}</p>${item.ai_disclosure ? `<p class="jr-field-hint">AI disclosure: ${escapeHtml(item.ai_disclosure)}</p>` : ''}</article>`;
}

function reviewMode(item) {
  if (item.reviewer_type === 'ai_system') return 'AI system review';
  if (item.reviewer_type === 'human_ai') return 'Human + AI review';
  return 'Human review';
}

function reviewRecord(item, versionNumbers, showReport = false) {
  const report = showReport ? `<button class="jr-text-button" type="button" data-report-id="${escapeHtml(item.id)}" data-report-kind="review">Report</button>` : '';
  const versionNumber = versionNumbers.get(item.version_id);
  const sections = parseReviewSections(item.body).map((section) => `<section class="jr-review-section"><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.body)}</p></section>`).join('');
  return `<article class="jr-review-record">
    <header class="jr-review-header">
      <div><h3 class="jr-review-title">${escapeHtml(item.review_type || 'Peer review')}</h3><p class="jr-review-byline">${escapeHtml(item.display_name || 'Disclosed reviewer')} · ${escapeHtml(formatDate(item.created_at))}</p></div>
      <div class="jr-review-stamp"><strong>${escapeHtml(reviewMode(item))}</strong><span>${item.review_stage === 'prepublication' ? 'Prepublication' : 'Post-publication'}</span><span>${versionNumber ? `Version ${escapeHtml(versionNumber)} reviewed` : 'Published version reviewed'}</span></div>
    </header>
    <div class="jr-review-sections">${sections}</div>
    ${item.ai_disclosure ? `<p class="jr-review-disclosure"><strong>AI disclosure</strong><br>${escapeHtml(item.ai_disclosure)}</p>` : ''}
    ${report ? `<div class="jr-review-actions">${report}</div>` : ''}
  </article>`;
}

async function renderDiscussion(sb, submission, version, allVersions = [version]) {
  const versionIds = allVersions.map((item) => item.id).filter(Boolean);
  const [commentsResult, reviewsResult, session, authorResult] = await Promise.all([
    sb.from('research_public_comments').select('id,version_id,display_name,body,is_author_response,ai_disclosure,created_at').in('version_id', versionIds).order('created_at'),
    sb.from('research_public_reviews').select('id,version_id,display_name,review_type,reviewer_type,review_stage,body,ai_disclosure,created_at').in('version_id', versionIds).order('created_at'),
    getCloudSession(),
    sb.from('research_submissions').select('submitter_id').eq('id', submission.id).maybeSingle(),
  ]);
  const commentsRoot = $('[data-article-comments]');
  const reviewsRoot = $('[data-article-reviews]');
  const comments = commentsResult.data || [];
  const reviews = reviewsResult.data || [];
  const canReport = Boolean(session?.user);
  const versionNumbers = new Map(allVersions.map((item) => [item.id, item.version_number]));
  commentsRoot.innerHTML = commentsResult.error ? '<div class="jr-thread-empty jr-error">Comments are temporarily unavailable.</div>' : comments.length ? comments.map((item) => threadItem(item, 'comment', canReport)).join('') : '<div class="jr-thread-empty">No published comments yet. The record remains open for a careful response.</div>';
  reviewsRoot.innerHTML = reviewsResult.error ? '<div class="jr-thread-empty jr-error">The review ledger is temporarily unavailable.</div>' : reviews.length ? reviews.map((item) => reviewRecord(item, versionNumbers, canReport)).join('') : '<div class="jr-thread-empty">No public peer reviews are attached to this version yet.</div>';

  const commentGate = $('[data-article-comment-gate]');
  const reviewGate = $('[data-article-review-gate]');
  const authorGate = $('[data-article-author-gate]');
  if (!session?.user) {
    const returnPath = `/journal/article/${encodeURIComponent(submission.slug)}`;
    commentGate.innerHTML = `<p>Sign in with a free Ephemerent account to leave a moderated comment.</p><a class="jr-button jr-button-small" href="${escapeHtml(authLink(returnPath))}">Sign in to respond</a>`;
    reviewGate.innerHTML = `<p>Open reviews are attached to a specific version and moderated before publication.</p><a class="jr-button jr-button-small" href="${escapeHtml(authLink(returnPath))}">Sign in to review</a>`;
    return;
  }

  commentGate.innerHTML = `<form data-comment-form><label class="jr-field"><span class="jr-section-label">Add a comment</span><textarea class="jr-textarea" name="body" maxlength="5000" required placeholder="Respond to the work, not the person."></textarea></label><label class="jr-field jr-field-spaced"><span class="jr-section-label">AI disclosure <span class="jr-quiet">(if relevant)</span></span><input class="jr-input" name="ai_disclosure" maxlength="1000" placeholder="Human-written, AI-assisted, or AI-authored"></label><div class="jr-form-actions"><button class="jr-button jr-button-small jr-button-primary" type="submit">Send for moderation</button><span class="jr-form-msg" data-interaction-msg role="status"></span></div></form>`;
  reviewGate.innerHTML = `<form data-review-form><label class="jr-field"><span class="jr-section-label">Submit a peer review</span><select class="jr-select" name="review_type"><option>Open peer review</option><option>Replication note</option><option>Critical response</option><option>Methods commentary</option></select></label><label class="jr-field jr-field-spaced"><span class="jr-section-label">Review mode</span><select class="jr-select" name="reviewer_type"><option value="human_ai">Human + AI assisted</option><option value="human">Human reviewer</option><option value="ai_system">AI system</option></select></label><label class="jr-field jr-field-spaced"><span class="jr-section-label">Review</span><textarea class="jr-textarea" name="body" maxlength="20000" required placeholder="Use plain-text headings such as Evidence checked:, Limitations:, and Recommendation:."></textarea></label><label class="jr-field jr-field-spaced"><span class="jr-section-label">AI disclosure <span class="jr-quiet">(required for AI review)</span></span><input class="jr-input" name="ai_disclosure" maxlength="1000" placeholder="Name the system, version, role, or write “No AI used.”"></label><div class="jr-form-actions"><button class="jr-button jr-button-small jr-button-primary" type="submit">Send peer review for moderation</button><span class="jr-form-msg" data-interaction-msg role="status"></span></div></form>`;

  const isAuthor = authorResult.data?.submitter_id === session.user.id;
  if (isAuthor && authorGate) {
    authorGate.innerHTML = `<form data-author-response-form><label class="jr-field"><span class="jr-section-label">Author response</span><textarea class="jr-textarea" name="body" maxlength="5000" required placeholder="Add context or respond to a reader. This is moderated like every other contribution."></textarea></label><label class="jr-field jr-field-spaced"><span class="jr-section-label">AI disclosure <span class="jr-quiet">(if relevant)</span></span><input class="jr-input" name="ai_disclosure" maxlength="1000" placeholder="Human-written, AI-assisted, or AI-authored"></label><div class="jr-form-actions"><button class="jr-button jr-button-small" type="submit">Send author response</button><span class="jr-form-msg" data-interaction-msg role="status"></span></div></form>`;
    $('[data-author-response-form]').addEventListener('submit', (event) => submitInteraction(event, 'comment', sb, version.id, session, true));
  }

  $('[data-comment-form]').addEventListener('submit', (event) => submitInteraction(event, 'comment', sb, version.id, session, false));
  $('[data-review-form]').addEventListener('submit', (event) => submitInteraction(event, 'review', sb, version.id, session));
  $$('[data-report-id]').forEach((button) => button.addEventListener('click', async () => {
    const reason = window.prompt('Why should the editorial desk review this?');
    if (!reason?.trim()) return;
    const { error } = await sb.from('research_reports').insert({
      reporter_id: session.user.id,
      target_type: button.dataset.reportKind,
      target_id: button.dataset.reportId,
      reason: reason.trim().slice(0, 240),
    });
    if (error) return;
    button.textContent = 'Reported';
    button.disabled = true;
  }));
}

async function submitInteraction(event, kind, sb, versionId, session, isAuthorResponse = false) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('[data-interaction-msg]', form);
  const data = new FormData(form);
  const body = String(data.get('body') || '').trim();
  if (!body) return setMessage(message, 'Write something first.', 'error');
  const profile = await getResearchProfile();
  const displayName = profile?.display_name || 'Reader';
  const payload = {
    version_id: versionId,
    user_id: session.user.id,
    display_name: displayName,
    body,
    status: 'pending',
    is_author_response: isAuthorResponse,
    ai_disclosure: String(data.get('ai_disclosure') || '').trim(),
  };
  if (kind === 'review') payload.review_type = String(data.get('review_type') || 'Open review');
  if (kind === 'review') {
    payload.reviewer_type = String(data.get('reviewer_type') || 'human_ai');
    payload.review_stage = 'post_publication';
  }
  const { error } = await sb.from(kind === 'review' ? 'research_reviews' : 'research_comments').insert(payload);
  if (error) {
    setMessage(message, 'Could not send this for moderation yet. Check the journal schema and try again.', 'error');
    return;
  }
  form.reset();
  setMessage(message, 'Received. It will appear after editorial moderation.', 'success');
}

function readAuthors() {
  return $$('[data-author-row]').map((row) => ({
    type: $('.jr-author-type', row)?.value || 'human',
    name: $('[name="author_name"]', row)?.value.trim() || '',
    role: $('[name="author_role"]', row)?.value.trim() || '',
  })).filter((author) => author.name);
}

function bindAuthorRow(row) {
  $('.jr-remove-author', row)?.addEventListener('click', () => {
    const rows = $$('[data-author-row]');
    if (rows.length <= 1) {
      $('[name="author_name"]', row).value = '';
      $('[name="author_role"]', row).value = '';
      return;
    }
    row.remove();
  });
}

function showFiles(input) {
  const root = $('#submission-file-list');
  if (!root) return;
  const files = Array.from(input.files || []);
  if (!files.length) {
    root.innerHTML = '<span>No files chosen yet.</span>';
    return;
  }
  root.innerHTML = files.map((file) => `<div><span>${escapeHtml(file.name)}</span><span>${escapeHtml(formatBytes(file.size))}</span></div>`).join('');
}

async function digestFile(file) {
  if (!window.crypto?.subtle) throw new Error('SHA-256 hashing is not available in this browser.');
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function uploadFiles(sb, session, submissionId, files, fileNote = '') {
  const records = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} is larger than the 50 MiB per-file limit.`);
    const name = filename(file.name);
    const originalName = String(file.webkitRelativePath || file.name || 'file').slice(0, 240);
    const path = `${session.user.id}/${submissionId}/${String(index + 1).padStart(3, '0')}-${name}`;
    const contentType = file.type || 'application/octet-stream';
    const { error: uploadError } = await sb.storage.from('research-private').upload(path, file, { upsert: false, contentType });
    if (uploadError) throw uploadError;
    records.push({
      submission_id: submissionId,
      bucket_id: 'research-private',
      storage_path: path,
      original_filename: originalName,
      file_role: fileRole(file.name, index),
      mime_type: contentType,
      byte_size: file.size,
      sha256: await digestFile(file),
      visibility: 'private',
      created_by: session.user.id,
    });
  }
  if (records.length) {
    const { error } = await sb.from('research_files').insert(records);
    if (error) throw error;
  }
  return records;
}

function holdFromValue(value) {
  return value && value !== 'none';
}

async function mountSubmit() {
  const form = $('[data-journal-submit-form]');
  const gate = $('#journal-auth-gate');
  if (!form || !gate) return;
  const sb = await clientOrNull();
  if (!sb) {
    gate.querySelector('p').textContent = noClientMessage();
    return;
  }
  const session = await getCloudSession();
  if (!session?.user) return;
  const profile = await getResearchProfile();
  gate.classList.add('jr-hidden');
  form.classList.remove('jr-hidden');
  const account = $('#journal-submit-account');
  if (account) account.textContent = `Signed in as ${profile?.display_name || session.user.email || 'Ephemerent account'}. Your email remains private.`;
  const accountable = $('#accountable-name');
  if (accountable && profile?.display_name) accountable.value = profile.display_name;
  const authors = $('[data-author-list]');
  $$('[data-author-row]', authors).forEach(bindAuthorRow);
  $('#add-author')?.addEventListener('click', () => {
    const template = $('[data-author-row]', authors);
    const row = template.cloneNode(true);
    $$('input', row).forEach((input) => { input.value = ''; });
    $('.jr-author-type', row).value = 'human';
    authors.appendChild(row);
    bindAuthorRow(row);
    $('[name="author_name"]', row)?.focus();
  });
  $('#submission-files')?.addEventListener('change', (event) => showFiles(event.currentTarget));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = $('#journal-submit-msg');
    if (!form.reportValidity()) return;
    const files = Array.from($('#submission-files')?.files || []);
    if (!files.length) return setMessage(message, 'Attach at least one file. Any file type is welcome; the editor will decide what can be published.', 'error');
    const authorsData = readAuthors();
    if (!authorsData.length) return setMessage(message, 'Add at least one author or AI system.', 'error');
    if (files.some((file) => file.size > 50 * 1024 * 1024)) return setMessage(message, 'One of the selected files exceeds the 50 MiB per-file limit.', 'error');
    const data = new FormData(form);
    const holdValue = String(data.get('external_hold') || 'none');
    const externalHold = holdFromValue(holdValue);
    const links = String(data.get('links') || '').split(/\n/).map((link) => safeUrl(link.trim())).filter(Boolean);
    const payload = {
      submitter_id: session.user.id,
      status: 'draft',
      title: String(data.get('title') || '').trim(),
      summary: String(data.get('summary') || '').trim(),
      abstract: String(data.get('abstract') || '').trim() || null,
      article_type: String(data.get('article_type') || 'Research note'),
      keywords: String(data.get('keywords') || '').split(',').map((word) => word.trim()).filter(Boolean).slice(0, 30),
      public_authors: authorsData,
      accountable_name: String(data.get('accountable_name') || '').trim(),
      accountability_declaration: $('#accountability-declaration').checked,
      ai_disclosure: String(data.get('ai_disclosure') || '').trim(),
      funding_statement: String(data.get('funding_statement') || '').trim(),
      conflict_statement: String(data.get('conflict_statement') || '').trim(),
      ethics_statement: String(data.get('ethics_statement') || '').trim(),
      rights_declaration: $('#rights-declaration').checked,
      safety_declaration: $('#safety-declaration').checked,
      publication_declaration: $('#publication-declaration').checked,
      external_publication_hold: externalHold,
      hold_reason: String(data.get('hold_reason') || '').trim() || (holdValue === 'under_review' ? 'Under consideration elsewhere' : null),
      license: String(data.get('license') || 'CC BY 4.0'),
      external_links: links,
      file_note: String($('#submission-file-note')?.value || '').trim(),
    };
    const button = $('#submit-work-button');
    button.disabled = true;
    setMessage(message, 'Saving a private draft and hashing the files…');
    const { data: submission, error: insertError } = await sb.from('research_submissions').insert(payload).select('*').single();
    if (insertError || !submission) {
      button.disabled = false;
      setMessage(message, 'The private record could not be created. The database migration may still need to be applied.', 'error');
      return;
    }
    try {
      await uploadFiles(sb, session, submission.id, files, payload.file_note);
      const { error: updateError } = await sb.from('research_submissions').update({ external_links: links, file_note: payload.file_note }).eq('id', submission.id).eq('submitter_id', session.user.id);
      if (updateError) throw updateError;
      const { data: submitted, error: submitError } = await sb.rpc('submit_research_submission', { p_submission_id: submission.id });
      if (submitError) throw submitError;
      button.disabled = false;
      form.reset();
      $('#submission-file-list').innerHTML = '<span>No files chosen yet.</span>';
      setMessage(message, `Received as ${submitted?.article_id || 'a private submission'}. The editorial queue will review it before publication.`, 'success');
    } catch (uploadError) {
      button.disabled = false;
      setMessage(message, `Draft ${submission.id.slice(0, 8)} is saved, but file intake needs attention: ${uploadError.message}`, 'error');
    }
  });
}

async function createImportedPackage(sb, session, files) {
  const metadataFile = files.find((file) => file.name.split('/').pop() === 'DRFSP_SNCS_Metadata.txt');
  const metadataText = metadataFile ? await metadataFile.text() : '';
  const title = metadataText.match(/^TITLE:\s*(.+)$/m)?.[1]?.trim() || 'Distribution-Robust Functional Subset Projection for Structured Neural Network Width Compression';
  const author = metadataText.match(/^AUTHOR:\s*(.+)$/m)?.[1]?.trim() || 'Kenju Tomita';
  const packageFiles = files.filter((file) => !file.name.endsWith('/'));
  const payload = {
    submitter_id: session.user.id,
    status: 'draft',
    title,
    summary: 'A private first submission imported from the SNCS package. Publication is held until the external journal decision is complete.',
    abstract: metadataText.split(/^ABSTRACT\s*$/m)[1]?.trim() || null,
    article_type: 'Original Research',
    keywords: ['structured neural network compression', 'distribution shift', 'robust optimization', 'functional representations'],
    public_authors: [{ type: 'human', name: author, role: 'Accountable author' }],
    accountable_name: author,
    accountability_declaration: true,
    ai_disclosure: 'AI tools assisted editorial drafting, code review, and experiment orchestration; the accountable author set the questions, implemented and audited the work, and takes responsibility for the record.',
    funding_statement: 'No external funding.',
    conflict_statement: 'The accountable author is founder and owner of Ephemerent LLC; the work is disclosed for editorial review.',
    ethics_statement: 'Synthetic data, public-domain text, public licensed source code, and public pretrained models; no human or animal subjects.',
    rights_declaration: true,
    safety_declaration: true,
    publication_declaration: true,
    external_publication_hold: true,
    hold_reason: 'Hold until the external journal decision is complete.',
    license: 'CC BY 4.0',
    external_links: ['https://github.com/kenjugmail/DR-FSP'],
    file_note: 'Imported from the supplied sncs_submission_package 2 directory. Original filenames and SHA-256 hashes are retained.',
  };
  const { data: submission, error } = await sb.from('research_submissions').insert(payload).select('*').single();
  if (error || !submission) throw error || new Error('Could not create imported submission.');
  await uploadFiles(sb, session, submission.id, packageFiles);
  const { data: submitted, error: submitError } = await sb.rpc('submit_research_submission', { p_submission_id: submission.id });
  if (submitError) throw submitError;
  return submitted || submission;
}

function renderEditorRows(root, submissions, selectedId = '') {
  if (!submissions.length) {
    root.innerHTML = '<div class="jr-empty-row">No private submissions are waiting. The desk is quiet.</div>';
    return;
  }
  root.innerHTML = submissions.map((submission) => `<button type="button" class="jr-editor-row" data-editor-submission="${escapeHtml(submission.id)}"${submission.id === selectedId ? ' aria-current="true"' : ''}>
    <span class="jr-editor-status" data-status="${escapeHtml(submission.status)}">${escapeHtml(STATUS_LABELS[submission.status] || submission.status)}</span>
    <span><span class="jr-editor-row-title">${escapeHtml(submission.title)}</span><p>${escapeHtml(authorLine(submission.public_authors))}</p></span>
    <span class="jr-editor-date jr-mono">${escapeHtml(formatDate(submission.updated_at || submission.created_at))}</span>
    <span class="jr-editor-date jr-mono">${submission.external_publication_hold ? 'External hold' : 'No hold'}</span>
    <span class="jr-editor-arrow" aria-hidden="true">→</span>
  </button>`).join('');
}

async function promotePrivateFiles(sb, session, submission, slug) {
  const { data: privateFiles, error } = await sb.from('research_files').select('*').eq('submission_id', submission.id).eq('visibility', 'private').order('created_at');
  if (error) throw error;
  const { data: versions, error: versionsError } = await sb.from('research_versions').select('version_number').eq('submission_id', submission.id).order('version_number', { ascending: false }).limit(1);
  if (versionsError) throw versionsError;
  const nextVersion = (versions?.[0]?.version_number || 0) + 1;
  const publicFiles = [];
  for (const file of privateFiles || []) {
    const publicPath = `published/${slug}/v${nextVersion}/${filename(file.original_filename)}`;
    const { data: blob, error: downloadError } = await sb.storage.from(file.bucket_id || 'research-private').download(file.storage_path);
    if (downloadError) throw downloadError;
    const { error: uploadError } = await sb.storage.from('research-public').upload(publicPath, blob, { upsert: false, contentType: file.mime_type || 'application/octet-stream' });
    if (uploadError) throw uploadError;
    publicFiles.push({ ...file, bucket_id: 'research-public', storage_path: publicPath, visibility: 'public', created_by: session.user.id });
  }
  return publicFiles;
}

async function renderModeration(sb, submissionId, versionId) {
  const root = $('[data-editor-moderation]');
  const versionIds = Array.isArray(versionId) ? versionId.filter(Boolean) : [versionId].filter(Boolean);
  if (!root || !versionIds.length) return;
  const [commentsResult, reviewsResult] = await Promise.all([
    sb.from('research_comments').select('id,display_name,body,status,created_at').in('version_id', versionIds).order('created_at', { ascending: false }),
    sb.from('research_reviews').select('id,display_name,review_type,reviewer_type,body,status,created_at').in('version_id', versionIds).order('created_at', { ascending: false }),
  ]);
  const items = [
    ...(commentsResult.data || []).map((item) => ({ ...item, kind: 'comment' })),
    ...(reviewsResult.data || []).map((item) => ({ ...item, kind: 'review' })),
  ];
  root.innerHTML = items.length ? items.map((item) => `<div class="jr-moderation-item"><div class="jr-moderation-meta"><span>${escapeHtml(item.kind)} · ${escapeHtml(item.status)}</span><span>${escapeHtml(item.display_name)} · ${escapeHtml(formatDate(item.created_at))}</span></div><p>${escapeHtml(item.body)}</p><div class="jr-editor-actions"><button class="jr-button jr-button-small" type="button" data-moderate-kind="${item.kind}" data-moderate-id="${item.id}" data-moderate-status="published">Approve</button><button class="jr-button jr-button-small jr-button-coral" type="button" data-moderate-kind="${item.kind}" data-moderate-id="${item.id}" data-moderate-status="hidden">Hide</button><button class="jr-button jr-button-small" type="button" data-moderate-kind="${item.kind}" data-moderate-id="${item.id}" data-moderate-status="withdrawn">Withdraw</button></div></div>`).join('') : '<p class="jr-quiet">No discussion records are waiting for moderation.</p>';
  $$('[data-moderate-id]', root).forEach((button) => button.addEventListener('click', async () => {
    const table = button.dataset.moderateKind === 'review' ? 'research_reviews' : 'research_comments';
    const { error } = await sb.from(table).update({ status: button.dataset.moderateStatus }).eq('id', button.dataset.moderateId);
    if (error) {
      return;
    }
    await renderModeration(sb, submissionId, versionIds);
  }));
}

async function loadEditorDetail(sb, session, submission) {
  const detail = $('#editor-detail');
  detail.dataset.open = 'true';
  detail.dataset.submissionId = submission.id;
  $('[data-editor-title]').textContent = submission.title;
  $('[data-editor-declarations]').textContent = [
    `Status: ${STATUS_LABELS[submission.status] || submission.status}`,
    `Accountable submitter: ${submission.accountable_name || 'not supplied'}`,
    `AI disclosure: ${submission.ai_disclosure || 'not supplied'}`,
    `Conflicts: ${submission.conflict_statement || 'not supplied'}`,
    `Ethics and safety: ${submission.ethics_statement || 'not supplied'}`,
    submission.external_publication_hold ? `Hold: ${submission.hold_reason || 'external publication hold'}` : 'External hold: none',
  ].join('\n');
  $('#editor-note').value = submission.editor_note || '';
  $('#editor-next-status').value = submission.status === 'submitted' ? 'screening' : (submission.status === 'screening' ? 'peer_review' : (submission.status === 'published' ? 'retracted' : submission.status));
  $('#editor-notice-type').value = submission.public_notice_type || '';
  $('#editor-public-notice').value = submission.public_notice || '';
  $$('[data-check]', detail).forEach((input) => { input.checked = false; });
  const { data: files } = await sb.from('research_files').select('*').eq('submission_id', submission.id).order('created_at');
  const filesRoot = $('[data-editor-files]');
  filesRoot.innerHTML = (files || []).length ? files.map((file) => `<li class="jr-editor-file"><strong>${escapeHtml(file.original_filename)}</strong><span>${escapeHtml(file.file_role || 'supplement')} · ${escapeHtml(formatBytes(file.byte_size))}</span><small>${escapeHtml(file.sha256 || 'hash pending')}</small></li>`).join('') : '<li><span>No files attached.</span></li>';
  const { data: versions } = await sb.from('research_versions').select('id,version_number,published_at').eq('submission_id', submission.id).order('version_number', { ascending: false });
  const versionIds = (versions || []).map((version) => version.id);
  await renderModeration(sb, submission.id, versionIds);

  const reviewForm = $('[data-editor-review-form]', detail);
  if (reviewForm) reviewForm.onsubmit = async (event) => {
    event.preventDefault();
    const message = $('[data-editor-review-msg]', reviewForm);
    if (!versionIds.length) return setMessage(message, 'Move this submission into peer review first so it has a private version to review.', 'error');
    const data = new FormData(reviewForm);
    const reviewerType = String(data.get('reviewer_type') || 'human_ai');
    const disclosure = String(data.get('ai_disclosure') || '').trim();
    if (reviewerType !== 'human' && !disclosure) return setMessage(message, 'AI-assisted and AI-system reviews need a disclosure.', 'error');
    const { error } = await sb.from('research_reviews').insert({
      version_id: versionIds[0],
      user_id: session.user.id,
      display_name: String(data.get('display_name') || '').trim(),
      review_type: 'Peer review with AI',
      reviewer_type: reviewerType,
      review_stage: 'prepublication',
      body: String(data.get('body') || '').trim(),
      status: 'published',
      ai_disclosure: disclosure,
    });
    if (error) return setMessage(message, 'The peer review could not be recorded. Check the editor role and schema.', 'error');
    reviewForm.reset();
    setMessage(message, 'Peer review recorded and attached to the private version.', 'success');
    await renderModeration(sb, submission.id, versionIds);
  };

  $('#editor-save-state').onclick = async () => {
    const status = $('#editor-next-status').value;
    const note = $('#editor-note').value.trim();
    const checklist = Object.fromEntries($$('[data-check]', detail).map((input) => [input.dataset.check, input.checked]));
    setMessage($('#editor-msg'), 'Saving editorial state…');
    const { error } = await sb.rpc('set_research_submission_status', { p_submission_id: submission.id, p_status: status, p_note: note, p_checklist: checklist, p_public_notice: $('#editor-public-notice').value.trim(), p_notice_type: $('#editor-notice-type').value });
    if (error) {
      setMessage($('#editor-msg'), 'Could not save this state. Check the editor role and schema.', 'error');
      return;
    }
    setMessage($('#editor-msg'), 'State saved and audited.', 'success');
    await loadEditorQueue(sb, session, submission.id);
  };

  $('#editor-publish').onclick = async () => {
    if (submission.external_publication_hold) return setMessage($('#editor-msg'), 'Publication is blocked while the external hold is active.', 'error');
    if (!['accepted', 'published'].includes(submission.status)) return setMessage($('#editor-msg'), 'Move this submission to accepted before publishing.', 'error');
    const publicSlug = slugify(submission.slug || submission.title);
    const button = $('#editor-publish');
    button.disabled = true;
    setMessage($('#editor-msg'), 'Copying approved files into the public bucket…');
    try {
      const publicFiles = await promotePrivateFiles(sb, session, submission, publicSlug);
      const { data: published, error: publishError } = await sb.rpc('publish_research_submission', { p_submission_id: submission.id, p_slug: publicSlug, p_note: $('#editor-note').value.trim(), p_public_notice: $('#editor-public-notice').value.trim(), p_notice_type: $('#editor-notice-type').value });
      if (publishError) throw publishError;
      const { data: version } = await sb.from('research_versions').select('id').eq('submission_id', submission.id).order('version_number', { ascending: false }).limit(1).maybeSingle();
      if (publicFiles.length) {
        const { error: publicFileError } = await sb.from('research_files').insert(publicFiles.map((file) => ({
          submission_id: submission.id,
          version_id: version?.id || null,
          bucket_id: file.bucket_id,
          storage_path: file.storage_path,
          original_filename: file.original_filename,
          file_role: file.file_role,
          mime_type: file.mime_type,
          byte_size: file.byte_size,
          sha256: file.sha256,
          visibility: 'public',
          created_by: session.user.id,
        })));
        if (publicFileError) throw publicFileError;
      }
      setMessage($('#editor-msg'), `Published ${published?.article_id || 'the immutable version'}.`, 'success');
      await loadEditorQueue(sb, session, submission.id);
    } catch (publishError) {
      setMessage($('#editor-msg'), `Publication stopped: ${publishError.message}`, 'error');
    } finally {
      button.disabled = false;
    }
  };
}

async function loadEditorQueue(sb, session, selectedId = '') {
  const root = $('[data-editor-list]');
  root.setAttribute('aria-busy', 'true');
  const { data, error } = await sb.from('research_submissions').select('*').order('updated_at', { ascending: false });
  if (error) {
    root.innerHTML = `<div class="jr-empty-row jr-error">${escapeHtml(noClientMessage())}</div>`;
    root.removeAttribute('aria-busy');
    return;
  }
  const submissions = data || [];
  renderEditorRows(root, submissions, selectedId);
  root.removeAttribute('aria-busy');
  $$('[data-editor-submission]', root).forEach((row) => row.addEventListener('click', () => {
    const submission = submissions.find((item) => item.id === row.dataset.editorSubmission);
    if (submission) {
      $$('[data-editor-submission]', root).forEach((item) => item.removeAttribute('aria-current'));
      row.setAttribute('aria-current', 'true');
      loadEditorDetail(sb, session, submission);
    }
  }));
  if (selectedId) {
    const selected = submissions.find((item) => item.id === selectedId);
    if (selected) await loadEditorDetail(sb, session, selected);
  }
}

async function mountEditor() {
  const shell = $('#journal-editor-shell');
  const gate = $('#journal-editor-auth-gate');
  if (!shell || !gate) return;
  const sb = await clientOrNull();
  if (!sb) {
    gate.querySelector('p').textContent = noClientMessage();
    return;
  }
  const session = await getCloudSession();
  if (!session?.user) return;
  const profile = await getResearchProfile();
  if (!profile?.research_editor && !profile?.is_admin) {
    gate.querySelector('strong').textContent = 'Editor role required';
    gate.querySelector('p').textContent = 'This account can submit research, but it has not been granted the separate research-editor role.';
    return;
  }
  gate.classList.add('jr-hidden');
  shell.classList.remove('jr-hidden');
  await loadEditorQueue(sb, session);
  $('#editor-refresh')?.addEventListener('click', () => loadEditorQueue(sb, session));
  $('#editor-import-package')?.addEventListener('click', () => $('#editor-package-input')?.click());
  $('#editor-package-input')?.addEventListener('change', async (event) => {
    const files = Array.from(event.currentTarget.files || []);
    if (!files.length) return;
    const message = $('#editor-msg');
    setMessage(message, 'Importing the selected package into private staging…');
    try {
      const submission = await createImportedPackage(sb, session, files);
      setMessage(message, `Private package staged as ${submission.article_id || 'a submitted record'} with external hold.`, 'success');
      await loadEditorQueue(sb, session, submission.id);
    } catch (importError) {
      setMessage(message, `Package import stopped: ${importError.message}`, 'error');
    } finally {
      event.currentTarget.value = '';
    }
  });
}

mountJournalNavigation();
if (page === 'index') renderIndex();
if (page === 'article') renderArticle();
if (page === 'submit') mountSubmit();
if (page === 'editor') mountEditor();
