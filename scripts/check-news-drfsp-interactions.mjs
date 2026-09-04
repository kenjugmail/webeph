#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const mime = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://local").pathname);
  const relative = normalize(pathname.replace(/^\/+/, ""));
  if (relative.startsWith("..")) { response.writeHead(403).end(); return; }
  try {
    const file = await readFile(join(root, relative || "news-drfsp.html"));
    response.writeHead(200, { "content-type": `${mime[extname(relative)] ?? "application/octet-stream"}; charset=utf-8` });
    response.end(file);
  } catch {
    response.writeHead(404).end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const fail = (message) => { throw new Error(message); };

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 900, height: 720 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${base}/news-drfsp.html`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) fail(`News overflows by ${overflow}px at ${viewport.width}x${viewport.height}`);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const writes = [];
  page.on("request", (request) => { if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  await page.goto(`${base}/news-drfsp.html#rare-musician`, { waitUntil: "networkidle" });
  const explorer = page.locator("[data-risk-explorer]");
  if (!await explorer.evaluate((element) => element.inert)) fail("risk result is visible before prediction");
  await page.getByRole("button", { name: "Frequency-first", exact: true }).click();
  if (await explorer.evaluate((element) => element.inert)) fail("risk result did not unlock after prediction");
  if (await page.locator("[data-risk-value]").textContent() !== "Frequency-first") fail("5% mean checkpoint failed");
  await page.getByRole("slider", { name: "Code prevalence" }).fill("15");
  if (await page.locator("[data-risk-value]").textContent() !== "Robust capacity") fail("15% mean checkpoint failed");
  await page.getByRole("button", { name: "Worst room", exact: true }).click();
  if (await page.locator("[data-risk-value]").textContent() !== "Robust capacity") fail("worst-room checkpoint failed");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  if (!await explorer.evaluate((element) => element.inert)) fail("reset did not restore prediction gate");

  await page.getByRole("button", { name: "Layer 8", exact: true }).click();
  await page.getByRole("button", { name: "60%", exact: true }).click();
  const values = await page.locator("[data-gpt-method] output").allTextContents();
  if (JSON.stringify(values) !== JSON.stringify(["11.98 ± 4.08", "13.38 ± 5.47", "14.47 ± 5.80"])) fail(`unexpected exact GPT-2 checkpoint: ${values.join(" / ")}`);
  if (writes.length) fail(`interaction made network writes: ${writes.join(", ")}`);
  await page.close();

  const noJs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await noJs.goto(`${base}/news-drfsp.html#rare-musician`, { waitUntil: "load" });
  if (await noJs.locator(".nw-risk-static-table tbody tr").count() !== 2) fail("no-JS risk table is incomplete");
  if (await noJs.locator(".nw-gpt-ledger tbody tr").count() !== 9) fail("no-JS GPT-2 ledger is incomplete");
  const noJsOverflow = await noJs.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (noJsOverflow > 1) fail(`no-JS News overflows by ${noJsOverflow}px on mobile`);
  await noJs.close();

  const reduced = await browser.newPage({ reducedMotion: "reduce" });
  await reduced.goto(`${base}/news-drfsp.html#rare-musician`, { waitUntil: "load" });
  const transition = await reduced.locator(".nw-risk-row > i b").first().evaluate((element) => getComputedStyle(element).transitionDuration);
  if (Number.parseFloat(transition) > 0.001) fail(`reduced-motion risk transition remains ${transition}`);
  await reduced.close();

  console.log("check-news-drfsp-interactions: 5 viewports, prediction/reset, exact GPT-2 points, no writes, no-JS, and reduced motion pass");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
