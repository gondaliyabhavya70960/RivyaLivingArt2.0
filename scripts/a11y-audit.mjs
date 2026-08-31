#!/usr/bin/env node
/**
 * REDESIGN.md §19.6: "0 axe critical or serious violations."
 *
 *   node scripts/a11y-audit.mjs "/en,/en/shop,…" [--w 390]
 *
 * Runs axe-core (wcag2a, wcag2aa, wcag21a, wcag21aa) over each route against a
 * running server and fails on anything at `critical` or `serious`. Moderate
 * and minor findings are printed but do not fail — they are judgement calls,
 * and a gate that cries wolf stops being read.
 *
 * Runs in CI (.github/workflows/ci.yml, the build job) against the server that
 * job builds and starts, at 1440px and 390px. Non-zero exit fails the build.
 */
import { AxeBuilder } from "@axe-core/playwright";

import { launchChromium } from "./lib/browser.mjs";

const [routesArg, ...rest] = process.argv.slice(2);
if (!routesArg) {
  console.error('usage: a11y-audit.mjs "/en,/en/shop" [--w 390]');
  process.exit(1);
}
const widthIndex = rest.indexOf("--w");
const width = widthIndex === -1 ? 1440 : Number(rest[widthIndex + 1]);
const base = process.env.BASE_URL ?? "http://localhost:3000";

const browser = await launchChromium();
const context = await browser.newContext({
  viewport: { width, height: width < 700 ? 844 : 900 },
});
const page = await context.newPage();

let blocking = 0;

for (const route of routesArg.split(",")) {
  console.log(`\n${route}`);
  try {
    await page.goto(base + route, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
  } catch (err) {
    console.log(`  ✗ did not load: ${String(err).slice(0, 120)}`);
    blocking += 1;
    continue;
  }

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const bad = violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  const rest_ = violations.filter(
    (v) => v.impact !== "critical" && v.impact !== "serious",
  );

  for (const v of bad) {
    blocking += 1;
    console.log(
      `  ✗ [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`,
    );
    console.log(`      ${v.nodes[0]?.target?.join(" ")?.slice(0, 140)}`);
  }
  for (const v of rest_) {
    console.log(`  · [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length})`);
  }
  if (violations.length === 0) console.log("  · clean");
}

await browser.close();
console.log(`\n${blocking} critical/serious violation(s).`);
process.exitCode = blocking > 0 ? 1 : 0;
