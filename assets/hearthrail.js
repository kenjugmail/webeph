const PLATFORMS = Object.freeze({
  "macos-arm64": { label: "macOS", arch: "Apple Silicon", extensions: [".dmg"], filenameToken: /(?:arm64|aarch64|apple[-_.]?silicon)/i },
  "windows-x64": { label: "Windows", arch: "x64", extensions: [".msi", ".exe"], filenameToken: /(?:windows?|win|x64|amd64)/i },
});

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function credentialFreeHttps(value) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "" && !url.hostname.endsWith(".invalid") ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function validateHearthrailRelease(value) {
  if (!isObject(value) || value.schemaVersion !== 1 || value.product !== "hearthrail") return undefined;
  if (value.status === "private-alpha") {
    if (value.version !== null || value.publishedAt !== null || value.notesUrl !== null) return undefined;
    if (!Array.isArray(value.assets) || value.assets.length !== 0) return undefined;
    return { schemaVersion: 1, product: "hearthrail", status: "private-alpha", version: null, publishedAt: null, notesUrl: null, assets: [] };
  }
  if (value.status !== "released") return undefined;
  if (value.channel !== undefined && value.channel !== "community-alpha") return undefined;
  const community = value.channel === "community-alpha";
  if (typeof value.version !== "string" || !/^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(value.version)) return undefined;
  if (typeof value.publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.publishedAt) || !Number.isFinite(Date.parse(value.publishedAt))) return undefined;
  const notesUrl = credentialFreeHttps(value.notesUrl);
  if (!notesUrl || !Array.isArray(value.assets) || value.assets.length < 1 || value.assets.length > 2) return undefined;

  const seen = new Set();
  const assets = [];
  for (const candidate of value.assets) {
    if (!isObject(candidate) || typeof candidate.platform !== "string" || !(candidate.platform in PLATFORMS) || seen.has(candidate.platform)) return undefined;
    const platform = PLATFORMS[candidate.platform];
    if (community && (candidate.platform !== "macos-arm64" || candidate.signing !== "ad-hoc" || candidate.notarized !== false)) return undefined;
    if (typeof candidate.filename !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._+-]{7,159}$/.test(candidate.filename)) return undefined;
    if (!platform.extensions.some((extension) => candidate.filename.toLowerCase().endsWith(extension.toLowerCase()))) return undefined;
    if (!/^Hearthrail[-_.]/i.test(candidate.filename) || !candidate.filename.includes(value.version) || !platform.filenameToken.test(candidate.filename)) return undefined;
    const url = credentialFreeHttps(candidate.url);
    if (!url || typeof candidate.sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(candidate.sha256)) return undefined;
    if (!Number.isSafeInteger(candidate.sizeBytes) || candidate.sizeBytes <= 0) return undefined;
    try {
      if (decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "") !== candidate.filename) return undefined;
    } catch {
      return undefined;
    }
    seen.add(candidate.platform);
    assets.push({ platform: candidate.platform, filename: candidate.filename, url, sha256: candidate.sha256.toLowerCase(), sizeBytes: candidate.sizeBytes, ...(community ? { signing: "ad-hoc", notarized: false } : {}) });
  }
  return { schemaVersion: 1, product: "hearthrail", status: "released", ...(community ? { channel: "community-alpha" } : {}), version: value.version, publishedAt: new Date(value.publishedAt).toISOString(), notesUrl, assets };
}

export async function loadHearthrailRelease(fetcher = fetch) {
  try {
    const response = await fetcher("/assets/hearthrail-release.json", { credentials: "same-origin", cache: "no-cache" });
    if (!response?.ok) return undefined;
    return validateHearthrailRelease(await response.json());
  } catch {
    return undefined;
  }
}

function megabytes(sizeBytes) {
  return `${(sizeBytes / 1_000_000).toFixed(1)} MB`;
}

export function renderHearthrailRelease(container, release) {
  release = validateHearthrailRelease(release);
  if (!(container instanceof HTMLElement) || release?.status !== "released") return false;
  const heading = document.createElement("div");
  const status = document.createElement("span");
  status.className = "hr-status";
  status.textContent = `Version ${release.version}`;
  const title = document.createElement("strong");
  title.textContent = release.channel === "community-alpha" ? "Experimental Mac LAN preview" : "Release downloads";
  heading.append(status, title);

  const list = document.createElement("div");
  list.className = "hr-release-assets";
  for (const asset of release.assets) {
    const platform = PLATFORMS[asset.platform];
    const item = document.createElement("div");
    item.className = "hr-release-asset";
    const link = document.createElement("a");
    link.className = "hr-download-link";
    link.href = asset.url;
    link.rel = "noopener";
    link.referrerPolicy = "no-referrer";
    link.textContent = `Download for ${platform.label} (${platform.arch})`;
    const meta = document.createElement("div");
    meta.className = "hr-release-asset-meta";
    const filename = document.createElement("span");
    filename.textContent = asset.filename;
    const size = document.createElement("span");
    size.textContent = megabytes(asset.sizeBytes);
    meta.append(filename, size);
    const checksum = document.createElement("code");
    checksum.textContent = `SHA-256 ${asset.sha256}`;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `File details · ${megabytes(asset.sizeBytes)}`;
    details.append(summary, meta, checksum);
    item.append(link, details);
    list.append(item);
  }
  const notes = document.createElement("a");
  notes.className = "hr-release-notes";
  notes.href = release.notesUrl;
  notes.rel = "noopener";
  notes.referrerPolicy = "no-referrer";
  notes.textContent = "Release notes and limits";
  const warning = document.createElement("p");
  warning.className = "hr-release-detail";
  warning.textContent = "Not notarized by Apple; macOS may block opening. Windows is not available.";
  container.replaceChildren(heading, list, ...(release.channel === "community-alpha" ? [warning] : []), notes);
  container.dataset.releaseState = "released";
  return true;
}

export async function mountHearthrailRelease() {
  const container = document.querySelector("[data-hearthrail-release]");
  if (!container) return;
  // The reviewed static fallback works without JS. With JS, suspend those
  // links until the current manifest validates, including after a withdrawal.
  for (const link of container.querySelectorAll("a")) link.removeAttribute("href");
  const release = await loadHearthrailRelease();
  if (release?.status === "released") {
    renderHearthrailRelease(container, release);
  } else {
    const status = document.createElement("strong");
    status.textContent = release?.status === "private-alpha" ? "Installers are not public yet." : "Downloads are temporarily unavailable.";
    container.replaceChildren(status);
    container.dataset.releaseState = release?.status ?? "unavailable";
  }
}

if (typeof document !== "undefined") void mountHearthrailRelease();
