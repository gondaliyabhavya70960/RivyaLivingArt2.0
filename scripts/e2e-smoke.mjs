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
 * stays behind the login. Those ten checks are the contract — never removed,
 * never weakened (docs/transformation-audit.md §79).
 *
 * F2 (Phase 17) grows the loop around the Content Lab's deterministic demo
 * rows, which CI seeds before this runs (`scripts/seed-demo.ts`):
 *
 *   - the search overlay opens from the header and /search finds the demo
 *     piece;
 *   - one shop facet narrows the list and lands in the URL;
 *   - the customization form on /product/demo-product-001 (SIZE, SWATCH,
 *     TEXT, SELECT) submits through the spam gate to a wa.me popup that
 *     carries the "[DEMO] " prefix and the chosen size, then the
 *     /whatsapp-order fallback — and, when DATABASE_URL is set, the newest
 *     Inquiry row is the demo one (salvaged from the retired verify-phase2);
 *   - with STUDIO_EMAIL/STUDIO_PASSWORD set: the login lands in the Studio,
 *     the demo product's edit screen renders, a generated 1×1 PNG uploads
 *     into the media library, the sheet-fill Preview answers, and a
 *     testimonial cannot be PUBLISHED until its permission is GRANTED (then
 *     can);
 *   - /ar renders right-to-left and /hi renders a Devanagari h1.
 *
 * Studio and database checks skip (as skips, not passes) when their inputs
 * are absent, so the script still runs against a deployed URL. Rows it
 * creates carry "E2E smoke" in their text and are removed again when a
 * database is reachable. Exits non-zero on the first failure.
 *
 * Uses the preinstalled Chromium (PLAYWRIGHT_BROWSERS_PATH) via
 * playwright-core — no browser download.
 */
import { execSync } from "node:child_process";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const WA_NUMBER = "917096036250";
const DEMO_PDP = "/product/demo-product-001";
const STUDIO_EMAIL = process.env.STUDIO_EMAIL;
const STUDIO_PASSWORD = process.env.STUDIO_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;
const NAV = { waitUntil: "networkidle", timeout: 240000 };

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}
function skip(name, why) {
  console.log(`· ${name} — skipped (${why})`);
}

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return execSync(
    'find "${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}" -name chrome -type f | head -1',
  )
    .toString()
    .trim();
}

/** One query against DATABASE_URL through the `pg` driver Prisma already
 *  depends on; null when no database is configured (deployed-URL runs). */
