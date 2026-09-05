#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateHearthrailRelease } from "../assets/hearthrail.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(join(root, "assets/hearthrail-release.json"), "utf8"));
const page = await readFile(join(root, "Hearthrail.html"), "utf8");
const home = await readFile(join(root, "Ephemerent.html"), "utf8");
const orreryDownload = await readFile(join(root, "download.html"), "utf8");
const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
const vercel = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
const release = validateHearthrailRelease(manifest);
const ownedFiles = ["Hearthrail.html", "assets/hearthrail.css", "assets/hearthrail.js", "assets/hearthrail-release.json", "assets/hearthrail-launcher-1280x800.jpg"];
const sharedFiles = ["assets/tokens.css", "assets/glass.css", "assets/glass.js", "assets/base.css", "assets/polish.css", "assets/mode.js", "assets/motion.js", "assets/favicon.svg", "site.webmanifest", "assets/fonts/newsreader-latin.woff2", "assets/fonts/hanken-grotesk-latin.woff2", "assets/fonts/ibm-plex-mono-400-latin.woff2", "assets/fonts/ibm-plex-mono-500-latin.woff2"];
const bytes = async (files) => (await Promise.all(files.map((file) => readFile(join(root, file))))).reduce((total, value) => total + value.length, 0);
const ownedBytes = await bytes(ownedFiles);
const totalBytes = ownedBytes + await bytes(sharedFiles);
const screenshot = await readFile(join(root, "assets/hearthrail-launcher-1280x800.jpg"));
const socialPreview = await readFile(join(root, "assets/og-hearthrail.jpg"));

function jpegDimensions(value) {
  if (value[0] !== 0xff || value[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 8 < value.length) {
    if (value[offset] !== 0xff) { offset += 1; continue; }
    while (value[offset] === 0xff) offset += 1;
    const marker = value[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = value.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return [value.readUInt16BE(offset + 5), value.readUInt16BE(offset + 3)];
    }
    if (length < 2) break;
    offset += length;
  }
  return undefined;
}

assert.equal(release?.status, "released", "the public preview must have a valid release manifest");
assert.equal(release.channel, "community-alpha");
assert.equal(release.version, "0.1.0-alpha.1");
assert.equal(release.assets.length, 1, "only the reviewed Mac preview is available");
const mac = release.assets[0];
assert.equal(mac.platform, "macos-arm64");
assert.equal(mac.signing, "ad-hoc");
assert.equal(mac.notarized, false);
assert.equal(mac.sizeBytes, 25342168);
assert.equal(mac.sha256, "b5c1329e25e4c3e126931e82bb3e32f11e9ee07f9c16047efc2befe16f99c376");
assert.equal(mac.url, "https://github.com/kenjugmail/hearthrail-releases/releases/download/v0.1.0-alpha.1-lan-preview/Hearthrail_0.1.0-alpha.1_aarch64.dmg");
const staticCard = page.slice(page.indexOf('<div class="hr-release-card"'), page.indexOf('<figure class="hr-product-shot'));
assert.ok(staticCard.includes(`href="${mac.url}"`), "no-JS fallback must use the same reviewed asset");
assert.ok(staticCard.includes(mac.sha256));
assert.ok(staticCard.includes(`href="${release.notesUrl}"`));
assert.match(staticCard, /Not notarized by Apple/);
assert.match(staticCard, /Windows is not available/);
assert.doesNotMatch(page, /installers are not public yet|No downloads published yet/i);
assert.match(page, /aria-live="polite"/);
assert.match(page, /name="twitter:image:alt"/);
assert.match(page, /rel="canonical" href="https:\/\/ephemerent\.com\/hearthrail"/);
assert.match(page, /property="og:image" content="https:\/\/ephemerent\.com\/assets\/og-hearthrail\.jpg"/);
assert.match(page, /property="og:image:type" content="image\/jpeg"/);
assert.match(page, /property="og:image:width" content="1200"/);
assert.match(page, /property="og:image:height" content="630"/);
assert.match(page, /name="twitter:image" content="https:\/\/ephemerent\.com\/assets\/og-hearthrail\.jpg"/);
assert.match(page, /decoding="async" fetchpriority="high"/);
assert.match(page, /src="\/assets\/hearthrail-launcher-1280x800\.jpg"/);
assert.doesNotMatch(page, /hearthrail-launcher-1280x800\.png/);
assert.equal((home.match(/class="eprodrow" href="\/hearthrail"/g) ?? []).length, 1, "the Ephemerent product index must link Hearthrail exactly once");
assert.match(home, /href="\/hearthrail"[\s\S]{0,700}Mac alpha/);
assert.match(sitemap, /<loc>https:\/\/ephemerent\.com\/hearthrail<\/loc>/);
assert.ok(vercel.rewrites?.some((entry) => entry.source === "/hearthrail" && entry.destination === "/Hearthrail.html"));
assert.ok(vercel.redirects?.some((entry) => entry.source === "/Hearthrail.html" && entry.destination === "/hearthrail" && entry.permanent === true));
assert.match(orreryDownload, /id="orrery-download-btn"/);
assert.doesNotMatch(orreryDownload, /data-hearthrail-release|hearthrail-release\.json/i, "Orrery's existing download flow must stay separate");
assert.equal(createHash("sha256").update(screenshot).digest("hex"), "1906296fdef365e54165d96b387f3a8a1e95e4ddf2b3960e8c3f0a173a8f900b", "the real launcher capture changed without updating its provenance gate");
assert.deepEqual(jpegDimensions(screenshot), [1280, 800]);
assert.equal(createHash("sha256").update(socialPreview).digest("hex"), "88c0966c4f211bb11c1b6993222902a456dbbc9c6af99f6cb18f96fab74c6f0f", "the real social capture changed without updating its provenance gate");
assert.deepEqual(jpegDimensions(socialPreview), [1200, 630]);
assert.ok(ownedBytes <= 102400, `Hearthrail-owned raw assets grew past 100 KiB (${ownedBytes} bytes)`);
assert.ok(totalBytes <= 358400, `Hearthrail plus shared first-load raw assets grew past 350 KiB (${totalBytes} bytes)`);
console.log(`hearthrail release gate: PASS · owned ${ownedBytes} B · total raw ${totalBytes} B · social ${socialPreview.length} B`);
