/**
 * Part 0 audit crawler (guide §0.2, adapted to this repo).
 * Crawls the storefront's real route shapes on a mobile profile and records:
 * status, console errors, failed requests, broken/alt-less images, h1 count,
 * title/description/canonical, horizontal overflow, WhatsApp CTA count, and
 * axe WCAG 2 A/AA violations. Failed requests to hosts the sandbox proxy
 * blocks are tagged sandboxBlocked so they don't read as site defects.
 * Run against a production server: BASE=http://localhost:3111 node scripts/audit-crawl.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { AxeBuilder } from "@axe-core/playwright";
import { resolveChromiumPath } from "./lib/browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3111";
const SANDBOX_BLOCKED =
  /resinartsjaipur\.com|leoberrygifts\.com|kanhakreation\.com|wp\.com|_vercel\//;

const ROUTES = [
  "/",
  "/shop",
  "/product/hot-pink-pla-filament",
  "/blog",
  "/blog/3d-printed-architectural-models-business-displays",
  "/portfolio",
  "/portfolio/case-resin-tray-set-serving-trays",
  "/about",
  "/contact",
  "/faq",
  "/search",
  "/custom-order",
  "/workshops",
  "/process",
  "/privacy",
  "/terms",
  "/does-not-exist-audit",
  "/ar", // RTL spot check
  "/hi", // second-locale spot check
];

const bin = resolveChromiumPath();
const browser = await chromium.launch({ executablePath: bin, args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 393, height: 851 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2.75,
});

mkdirSync("audit", { recursive: true });
const rows = [];

for (const route of ROUTES) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  const failed = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("requestfailed", (r) => failed.push(r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });

  let status = 0;
  try {
    const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 240000 });
    status = res?.status() ?? 0;
  } catch {
    status = -1;
  }
  await page.waitForTimeout(800);

  const meta = await page.evaluate(() => ({
    h1: document.querySelectorAll("h1").length,
    title: document.title,
    description:
      document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    canonical:
      document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
    jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
    dir: document.documentElement.getAttribute("dir") ?? "",
    lang: document.documentElement.getAttribute("lang") ?? "",
    imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
    brokenImgs: [...document.images]
      .filter((i) => i.complete && i.naturalWidth === 0 && i.src)
      .map((i) => i.src.slice(0, 120)),
    overflowX:
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    waCtas: document.querySelectorAll('a[href*="wa.me"],a[href*="whatsapp"]').length,
    skipTarget: Boolean(document.getElementById("main-content")),
  }));

  let axeViolations = [];
  try {
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    axeViolations = axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.target?.[0] ?? "",
    }));
  } catch (e) {
    axeViolations = [{ id: "axe-run-failed", impact: "n/a", nodes: 0, sample: String(e).slice(0, 100) }];
  }

  const realFailed = failed.filter((f) => !SANDBOX_BLOCKED.test(f));
  const sandboxFailed = failed.length - realFailed.length;
  const realBroken = meta.brokenImgs.filter((s) => !SANDBOX_BLOCKED.test(s));

  rows.push({
    route,
    status,
    ...meta,
    brokenImgs: realBroken,
    sandboxBlockedRequests: sandboxFailed,
    consoleErrors: consoleErrors.filter((c) => !SANDBOX_BLOCKED.test(c)),
    failed: realFailed.map((f) => f.slice(0, 140)),
    axeViolations,
  });
  console.log(
    `${route} → ${status} h1=${meta.h1} axe=${axeViolations.length} err=${rows.at(-1).consoleErrors.length} fail=${realFailed.length} broken=${realBroken.length} overflow=${meta.overflowX} wa=${meta.waCtas}`,
  );
  await page.close();
}

writeFileSync("audit/crawl-report.json", JSON.stringify(rows, null, 2));
await browser.close();
console.log("\nwritten: audit/crawl-report.json");
