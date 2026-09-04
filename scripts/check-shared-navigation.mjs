#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.BASE ?? "http://127.0.0.1:3111";
const routes = ["/", "/research", "/orrery", "/hearthrail", "/vellum", "/vespera", "/shelterix", "/arbiter", "/organizations", "/privacy", "/journal", "/news"];
const browser = await chromium.launch();
const failures = [];

for (const route of routes) {
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem("eph-mode", "dark");
      localStorage.setItem("eph-material", "flat");
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}${route}`, { waitUntil: "load" });

    const menu = page.locator(".menu-toggle, .jr-menu-button, .nw-menu-button").first();
    await menu.waitFor({ state: "visible" });
    const controls = await menu.getAttribute("aria-controls");
    assert.ok(controls, `${route}: menu has no aria-controls`);
    await menu.click();
    await page.waitForTimeout(240);
    assert.equal(await menu.getAttribute("aria-expanded"), "true", `${route}: menu did not open`);
    assert.equal(await page.locator(`#${controls}`).isVisible(), true, `${route}: controlled navigation is not visible`);
    assert.equal(await page.locator("main").getAttribute("inert"), "", `${route}: page did not become inert`);
    await page.keyboard.press("Escape");
    assert.equal(await menu.getAttribute("aria-expanded"), "false", `${route}: Escape did not close menu`);
    assert.equal(await page.locator("main").getAttribute("inert"), null, `${route}: inert state was not released`);
    assert.equal(await menu.evaluate((element) => document.activeElement === element), true, `${route}: focus did not return to Menu`);

    const look = page.locator(".mode-toggle");
    await look.waitFor({ state: "visible" });
    await look.click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.mode), "dark", `${route}: glass changed the face`);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.material), "glass", `${route}: glass material did not activate`);
    assert.match(await look.getAttribute("aria-label") ?? "", /Appearance: liquid glass/, `${route}: appearance label did not update`);
    await look.click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.mode), "light", `${route}: light face did not activate`);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.material ?? "flat"), "flat", `${route}: light face retained glass`);

    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, `${route}: horizontal overflow`);
    assert.deepEqual(errors, [], `${route}: console errors`);
    await context.close();
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

for (const route of ["/", "/hearthrail", "/journal", "/news"]) {
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${base}${route}`, { waitUntil: "load" });
    assert.equal(await page.locator("main").isVisible(), true, `${route}: no-JS main is hidden`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, `${route}: no-JS horizontal overflow`);
    await context.close();
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

await browser.close();
if (failures.length) {
  console.error(`check-shared-navigation: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`check-shared-navigation: ${routes.length} mobile menus/look controls and 4 no-JS shells pass`);
