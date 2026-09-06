#!/usr/bin/env node
import { chromium } from "playwright";

const base = process.env.BASE || "http://localhost:3111";
const browser = await chromium.launch({ headless: true });
const fail = (message) => { throw new Error(message); };
const viewports = [{ width: 1440, height: 900 }, { width: 900, height: 720 }, { width: 768, height: 1024 }, { width: 390, height: 844 }];

function luminance(color) {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) fail(`cannot parse color ${color}`);
  return channels.map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
}

function contrast(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + .05) / (dark + .05);
}

try {
  for (const mode of ["dark", "light"]) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript((nextMode) => {
        localStorage.setItem("eph-mode", nextMode);
        localStorage.setItem("eph-material", nextMode === "dark" ? "glass" : "flat");
      }, mode);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      await page.goto(`${base}/`, { waitUntil: "load" });
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await page.evaluate(() => {
          const step = document.querySelector('[data-story-step="3"]');
          const pin = document.querySelector(".ehero-story-pin");
          if (!step) return;
          const rect = step.getBoundingClientRect();
          const anchor = innerWidth > 900 ? innerHeight * .51 : Math.min(innerHeight * .82, (pin?.getBoundingClientRect().bottom || innerHeight * .48) + 145);
          scrollBy(0, rect.top + rect.height * .55 - anchor);
        });
        await page.waitForTimeout(180);
      }
      const metrics = await page.evaluate(() => {
        const scene = document.querySelector("[data-emergence-scene]");
        const frame = document.querySelector(".ehero-story-viewport")?.getBoundingClientRect();
        const panel = document.querySelector(".ehero-release-copy")?.getBoundingClientRect();
        const panelStyle = getComputedStyle(document.querySelector(".ehero-release-copy"));
        const titleStyle = getComputedStyle(document.querySelector(".ehero-release-copy strong"));
        const imageStyle = getComputedStyle(document.querySelector(".ehero-release-frame img"));
        return {
          current: scene?.getAttribute("data-story-current"),
          frame,
          panel,
          panelBackground: panelStyle.backgroundColor,
          titleColor: titleStyle.color,
          imageOpacity: Number(imageStyle.opacity),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      if (metrics.current !== "3") fail(`${mode} ${viewport.width}x${viewport.height}: release state did not activate`);
      if (!metrics.frame || !metrics.panel) fail(`${mode} ${viewport.width}x${viewport.height}: release geometry missing`);
      const heightRatio = metrics.panel.height / metrics.frame.height;
      const widthRatio = metrics.panel.width / metrics.frame.width;
      const maximumHeight = viewport.width <= 480 ? .90 : .80;
      const maximumWidth = viewport.width <= 480 ? .96 : viewport.width <= 760 ? .72 : .58;
      if (heightRatio > maximumHeight) fail(`${mode} ${viewport.width}x${viewport.height}: release panel consumes ${(heightRatio * 100).toFixed(1)}% of the plate height`);
      if (widthRatio > maximumWidth) fail(`${mode} ${viewport.width}x${viewport.height}: release panel consumes ${(widthRatio * 100).toFixed(1)}% of the plate width`);
      if (metrics.imageOpacity < .8) fail(`${mode} ${viewport.width}x${viewport.height}: release photograph is too faint (${metrics.imageOpacity})`);
      const titleContrast = contrast(metrics.panelBackground, metrics.titleColor);
      if (titleContrast < 4.5) fail(`${mode} ${viewport.width}x${viewport.height}: release title contrast is ${titleContrast.toFixed(2)}:1`);
      if (metrics.overflow > 1) fail(`${mode} ${viewport.width}x${viewport.height}: horizontal overflow ${metrics.overflow}px`);
      if (errors.length) fail(`${mode} ${viewport.width}x${viewport.height}: ${errors.join(" | ")}`);
      await context.close();
    }
  }
  console.log("check-home-release: 8 release compositions pass geometry, contrast, image-presence, console, and overflow gates");
} finally {
  await browser.close();
}
