/**
 * Phase 7 verification: full sweep of every rebuilt route.
 * For each route: HTTP status, document title, console errors, viewport
 * screenshot at 1280 (screenshots/p7-<name>-1280.png); key pages also at 375.
 * Run against :3111 (dev for visuals, prod for timing).
 */
import { chromium } from "playwright-core";
import { resolveChromiumPath } from "./lib/browser.mjs";

const BASE = process.env.P7_BASE ?? "http://localhost:3111";
const OUT = "screenshots";

const ROUTES = [
  ["process", "/process", true],
  ["contact", "/contact", true],
  ["faq", "/faq", false],
  ["search", "/search?q=resin", false],
  ["workshops", "/workshops", false],
  ["blog", "/blog", true],
  ["portfolio", "/portfolio", true],
  ["privacy", "/privacy", false],
  ["terms", "/terms", false],
  ["wishlist", "/shop/wishlist", false],
  ["404", "/definitely-not-a-page", false],
];

const bin = resolveChromiumPath();
const browser = await chromium.launch({
  executablePath: bin,
  args: ["--no-sandbox"],
});

/* detail pages resolved from the DB-fed indexes at runtime */
async function firstLink(page, selector) {
  return page.evaluate((sel) => {
    const a = document.querySelector(sel);
    return a ? a.getAttribute("href") : null;
  }, selector);
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const consoleErrors = [];
p.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 160));
});

const dynamicRoutes = [];
for (const [name, path, alsoMobile] of ROUTES) {
  const res = await p.goto(`${BASE}${path}`, {
    waitUntil: "networkidle",
    timeout: 240000,
  });
  await p.waitForTimeout(900);
  const title = await p.title();
  console.log(`[${name}] ${res?.status()} "${title.slice(0, 60)}"`);
  await p.screenshot({ path: `${OUT}/p7-${name}-1280.png` });

  if (name === "blog") {
    const href = await firstLink(p, 'a[href*="/blog/"]:not([href$="/blog"])');
    if (href) dynamicRoutes.push(["blog-post", href]);
  }
  if (name === "portfolio") {
    const href = await firstLink(
      p,
      'a[href*="/portfolio/"]:not([href$="/portfolio"])',
    );
    if (href) dynamicRoutes.push(["portfolio-case", href]);
  }
  if (alsoMobile) {
    // captured in the mobile pass below
  }
}
for (const [name, path] of dynamicRoutes) {
  const res = await p.goto(`${BASE}${path}`, {
    waitUntil: "networkidle",
    timeout: 240000,
  });
  await p.waitForTimeout(900);
  console.log(`[${name}] ${res?.status()} "${(await p.title()).slice(0, 60)}" ${path}`);
  await p.screenshot({ path: `${OUT}/p7-${name}-1280.png` });
}
await ctx.close();

/* 375 pass for the storytelling-heavy pages */
const ctxM = await browser.newContext({
  viewport: { width: 375, height: 720 },
  hasTouch: true,
  isMobile: true,
});
const pM = await ctxM.newPage();
for (const [name, path] of [
  ["process", "/process"],
  ["contact", "/contact"],
  ["blog", "/blog"],
  ["portfolio", "/portfolio"],
]) {
  await pM.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 240000 });
  await pM.waitForTimeout(900);
  await pM.screenshot({ path: `${OUT}/p7-${name}-375.png` });
}
await ctxM.close();
await browser.close();

if (consoleErrors.length) {
  console.log(`[console] ${consoleErrors.length} errors:`);
  for (const e of [...new Set(consoleErrors)].slice(0, 12)) console.log("  -", e);
} else {
  console.log("[console] clean");
}
console.log("[e2e] phase 7 sweep complete");
