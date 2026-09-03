/**
 * Part 0 Lighthouse baseline loop (guide §0.2, adapted): mobile-emulated,
 * simulated throttling, across the core storefront routes. Writes
 * audit/lh-summary.json. Sandbox note: perf numbers here are lower bounds —
 * the proxy blocks external catalog-image hosts and throttles CPU; a11y/SEO/
 * best-practices are valid. Run against a production server.
 * Usage: BASE=http://localhost:3000 node scripts/audit-lighthouse.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { resolveChromiumPath } from "./lib/browser.mjs";

const BASE = process.env.BASE_URL ?? process.env.BASE ?? "http://localhost:3000";
const ROUTES = [
  ["home", "/"],
  ["plp", "/shop"],
  ["pdp", "/product/hot-pink-pla-filament"],
  ["blog", "/blog"],
  ["post", "/blog/3d-printed-architectural-models-business-displays"],
  ["about", "/about"],
  ["contact", "/contact"],
];

const chromePath = resolveChromiumPath();
const chrome = await launch({
  chromePath,
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
});

mkdirSync("audit", { recursive: true });
const rows = [];
try {
  for (const [name, route] of ROUTES) {
    const result = await lighthouse(BASE + route, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      formFactor: "mobile",
      screenEmulation: {
        mobile: true,
        width: 412,
        height: 823,
        deviceScaleFactor: 1.75,
        disabled: false,
      },
      throttlingMethod: "simulate",
    });
    const c = result.lhr.categories;
    const a = result.lhr.audits;
    const score = (k) => Math.round((c[k]?.score ?? 0) * 100);
    const row = {
      name,
      route,
      perf: score("performance"),
      a11y: score("accessibility"),
      bp: score("best-practices"),
      seo: score("seo"),
      lcp: a["largest-contentful-paint"]?.displayValue ?? "?",
      cls: a["cumulative-layout-shift"]?.displayValue ?? "?",
      tbt: a["total-blocking-time"]?.displayValue ?? "?",
      failing: Object.values(result.lhr.audits)
        .filter(
          (x) =>
            x.score !== null && x.score < 0.9 && x.scoreDisplayMode === "binary",
        )
        .map((x) => x.id),
    };
    rows.push(row);
    console.log(
      `${name}: perf=${row.perf} a11y=${row.a11y} bp=${row.bp} seo=${row.seo} LCP=${row.lcp} CLS=${row.cls}`,
    );
  }
} finally {
  await chrome.kill();
}
writeFileSync("audit/lh-summary.json", JSON.stringify(rows, null, 2));
console.log("written: audit/lh-summary.json");
