/**
 * Storefront E2E smoke (the manual verification loop, automated). Runs
 * against an ALREADY RUNNING server — local `next start` or a deployed URL:
 *
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 *
 * Checks the invariants every session verified by hand: chrome renders, the
 * shop lists product cards with editorial names, the PDP carries an order
 * panel wired to the house WhatsApp number (Part 0 hard rule), the mobile
 * WhatsApp bar behaves (present globally, absent on the PDP), and /studio
 * stays behind the login. Exits non-zero on the first failure.
 *
 * Uses the preinstalled Chromium (PLAYWRIGHT_BROWSERS_PATH) via
 * playwright-core — no browser download.
 */
import { execSync } from "node:child_process";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const WA_NUMBER = "917096036250";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return execSync(
    'find "${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}" -name chrome -type f | head -1',
  )
    .toString()
    .trim();
}

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  args: ["--no-sandbox"],
});

try {
  const desktop = await (
    await browser.newContext({ viewport: { width: 1500, height: 950 } })
  ).newPage();

  // — Home: chrome + primary nav —
  // REDESIGN.md §5.2 cuts the header to FOUR items: Shop · Bespoke · Studio ·
  // Journal. Shop is a disclosure button (it opens the mega menu), so the row
  // is three links and one button.
  await desktop.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
  const nav = await desktop.evaluate(() =>
    [...document.querySelectorAll("header nav a, header nav button")].map((el) =>
      el.textContent.trim(),
    ),
  );
  check(
    "home renders the four-item primary nav — Shop · Bespoke · Studio · Journal",
    nav.length === 4,
    nav.join(" · "),
  );
  check(
    "announcement bar present",
    await desktop.evaluate(() => !!document.querySelector('[data-slot="sf-announcement-bar"]')),
  );

  // — Shop: cards with names —
  await desktop.goto(`${BASE}/shop`, { waitUntil: "networkidle", timeout: 240000 });
  const cardCount = await desktop.evaluate(
    () => document.querySelectorAll("main h3").length,
  );
  check("shop lists product cards", cardCount > 0, `${cardCount} card names`);

  // — PDP: order panel + house WhatsApp number —
  const pdpHref = await desktop.evaluate(() =>
    document.querySelector('main a[href*="/product/"]')?.getAttribute("href"),
  );
  check("shop links a PDP", Boolean(pdpHref), pdpHref ?? "none");
  if (pdpHref) {
    await desktop.goto(`${BASE}${pdpHref}`, { waitUntil: "networkidle", timeout: 240000 });
    check(
      "PDP renders an h1",
      await desktop.evaluate(() => Boolean(document.querySelector("h1")?.textContent.trim())),
    );
    const waWired = await desktop.evaluate(
      (num) => document.body.innerHTML.includes(`wa.me/${num}`),
      WA_NUMBER,
    );
    check("PDP wires the house WhatsApp number (hard rule)", waWired);
  }

  // — Mobile: the bottom bar off-PDP, absent on the PDP —
  // Decisions log #8: the mobile WhatsApp FAB is replaced by the five-item
  // bottom bar (HOME · SHOP · SEARCH · WHATSAPP · MENU), and two persistent
  // WhatsApp affordances on a 375px screen is one too many. The desktop FAB
  // is the other half of that trade.
  const mobile = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await mobile.goto(`${BASE}/shop`, { waitUntil: "networkidle", timeout: 240000 });
  const barItems = await mobile.evaluate(
    () =>
      document.querySelectorAll('[data-slot="sf-bottom-bar"] li').length,
  );
  check("mobile bottom bar on the shop, five items", barItems === 5, `${barItems} items`);
  check(
    "no floating WhatsApp button on mobile (the bar carries it)",
    await mobile.evaluate(() => {
      const fab = document.querySelector('[data-slot="sf-wa-fab"]');
      return !fab || getComputedStyle(fab).display === "none";
    }),
  );
  if (pdpHref) {
    await mobile.goto(`${BASE}${pdpHref}`, { waitUntil: "networkidle", timeout: 240000 });
    check(
      "mobile bottom bar absent on the PDP (its sticky action bar owns that edge)",
      await mobile.evaluate(() => !document.querySelector('[data-slot="sf-bottom-bar"]')),
    );
  }

  // — Studio gate —
  await desktop.goto(`${BASE}/studio`, { waitUntil: "networkidle", timeout: 240000 });
  const gated = await desktop.evaluate(
    () => location.pathname.includes("/studio") && !!document.querySelector('input[type="password"]'),
  );
  check("/studio is behind the login", gated, desktop.url());
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} smoke checks passed`,
);
if (failed.length > 0) process.exit(1);
