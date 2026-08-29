#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.BASE ?? "http://127.0.0.1:3111";
const manifestPattern = "**/assets/hearthrail-release.json";
const futureRelease = {
  schemaVersion: 1,
  product: "hearthrail",
  status: "released",
  version: "0.1.0-alpha.2",
  publishedAt: "2026-08-28T12:00:00Z",
  notesUrl: "https://ephemerent.com/hearthrail/releases/0.1.0-alpha.2",
  assets: [{
    platform: "macos-arm64",
    filename: "Hearthrail-0.1.0-alpha.2-arm64.dmg",
    url: "https://downloads.ephemerent.com/Hearthrail-0.1.0-alpha.2-arm64.dmg",
    sha256: "a".repeat(64),
    sizeBytes: 76679134,
  }],
};

const browser = await chromium.launch();
const failures = [];
const check = async (name, run) => {
  try { await run(); }
  catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`); }
};

await check("JavaScript-disabled fallback", async () => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${base}/hearthrail`, { waitUntil: "load" });
  assert.match(await page.locator("[data-hearthrail-release]").innerText(), /Installers are not public yet/);
  assert.equal(await page.locator("[data-hearthrail-release] a[href]").count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360);
  await context.close();
});

for (const [name, route] of [
  ["manifest fetch failure", (request) => request.abort()],
  ["invalid manifest", (request) => request.fulfill({ status: 200, contentType: "application/json", body: "{}" })],
]) {
  await check(name, async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.route(manifestPattern, route);
    await page.goto(`${base}/hearthrail`, { waitUntil: "load" });
    await page.waitForTimeout(100);
    assert.equal(await page.locator("[data-hearthrail-release] a[href]").count(), 0);
    assert.match(await page.locator("[data-hearthrail-release]").innerText(), /Installers are not public yet/);
    await context.close();
  });
}

await check("valid future release", async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.route(manifestPattern, (request) => request.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(futureRelease) }));
  await page.goto(`${base}/hearthrail`, { waitUntil: "load" });
  const link = page.getByRole("link", { name: "Download for macOS (Apple Silicon)" });
  await link.waitFor({ state: "visible" });
  assert.equal(await link.getAttribute("href"), futureRelease.assets[0].url);
  assert.match(await page.locator("[data-hearthrail-release]").innerText(), /SHA-256 a{64}/);
  assert.equal(await page.locator("[data-hearthrail-release]").getAttribute("data-release-state"), "released");
  await context.close();
});

for (const mode of ["dark", "light"]) {
  for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    await check(`${mode} ${viewport.width}x${viewport.height}`, async () => {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      await context.addInitScript((selected) => {
        localStorage.setItem("eph-mode", selected);
        localStorage.setItem("eph-material", "flat");
      }, mode);
      const page = await context.newPage();
      const errors = [];
      const external = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.origin !== new URL(base).origin) external.push(request.url());
      });
      await page.goto(`${base}/hearthrail`, { waitUntil: "load" });
      await page.waitForTimeout(120);
      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        bodyMargin: getComputedStyle(document.body).margin,
        brandDisplay: getComputedStyle(document.querySelector(".ebrand")).display,
        headerHeight: Math.round(document.querySelector(".hr-nav").getBoundingClientRect().height),
        shotTop: Math.round(document.querySelector(".hr-product-shot").getBoundingClientRect().top),
        underlinedLinks: [...document.querySelectorAll(".hr-nav a, .utility-footer a")].filter((element) => getComputedStyle(element).textDecorationLine !== "none").length,
        navRuleDisplay: getComputedStyle(document.querySelector("#hearthrail-navigation a"), "::after").display,
      }));
      assert.equal(layout.scrollWidth, viewport.width);
      assert.equal(layout.bodyMargin, "0px");
      assert.equal(layout.brandDisplay, "flex");
      assert.equal(layout.underlinedLinks, 0);
      assert.equal(layout.navRuleDisplay, "none");
      if (viewport.width === 360) assert.ok(layout.shotTop <= 730, `real product shot starts at ${layout.shotTop}px on phone`);
      if (viewport.width === 1280) {
        assert.ok(layout.headerHeight <= 70, `desktop header is ${layout.headerHeight}px tall`);
        assert.ok(layout.shotTop <= 650, `real product shot starts at ${layout.shotTop}px on desktop`);
      }
      assert.equal(await page.locator("[data-hearthrail-release] a[href]").count(), 0);
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      const image = page.locator(".hr-product-shot img");
      assert.deepEqual(await image.evaluate((element) => [element.naturalWidth, element.naturalHeight]), [1280, 800]);
      await context.close();
    });
  }
}

await browser.close();
if (failures.length) {
  console.error(`check-hearthrail-browser: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log("check-hearthrail-browser: fail-closed release states and 8 viewport/theme cases pass");
