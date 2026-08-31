/**
 * Lighthouse budgets on Home, PLP and (given a slug) PDP.
 *
 * Desktop form factor with DESKTOP throttling — see the note beside the
 * `throttling` block, which is the difference between measuring this site and
 * measuring a misconfiguration.
 * Run against a PRODUCTION server (`next build` + `next start`) — dev-mode
 * numbers are meaningless. Uses the preinstalled Playwright chromium.
 * Usage: node scripts/lighthouse-audit.mjs [pdpSlug]
 * NOTE (sandbox): remote catalog images are proxy-blocked here, which drags
 * LCP/best-practices on PLP/PDP below their production values — treat local
 * numbers as a lower bound and re-run in CI/production for the real ones.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

import { resolveChromiumPath } from "./lib/browser.mjs";

const BASE = process.env.LH_BASE ?? "http://localhost:3111";

/**
 * The budget. Overridable per run so a deliberately heavier branch can be
 * measured without editing the gate, but the DEFAULT is what CI enforces.
 */
const PERF_MIN = Number(process.env.LH_PERF_MIN ?? 85);
const A11Y_MIN = Number(process.env.LH_A11Y_MIN ?? 95);
const pdpSlug = process.argv[2];

// One resolver for every script that drives a browser: an explicit override,
// then the sandbox build, then playwright's own registry. The hardcoded
// `find /opt/pw-browsers/chromium-1194` this replaced could only ever work in
// the dev sandbox, which is why this script had never run anywhere else.
const chromePath = resolveChromiumPath();

const OUT_DIR = "screenshots";
mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  ["home", `${BASE}/`],
  ["plp", `${BASE}/shop`],
];
if (pdpSlug) targets.push(["pdp", `${BASE}/product/${pdpSlug}`]);

const chrome = await launch({
  chromePath,
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
});

const rows = [];
try {
  for (const [name, url] of targets) {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: [
        "performance",
        "accessibility",
        "best-practices",
        "seo",
      ],
      screenEmulation: {
        mobile: false,
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        disabled: false,
      },
      formFactor: "desktop",
      throttlingMethod: "simulate",
      // Throttling MUST match the form factor. Lighthouse's default preset is
      // mobile slow-4G with a 4x CPU penalty, and leaving it under
      // `formFactor: "desktop"` measures a desktop-rendered page over a phone
      // connection — a combination no real user has. It cost this audit 39
      // points: the same page and the same server score 59 with the mismatch
      // and 98 without it (LCP 5.5s vs 1.0s, TBT 140ms vs 0). The numbers
      // this script reported before this line existed were not measuring the
      // site, they were measuring the mismatch.
      throttling: {
        rttMs: 40,
        throughputKbps: 10 * 1024,
        cpuSlowdownMultiplier: 1,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0,
      },
    });
    const c = result.lhr.categories;
    const score = (k) => Math.round((c[k]?.score ?? 0) * 100);
    const audits = result.lhr.audits;
    rows.push({
      name,
      perf: score("performance"),
      a11y: score("accessibility"),
      bp: score("best-practices"),
      seo: score("seo"),
      lcp: audits["largest-contentful-paint"]?.displayValue ?? "?",
      cls: audits["cumulative-layout-shift"]?.displayValue ?? "?",
      tbt: audits["total-blocking-time"]?.displayValue ?? "?",
    });
    writeFileSync(
      `${OUT_DIR}/lh-${name}.json`,
      JSON.stringify(
        {
          categories: Object.fromEntries(
            Object.entries(c).map(([k, v]) => [k, v.score]),
          ),
          failing: Object.values(audits)
            .filter(
              (a) =>
                a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative",
            )
            .map((a) => ({ id: a.id, score: a.score, title: a.title }))
            .slice(0, 40),
        },
        null,
        2,
      ),
    );
  }
} finally {
  chrome.kill();
}

console.log("page | perf | a11y | best-practices | seo | LCP | CLS | TBT");
for (const r of rows) {
  console.log(
    `${r.name} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt}`,
  );
}
const budgetFail = rows.filter((r) => r.perf < PERF_MIN || r.a11y < A11Y_MIN);
console.log(
  budgetFail.length
    ? `BUDGET MISS on: ${budgetFail.map((r) => r.name).join(", ")} (details in ${OUT_DIR}/lh-*.json)`
    : `All budgets met (perf ≥${PERF_MIN}, a11y ≥${A11Y_MIN}).`,
);
// This script printed its verdict and exited 0, so mounting it in CI would
// have bought a gate that could never fail. It reports now.
process.exitCode = budgetFail.length > 0 ? 1 : 0;
