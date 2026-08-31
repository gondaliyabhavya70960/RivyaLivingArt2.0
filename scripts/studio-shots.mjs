#!/usr/bin/env node
/**
 * Studio screenshot harness — logs in with the seeded admin, then captures
 * the Studio surfaces at a given width / colour scheme.
 *
 *   node scripts/studio-shots.mjs <out-dir> [--w 1440] [--dark] [--full]
 *
 * Not part of any gate; this is the "screenshots verified" step of the
 * definition of done for Part 12, run by hand.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [outDir, ...rest] = process.argv.slice(2);
if (!outDir) {
  console.error("usage: studio-shots.mjs <out-dir> [--w 1440] [--dark] [--full]");
  process.exit(1);
}
const flagValue = (name, fallback) => {
  const i = rest.indexOf(name);
  return i === -1 ? fallback : rest[i + 1];
};
const width = Number(flagValue("--w", 1440));
const height = Number(flagValue("--h", width < 700 ? 844 : 940));
const fullPage = rest.includes("--full");
const colorScheme = rest.includes("--dark") ? "dark" : "light";
const reducedMotion = rest.includes("--reduced") ? "reduce" : "no-preference";
const base = process.env.BASE_URL ?? "http://localhost:3000";

const ROUTES = (flagValue("--routes", "/studio,/studio/inquiries,/studio/products,/studio/media")).split(",");

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
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

const suffix = `-${width}${colorScheme === "dark" ? "-dark" : ""}${reducedMotion === "reduce" ? "-reduced" : ""}.png`;

async function settle() {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 250));
  });
  await page
    .waitForFunction(() => [...document.images].every((i) => i.complete), undefined, {
      timeout: 30_000,
    })
    .catch(() => {});
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
}

// 1 · the login screen itself (signed out)
await page.goto(`${base}/studio/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await settle();
await page.screenshot({ path: path.join(outDir, `login${suffix}`), fullPage });
console.log(`/studio/login → login${suffix}`);

// 2 · sign in with the seeded admin
await page.fill('input[name="email"]', "gondaliyabhavya70960@gmail.com");
await page.fill('input[name="password"]', "LocalBuildOnly123!");
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 120_000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(1500);
if (page.url().includes("/login")) {
  console.error("LOGIN FAILED — still on", page.url());
  await page.screenshot({ path: path.join(outDir, `login-failed${suffix}`) });
  await browser.close();
  process.exit(1);
}

for (const route of ROUTES) {
  const name = (route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "studio") + suffix;
  try {
    await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await settle();
    await page.screenshot({ path: path.join(outDir, name), fullPage });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log(`${route} → ${name}${overflow > 1 ? `  ⚠ H-OVERFLOW ${overflow}px` : ""}`);
  } catch (err) {
    console.log(`${route} → FAILED: ${String(err).slice(0, 200)}`);
  }
}

if (problems.length) {
  console.log("\npage problems:");
  for (const p of [...new Set(problems)].slice(0, 20)) console.log("  " + p);
}
await browser.close();
