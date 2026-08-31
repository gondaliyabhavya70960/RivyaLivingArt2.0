#!/usr/bin/env node
/**
 * Screenshot harness for design QA.
 *
 *   node scripts/shots.mjs <out-dir> <path>[,<path>…] [--w 1440] [--full]
 *
 * Drives the pre-installed Chromium (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers)
 * rather than downloading one. Every capture waits for fonts and for the
 * network to settle so a serif that swapped late never reads as a layout bug.
 * Not part of any gate — this is the "screenshots verified" step of the
 * definition of done, run by hand.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { launchChromium } from "./lib/browser.mjs";

const [outDir, routesArg, ...rest] = process.argv.slice(2);
if (!outDir || !routesArg) {
  console.error("usage: shots.mjs <out-dir> <path,path,…> [--w 1440] [--full] [--dark]");
  process.exit(1);
}

const flagValue = (name, fallback) => {
  const i = rest.indexOf(name);
  return i === -1 ? fallback : rest[i + 1];
};
const width = Number(flagValue("--w", 1440));
const height = Number(flagValue("--h", width < 700 ? 844 : 900));
const fullPage = rest.includes("--full");
const reducedMotion = rest.includes("--reduced") ? "reduce" : "no-preference";
const colorScheme = rest.includes("--dark") ? "dark" : "light";
const base = process.env.BASE_URL ?? "http://localhost:3000";

mkdirSync(outDir, { recursive: true });

const browser = await launchChromium();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  reducedMotion,
  colorScheme,
});
const page = await context.newPage();

const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 300)}`);
});
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`));

for (const route of routesArg.split(",")) {
  const url = base + route;
  const name =
    (route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "home") +
    `-${width}` +
    (reducedMotion === "reduce" ? "-reduced" : "") +
    ".png";
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.evaluate(() => document.fonts.ready);
    await page
      .waitForLoadState("networkidle", { timeout: 20_000 })
      .catch(() => {});
    // Walk the page so every lazy image and scroll-triggered reveal fires,
    // then wait for the images to actually decode — a screenshot taken while
    // next/image is still resizing shows empty frames and reads as a layout
    // bug that is not there.
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.8);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 300));
    });
    await page
      .waitForFunction(
        () => [...document.images].every((i) => i.complete),
        undefined,
        { timeout: 30_000 },
      )
      .catch(() => {});
    await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));
    await page.screenshot({ path: path.join(outDir, name), fullPage });
    // Horizontal-overflow check (Part 19.5: "no horizontal overflow").
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log(
      `${route} → ${name}${overflow > 1 ? `  ⚠ H-OVERFLOW ${overflow}px` : ""}`,
    );
  } catch (err) {
    console.log(`${route} → FAILED: ${String(err).slice(0, 200)}`);
  }
}

if (problems.length) {
  console.log("\npage problems:");
  for (const p of [...new Set(problems)].slice(0, 20)) console.log("  " + p);
}

await browser.close();