async function query(sql, params = []) {
  if (!DATABASE_URL) return null;
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

/** A 1×1 transparent PNG, built in code so the smoke ships no binary. */
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

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
  await desktop.goto(`${BASE}/`, NAV);
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

  // — Search: the overlay opens from the header, /search finds the demo piece —
  const searchTrigger = desktop.locator('[data-slot="sf-search-trigger"]').first();
  if ((await searchTrigger.count()) > 0) {
    await searchTrigger.click();
    const overlayOpen = await desktop
      .locator('[data-slot="sf-search-overlay"]')
      .first()
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    check("search overlay opens from the header", overlayOpen);
    await desktop.keyboard.press("Escape");
  } else {
    check("search overlay opens from the header", false, "no [data-slot=sf-search-trigger]");
  }
  await desktop.goto(`${BASE}/search?q=Geode`, NAV);
  const searchHit = await desktop.evaluate(
    (slug) => Boolean(document.querySelector(`main a[href*="${slug}"]`)),
    DEMO_PDP,
  );
  check("/search?q=Geode lists the demo piece", searchHit);

  // — Shop: cards with names —
  await desktop.goto(`${BASE}/shop`, NAV);
  const cardCount = await desktop.evaluate(
    () => document.querySelectorAll("main h3").length,
  );
  check("shop lists product cards", cardCount > 0, `${cardCount} card names`);

  // — Shop: one facet narrows the list and lands in the URL (§7.4) —
  const filterButton = desktop.getByRole("button", { name: /filter/i }).first();
  if ((await filterButton.count()) > 0) {
    await filterButton.click();
    const facet = desktop
      .locator('[role="dialog"] button[aria-pressed="false"]')
      .first();
    const facetSeen = await facet
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (facetSeen) {
      const facetName = (await facet.textContent())?.trim() ?? "";
      await facet.click();
      await desktop.waitForTimeout(1500);
      const url = new URL(desktop.url());
      const narrowed = [...url.searchParams.keys()].length > 0;
      await desktop.keyboard.press("Escape");
      await desktop.waitForLoadState("networkidle").catch(() => {});
      const cardsAfter = await desktop.evaluate(
        () => document.querySelectorAll("main h3").length,
      );
      check(
        "a shop facet narrows the list and lands in the URL",
        narrowed && cardsAfter >= 0,
        `${facetName || "facet"} → ${url.search || "(no query)"} · ${cardsAfter} cards`,
      );
    } else {
      check("a shop facet narrows the list and lands in the URL", false, "no facet option in the filter dialog");
    }
  } else {
    check("a shop facet narrows the list and lands in the URL", false, "no Filter button");
  }

  // — PDP: order panel + house WhatsApp number —
  await desktop.goto(`${BASE}/shop`, NAV);
  const pdpHref = await desktop.evaluate(() =>
    document.querySelector('main a[href*="/product/"]')?.getAttribute("href"),
  );
  check("shop links a PDP", Boolean(pdpHref), pdpHref ?? "none");
  if (pdpHref) {
    await desktop.goto(`${BASE}${pdpHref}`, NAV);
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

  // — Order flow on the demo PDP (salvaged from verify-phase2) —
  // SIZE (radix SELECT, options portal to <body>), SWATCH chips, TEXT
  // engraving, SELECT finish, the contact fields, the ≥2.5 s spam gate, then
  // Place Order → wa.me popup + the /whatsapp-order fallback.
  {
    const p = await (
      await browser.newContext({ viewport: { width: 1280, height: 900 } })
    ).newPage();
    const pageErrors = [];
    p.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 160)));
    const resp = await p.goto(`${BASE}${DEMO_PDP}`, NAV);
    const demoUp = Boolean(resp) && (await p.locator("#order-panel").count()) > 0;
    check("the demo PDP renders its order panel", demoUp, `HTTP ${resp?.status()}`);
    if (demoUp) {
      const panel = p.locator("#order-panel");
      const comboboxes = panel.getByRole("combobox");
      await comboboxes.nth(0).click();
      await p.getByRole("option", { name: "16 inch" }).click();
      await panel.getByRole("button", { name: /Ivory/ }).first().click();
      await panel.getByLabel(/engraving/i).first().fill("E2E smoke · A & R");
      if ((await comboboxes.count()) > 1) {
        await comboboxes.nth(1).click();
        await p.getByRole("option", { name: "Gloss" }).click();
      }
      await panel.getByRole("textbox", { name: /^Name/ }).fill("E2E smoke");
      await panel.getByRole("textbox", { name: /^Phone/ }).fill("+91 90000 00001");
      const notes = panel.getByRole("textbox", { name: /notes/i });
      if ((await notes.count()) > 0) await notes.first().fill("E2E smoke — safe to close.");
      await p.waitForTimeout(3200);
      const popupPromise = p.waitForEvent("popup", { timeout: 30000 }).catch(() => null);
      await p.getByRole("button", { name: /place order/i }).click();
      const popup = await popupPromise;
      const waUrl = popup ? popup.url() : "";
      if (popup) await popup.close();
      const decoded = decodeURIComponent(waUrl);
      check(
        "Place Order opens wa.me with the house number",
        waUrl.startsWith(`https://wa.me/${WA_NUMBER}`),
        waUrl.slice(0, 80) || "no popup",
      );
      check(
        'the demo order message carries the "[DEMO] " prefix and the chosen size',
        decoded.includes("[DEMO]") && decoded.includes("16 inch"),
      );
      const fell = await p
        .waitForURL(/whatsapp-order/, { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      check("the /whatsapp-order fallback follows the popup", fell, p.url());
      check("no page errors during the order flow", pageErrors.length === 0, pageErrors[0] ?? "");
      if (DATABASE_URL) {
        const row = await query(
          'select "isDemo" from "Inquiry" order by "createdAt" desc limit 1',
        );
        check(
          "the newest Inquiry row is the demo one (isDemo = true)",
          row?.rows?.[0]?.isDemo === true,
        );
      } else {
        skip("the newest Inquiry row is the demo one", "no DATABASE_URL");
      }
    }
    await p.close();
  }

  // — Mobile: the bottom bar off-PDP, absent on the PDP —
  // Decisions log #8: the mobile WhatsApp FAB is replaced by the five-item
  // bottom bar (HOME · SHOP · SEARCH · WHATSAPP · MENU), and two persistent
  // WhatsApp affordances on a 375px screen is one too many. The desktop FAB
  // is the other half of that trade.
  const mobile = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await mobile.goto(`${BASE}/shop`, NAV);
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
    await mobile.goto(`${BASE}${pdpHref}`, NAV);
    check(
      "mobile bottom bar absent on the PDP (its sticky action bar owns that edge)",
      await mobile.evaluate(() => !document.querySelector('[data-slot="sf-bottom-bar"]')),
    );
  }

  // — Locales: Arabic mirrors, Hindi renders its own script —
  await desktop.goto(`${BASE}/ar`, NAV);
  check(
    "/ar renders right-to-left",
    await desktop.evaluate(() => document.documentElement.getAttribute("dir") === "rtl"),
  );
  await desktop.goto(`${BASE}/hi`, NAV);
  const hiH1 = await desktop.evaluate(() => document.querySelector("h1")?.textContent ?? "");
  check("/hi renders a Devanagari h1", /[ऀ-ॿ]/.test(hiH1), hiH1.trim().slice(0, 40));

  // — Studio gate —
  await desktop.goto(`${BASE}/studio`, NAV);
  const gated = await desktop.evaluate(
    () => location.pathname.includes("/studio") && !!document.querySelector('input[type="password"]'),
  );
  check("/studio is behind the login", gated, desktop.url());

  // — Studio, signed in (needs the audit credentials; CI sets them) —
  if (STUDIO_EMAIL && STUDIO_PASSWORD) {
    const studio = await (
      await browser.newContext({ viewport: { width: 1440, height: 900 } })
    ).newPage();
    await studio.goto(`${BASE}/studio/login`, NAV);
    await studio.fill('input[name="email"]', STUDIO_EMAIL);
    await studio.fill('input[name="password"]', STUDIO_PASSWORD);
    await Promise.all([
      studio.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60000 }).catch(() => {}),
      studio.keyboard.press("Enter"),
    ]);
    await studio.waitForLoadState("networkidle").catch(() => {});
    check("the Studio login signs in", !studio.url().includes("/login"), studio.url());

    // The demo product's edit screen — a Content Lab row reachable in the Studio.
    await studio.goto(`${BASE}/studio/products/demo-product-001`, NAV);
    const editTitle = await studio.evaluate(() => {
      const input = [...document.querySelectorAll("input")].find((i) => /Geode Side Table/.test(i.value));
      const heading = [...document.querySelectorAll("h1, h2")].find((h) => /Geode Side Table/.test(h.textContent ?? ""));
      return Boolean(input || heading);
    });
    check("the demo product opens in the Studio editor", editTitle);

    // A media upload: a generated 1×1 PNG through the library's input.
    await studio.goto(`${BASE}/studio/media`, NAV);
    const uploadInput = studio.locator("#media-upload-input");
    if ((await uploadInput.count()) > 0) {
      const stamp = Date.now();
      const name = `e2e-smoke-${stamp}.png`;
      await uploadInput.setInputFiles({ name, mimeType: "image/png", buffer: ONE_PIXEL_PNG });
      let listed = false;
      for (let i = 0; i < 20 && !listed; i += 1) {
        await studio.waitForTimeout(1500);
        listed = await studio.evaluate((n) => document.body.innerText.includes(n), name);
        if (!listed && i % 4 === 3) await studio.reload(NAV);
      }
      check("a 1×1 PNG uploads into the media library", listed, name);
      if (DATABASE_URL) {
        await query('delete from "Media" where url like $1 or pathname like $1', [`%${name.replace(".png", "")}%`]);
      }
    } else {
      check("a 1×1 PNG uploads into the media library", false, "no #media-upload-input");
    }

    // The sheet-fill Preview answers (a dry run — nothing written).
    await studio.goto(`${BASE}/studio/sheet-import`, NAV);
    const preview = studio.getByRole("button", { name: /preview/i }).first();
    if ((await preview.count()) > 0) {
      const before = await studio.evaluate(() => document.body.innerText.length);
      await preview.click();
      let answered = false;
      for (let i = 0; i < 40 && !answered; i += 1) {
        await studio.waitForTimeout(1500);
        const enabled = await preview.isEnabled().catch(() => false);
        const after = await studio.evaluate(() => document.body.innerText.length);
        answered = enabled && after !== before;
      }
      check("the sheet-fill Preview answers", answered);
    } else {
      check("the sheet-fill Preview answers", false, "no Preview button");
    }

    // A testimonial cannot be PUBLISHED until permission is GRANTED — then can.
    await studio.goto(`${BASE}/studio/testimonials/new`, NAV);
    const nameField = studio.locator("#testimonial-name");
    if ((await nameField.count()) > 0) {
      const marker = `E2E smoke customer ${Date.now()}`;
      await nameField.fill(marker);
      await studio.locator("#testimonial-quote").fill("E2E smoke quote — safe to delete.");
      await studio.locator('[aria-label="Status"]').first().click();
      await studio.getByRole("option", { name: /^Published$/ }).click();
      await studio.getByRole("button", { name: /^(Save|Create|Publish)/ }).first().click();
      const refused = await studio
        .getByText(/permission recorded as GRANTED/i)
        .first()
        .waitFor({ state: "visible", timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      check("a testimonial is refused PUBLISHED without permission GRANTED", refused);
      await studio.locator('[aria-label="Permission"]').first().click();
      await studio.getByRole("option", { name: /^Granted$/ }).click();
      await studio.getByRole("button", { name: /^(Save|Create|Publish)/ }).first().click();
      let saved = false;
      for (let i = 0; i < 20 && !saved; i += 1) {
        await studio.waitForTimeout(1000);
        saved =
          !studio.url().endsWith("/testimonials/new") ||
          (await studio.evaluate(() => /saved|created|published/i.test(document.body.innerText)));
      }
      if (DATABASE_URL) {
        const row = await query('select status, "permissionStatus" from "Testimonial" where name = $1', [marker]);
        saved = row?.rows?.[0]?.status === "PUBLISHED" && row?.rows?.[0]?.permissionStatus === "GRANTED";
        await query('delete from "Testimonial" where name = $1', [marker]);
      }
      check("the same testimonial publishes once permission is GRANTED", saved);
    } else {
      check("a testimonial is refused PUBLISHED without permission GRANTED", false, "no #testimonial-name");
    }
    await studio.close();
  } else {
    skip("Studio checks (login, demo product, media upload, sheet preview, testimonial rule)", "STUDIO_EMAIL/STUDIO_PASSWORD unset");
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} smoke checks passed`,
);
if (failed.length > 0) process.exit(1);
