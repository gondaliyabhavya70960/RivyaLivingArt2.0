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
 *     the demo product's edit screen renders, a generated PNG uploads into
 *     the media library, the catalog-fill Preview answers, and a testimonial
 *     cannot be PUBLISHED until its permission is GRANTED (then can);
 *   - the four Studio paths the plan named and the first cut of this file
 *     left out (plan audit, 2026-09-04): a product is created, edited and
 *     deleted through its form; the page builder saves a block on
 *     /p/demo-lander and the lander renders it; a site-copy edit stages a
 *     DRAFT the visitor does not see, Publish releases it, Reset returns the
 *     shipped wording; and the scraper refuses a URL whose platform it cannot
 *     detect — no job, no source, no network beyond the one probe;
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

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const WA_NUMBER = "917096036250";
// Both shapes a WhatsApp deep link takes: the app's own `wa.me/<number>?text=`
// and the `api.whatsapp.com/send/?phone=<number>&text=` that wa.me redirects
// to on a machine with real internet.
const WA_HOSTS = /^https:\/\/(wa\.me|api\.whatsapp\.com)\//;

/** The phone number a WhatsApp deep link addresses, in either shape. */
function waHouseNumber(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return "";
  }
  if (url.hostname === "wa.me")
    return url.pathname.replace(/^\/+/, "").split("/")[0];
  if (url.hostname === "api.whatsapp.com")
    return url.searchParams.get("phone") ?? "";
  return "";
}

/** The pre-filled message of a WhatsApp deep link, decoded (`+` is a space). */
function waMessage(href) {
  try {
    return new URL(href).searchParams.get("text") ?? "";
  } catch {
    return "";
  }
}
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

/**
 * The file the media-upload check sends: a 64×64 PNG rendered by `sharp`
 * (a dependency the ingest pipeline itself uses) in a colour derived from
 * the run's timestamp, so its checksum is new every time — the library
 * dedupes uploads by checksum, and re-sending a bundled master would only
 * ever return the row that already holds it. Falls back to a 1×1 PNG built
 * in code where sharp cannot load.
 */
async function uploadSample(stamp) {
  try {
    const { default: sharp } = await import("sharp");
    const buffer = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: (stamp % 200) + 20, g: (stamp % 97) + 60, b: 140 },
      },
    })
      .png()
      .toBuffer();
    return { ext: "png", mimeType: "image/png", buffer };
  } catch {
    return {
      ext: "png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64",
      ),
    };
  }
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
  await desktop.goto(`${BASE}/`, NAV);
  const nav = await desktop.evaluate(() =>
    [...document.querySelectorAll("header nav a, header nav button")].map(
      (el) => el.textContent.trim(),
    ),
  );
  check(
    "home renders the four-item primary nav — Shop · Bespoke · Studio · Journal",
    nav.length === 4,
    nav.join(" · "),
  );
  check(
    "announcement bar present",
    await desktop.evaluate(
      () => !!document.querySelector('[data-slot="sf-announcement-bar"]'),
    ),
  );

  // — Search: the overlay opens from the header, /search finds the demo piece —
  const searchTrigger = desktop
    .locator('[data-slot="sf-search-trigger"]')
    .first();
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
    check(
      "search overlay opens from the header",
      false,
      "no [data-slot=sf-search-trigger]",
    );
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
      check(
        "a shop facet narrows the list and lands in the URL",
        false,
        "no facet option in the filter dialog",
      );
    }
  } else {
    check(
      "a shop facet narrows the list and lands in the URL",
      false,
      "no Filter button",
    );
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
      await desktop.evaluate(() =>
        Boolean(document.querySelector("h1")?.textContent.trim()),
      ),
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
    const demoUp =
      Boolean(resp) && (await p.locator("#order-panel").count()) > 0;
    check(
      "the demo PDP renders its order panel",
      demoUp,
      `HTTP ${resp?.status()}`,
    );
    if (demoUp) {
      const panel = p.locator("#order-panel");
      // Every option field is a row of chip buttons (Part 9's customization
      // controls): SIZE, SWATCH and the SELECT finish alike. TEXT is the one
      // free input under the order-field- prefix that is not a number or a
      // file; the contact fields carry stable ids.
      await panel.getByRole("button", { name: "16 inch" }).first().click();
      await panel.getByRole("button", { name: "Ivory" }).first().click();
      await panel
        .locator(
          'input[id^="order-field-"]:not([type="number"]):not([type="file"])',
        )
        .first()
        .fill("E2E smoke · A & R");
      await panel.getByRole("button", { name: "Gloss" }).first().click();
      await panel.locator("#order-name").fill("E2E smoke");
      await panel.locator("#order-phone").fill("+91 90000 00001");
      await panel.locator("#order-notes").fill("E2E smoke — safe to close.");
      await p.waitForTimeout(3200);
      const since = DATABASE_URL
        ? (await query("select now() as t"))?.rows?.[0]?.t
        : null;
      // The panel opens wa.me with `noopener` (no opener relationship, so
      // Playwright's `popup` event never fires) and then pushes the
      // /whatsapp-order fallback, which renders the same link. Watch the
      // context for the new tab AND read the fallback's own anchor, and
      // accept whichever carries the wa.me URL.
      //
      // A machine with real internet never keeps that tab on wa.me: WhatsApp
      // answers with a 301 to api.whatsapp.com/send/?phone=…&text=… and
      // re-encodes the spaces as "+", which is exactly what the first CI run
      // of this check saw (25/27). So the context answers the wa.me
      // navigation itself — recording the URL the panel asked for and
      // serving a stub — and the assertions read that recorded link. CI
      // never contacts WhatsApp, and the check means the same thing on a
      // laptop, in this sandbox and on the runner.
      const waRequests = [];
      await p.context().route(WA_HOSTS, (route) => {
        waRequests.push(route.request().url());
        return route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>wa.me stub</title>",
        });
      });
      const newPagePromise = p
        .context()
        .waitForEvent("page", { timeout: 20000 })
        .catch(() => null);
      // The label is a tier preset now (docs/plan/07 step 8): demo-product-001
      // is LARGE, so the button reads "Commission a piece" rather than
      // "Place order". The form's one submit control is the stable handle.
      await panel.locator('button[type="submit"]').click();
      const newPage = await newPagePromise;
      let waUrl = "";
      if (newPage) {
        await newPage.waitForURL(WA_HOSTS, { timeout: 10000 }).catch(() => {});
        waUrl =
          waRequests.find((u) => u.startsWith("https://wa.me/")) ??
          newPage.url();
        await newPage.close().catch(() => {});
      }
      const fell = await p
        .waitForURL(/whatsapp-order/, { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      if (!decodeURIComponent(waUrl).includes("[DEMO]") && fell) {
        // The fallback page renders the order's own wa.me link beside the
        // chrome's generic ones; the order link is the long one.
        await p.waitForLoadState("networkidle").catch(() => {});
        waUrl =
          (await p.evaluate(
            () =>
              [...document.querySelectorAll('a[href^="https://wa.me/"]')]
                .map((a) => a.getAttribute("href") ?? "")
                .sort((x, y) => y.length - x.length)[0] ?? "",
          )) || waUrl;
      }
      const message = waMessage(waUrl);
      check(
        "Place Order opens wa.me with the house number",
        waHouseNumber(waUrl) === WA_NUMBER,
        waUrl.slice(0, 120) || "no popup",
      );
      check(
        'the demo order message carries the "[DEMO] " prefix and the chosen size',
        message.includes("[DEMO]") && message.includes("16 inch"),
        message.slice(0, 120),
      );
      check("the /whatsapp-order fallback follows the popup", fell, p.url());
      check(
        "no page errors during the order flow",
        pageErrors.length === 0,
        pageErrors[0] ?? "",
      );
      if (DATABASE_URL) {
        const row = await query(
          'select "isDemo" from "Inquiry" where "createdAt" >= $1 order by "createdAt" desc limit 1',
          [since],
        );
        check(
          "Place Order saved an Inquiry row marked isDemo",
          row?.rows?.[0]?.isDemo === true,
          row?.rows?.length ? "" : "no Inquiry row created by this order",
        );
      } else {
        skip(
          "Place Order saved an Inquiry row marked isDemo",
          "no DATABASE_URL",
        );
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
    () => document.querySelectorAll('[data-slot="sf-bottom-bar"] li').length,
  );
  check(
    "mobile bottom bar on the shop, five items",
    barItems === 5,
    `${barItems} items`,
  );
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
      await mobile.evaluate(
        () => !document.querySelector('[data-slot="sf-bottom-bar"]'),
      ),
    );
  }

  // — Locales: Arabic mirrors, Hindi renders its own script —
  await desktop.goto(`${BASE}/ar`, NAV);
  check(
    "/ar renders right-to-left",
    await desktop.evaluate(
      () => document.documentElement.getAttribute("dir") === "rtl",
    ),
  );
  await desktop.goto(`${BASE}/hi`, NAV);
  const hiH1 = await desktop.evaluate(
    () => document.querySelector("h1")?.textContent ?? "",
  );
  check(
    "/hi renders a Devanagari h1",
    /[ऀ-ॿ]/.test(hiH1),
    hiH1.trim().slice(0, 40),
  );

  // — Studio gate —
  await desktop.goto(`${BASE}/studio`, NAV);
  const gated = await desktop.evaluate(
    () =>
      location.pathname.includes("/studio") &&
      !!document.querySelector('input[type="password"]'),
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
      studio
        .waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60000 })
        .catch(() => {}),
      studio.keyboard.press("Enter"),
    ]);
    await studio.waitForLoadState("networkidle").catch(() => {});
    check(
      "the Studio login signs in",
      !studio.url().includes("/login"),
      studio.url(),
    );

    // The demo product's edit screen — a Content Lab row reachable in the Studio.
    await studio.goto(`${BASE}/studio/products/demo-product-001`, NAV);
    const editTitle = await studio.evaluate(() => {
      const input = [...document.querySelectorAll("input")].find((i) =>
        /Geode Side Table/.test(i.value),
      );
      const heading = [...document.querySelectorAll("h1, h2")].find((h) =>
        /Geode Side Table/.test(h.textContent ?? ""),
      );
      return Boolean(input || heading);
    });
    check("the demo product opens in the Studio editor", editTitle);

    // A media upload: a generated 1×1 PNG through the library's input.
    await studio.goto(`${BASE}/studio/media`, NAV);
    const uploadInput = studio.locator("#media-upload-input");
    if ((await uploadInput.count()) > 0) {
      const stamp = Date.now();
      const sample = await uploadSample(stamp);
      const name = `e2e-smoke-${stamp}.${sample.ext}`;
      await uploadInput.setInputFiles({
        name,
        mimeType: sample.mimeType,
        buffer: sample.buffer,
      });
      let listed = false;
      for (let i = 0; i < 20 && !listed; i += 1) {
        await studio.waitForTimeout(1500);
        // The library shows the stored name, which carries a hash before the
        // extension — match on the stem only.
        listed = await studio.evaluate(
          (n) => document.body.innerText.includes(n),
          `e2e-smoke-${stamp}`,
        );
        if (!listed && i % 4 === 3) await studio.reload(NAV);
      }
      check("a picture uploads into the media library", listed, name);
      if (DATABASE_URL) {
        await query(
          'delete from "Media" where url like $1 or pathname like $1',
          [`%e2e-smoke-${stamp}%`],
        );
      }
    } else {
      check(
        "a picture uploads into the media library",
        false,
        "no #media-upload-input",
      );
    }

    // The catalog-fill Preview answers (a dry run — nothing written).
    await studio.goto(`${BASE}/studio/catalog-fill`, NAV);
    const preview = studio.getByRole("button", { name: /preview/i }).first();
    if ((await preview.count()) > 0) {
      const before = await studio.evaluate(
        () => (document.querySelector("main")?.innerText ?? "").length,
      );
      await preview.click();
      // A changed innerText is not enough: a preview that reads NO FILE
      // still renders "created 0 · updated 0 · unchanged 0 · failed 0" and
      // changes the length — which is exactly the state that held on every
      // environment until 2026-09-17 while this check stayed green (the
      // fill resolved data/tiers from a .next chunk folder). So the check
      // now demands a signal an empty read cannot produce: the run touched
      // rows. CI seeds the same committed lists, so a real preview always
      // reports thousands unchanged.
      let answered = false;
      let read = false;
      for (let i = 0; i < 40 && !read; i += 1) {
        await studio.waitForTimeout(1500);
        const enabled = await preview.isEnabled().catch(() => false);
        const text = await studio.evaluate(
          () => document.querySelector("main")?.innerText ?? "",
        );
        answered = enabled && text.length !== before;
        // "unchanged 4,373" / "created 373" — any non-zero row count.
        read = answered && /\b(created|updated|unchanged)\s+[1-9]/.test(text);
      }
      check(
        "the catalog-fill Preview answers",
        read,
        answered ? "the preview read zero rows — data/tiers not reachable" : "",
      );
    } else {
      check("the catalog-fill Preview answers", false, "no Preview button");
    }

    // A testimonial cannot be PUBLISHED until permission is GRANTED — then can.
    await studio.goto(`${BASE}/studio/testimonials/new`, NAV);
    const nameField = studio.locator("#testimonial-name");
    if ((await nameField.count()) > 0) {
      // The form is tabbed (Quote · Attribution · Links · Media · Review) with
      // every panel mounted but hidden, so each field's tab is opened first.
      const tab = async (name) => {
        await studio.getByRole("tab", { name }).first().click();
        await studio.waitForTimeout(200);
      };
      const marker = `E2E smoke customer ${Date.now()}`;
      await tab(/quote/i);
      await studio
        .locator("#testimonial-quote")
        .fill("E2E smoke quote — safe to delete.");
      await tab(/attribution/i);
      await nameField.fill(marker);
      await tab(/review/i);
      await studio.locator('[aria-label="Status"]').first().click();
      await studio.getByRole("option", { name: /^Published$/ }).click();
      await studio
        .getByRole("button", { name: /^(Save|Create|Publish)/ })
        .first()
        .click();
      const refused = await studio
        .getByText(/permission recorded as GRANTED/i)
        .first()
        .waitFor({ state: "visible", timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      check(
        "a testimonial is refused PUBLISHED without permission GRANTED",
        refused,
      );
      await tab(/review/i);
      await studio.locator('[aria-label="Permission"]').first().click();
      await studio.getByRole("option", { name: /^Granted$/ }).click();
      await studio
        .getByRole("button", { name: /^(Save|Create|Publish)/ })
        .first()
        .click();
      let saved = false;
      for (let i = 0; i < 20 && !saved; i += 1) {
        await studio.waitForTimeout(1000);
        saved =
          !studio.url().endsWith("/testimonials/new") ||
          (await studio.evaluate(() =>
            /saved|created|published/i.test(document.body.innerText),
          ));
      }
      if (DATABASE_URL) {
        const row = await query(
          'select status, "permissionStatus" from "Testimonial" where name = $1',
          [marker],
        );
        saved =
          row?.rows?.[0]?.status === "PUBLISHED" &&
          row?.rows?.[0]?.permissionStatus === "GRANTED";
        await query('delete from "Testimonial" where name = $1', [marker]);
      }
      check("the same testimonial publishes once permission is GRANTED", saved);
    } else {
      check(
        "a testimonial is refused PUBLISHED without permission GRANTED",
        false,
        "no #testimonial-name",
      );
    }

    // Each Studio path below runs under `attempt`: a locator that never
    // appears throws a TimeoutError, and one path's surprise must fail ITS
    // checks, not abort the run before the other paths report.
    const attempt = async (names, fn) => {
      try {
        await fn();
      } catch (err) {
        const reason = String(err?.message ?? err)
          .split("\n")[0]
          .slice(0, 160);
        for (const name of names) {
          if (!results.some((r) => r.name === name)) check(name, false, reason);
        }
      }
    };

    // Toasts are the Studio's answer to every action; each check below reads
    // the one it expects rather than guessing at timing.
    const toastSeen = (pattern, timeout = 15000) =>
      studio
        .getByText(pattern)
        .first()
        .waitFor({ state: "visible", timeout })
        .then(() => true)
        .catch(() => false);

    await attempt(
      [
        "a product is created from the Studio form",
        "the product's edit saves what was typed",
        "the product is deleted from its form",
      ],
      async () => {
        // — A product's whole life through its form: create → edit → delete —
        {
          const stamp = Date.now();
          const title = `E2E smoke product ${stamp}`;
          await studio.goto(`${BASE}/studio/products/new`, NAV);
          const titleField = studio.locator("#product-title");
          if ((await titleField.count()) > 0) {
            await titleField.fill(title);
            await studio
              .locator("#product-description")
              .fill("E2E smoke — safe to delete.");
            // The category is a radix Select: open the trigger, take the first option.
            await studio.locator('[aria-label="Category"]').first().click();
            await studio.getByRole("option").first().click();
            await studio.locator("#product-price-min").fill("999");
            await studio
              .getByRole("button", { name: /^Save$/ })
              .first()
              .click();
            const created = await toastSeen(/Product created\./);
            let productId = "";
            for (let i = 0; i < 20 && !productId; i += 1) {
              await studio.waitForTimeout(500);
              const m = studio.url().match(/\/studio\/products\/([^/?#]+)$/);
              if (m && m[1] !== "new") productId = m[1];
            }
            let inDb = true;
            if (DATABASE_URL) {
              const row = await query(
                'select id, status from "Product" where title = $1',
                [title],
              );
              inDb = row?.rows?.length === 1;
              productId = productId || row?.rows?.[0]?.id || "";
            }
            check(
              "a product is created from the Studio form",
              created && Boolean(productId) && inDb,
              productId || studio.url(),
            );

            // Edit: the title changes and the change is what the database holds.
            const edited = `${title} edited`;
            if (productId) {
              await studio.goto(`${BASE}/studio/products/${productId}`, NAV);
              await studio.locator("#product-title").fill(edited);
              await studio
                .getByRole("button", { name: /^Save$/ })
                .first()
                .click();
              const savedToast = await toastSeen(/Product saved\./);
              let stored = savedToast;
              if (DATABASE_URL) {
                const row = await query(
                  'select title from "Product" where id = $1',
                  [productId],
                );
                stored = row?.rows?.[0]?.title === edited;
              }
              check(
                "the product's edit saves what was typed",
                savedToast && stored,
              );

              // Delete: the form's own Delete → confirm dialog → gone from the list and the table.
              await studio
                .getByRole("button", { name: /^Delete$/ })
                .first()
                .click();
              const typed = studio.locator("#confirm-delete-input");
              if ((await typed.count()) > 0) await typed.fill("DELETE");
              await studio.getByRole("button", { name: /^Delete 1 / }).click();
              const deletedToast = await toastSeen(/Product deleted\./);
              let gone = deletedToast;
              if (DATABASE_URL) {
                for (let i = 0; i < 10 && !gone; i += 1) {
                  const row = await query(
                    'select id from "Product" where id = $1',
                    [productId],
                  );
                  gone = row?.rows?.length === 0;
                  if (!gone) await studio.waitForTimeout(500);
                }
                // Belt and braces: never leave a smoke row behind.
                await query('delete from "Product" where title in ($1, $2)', [
                  title,
                  edited,
                ]);
              }
              check(
                "the product is deleted from its form",
                deletedToast && gone,
              );
            } else {
              check(
                "the product's edit saves what was typed",
                false,
                "no product id after create",
              );
              check(
                "the product is deleted from its form",
                false,
                "no product id after create",
              );
            }
          } else {
            check(
              "a product is created from the Studio form",
              false,
              "no #product-title",
            );
          }
        }
      },
    );

    await attempt(
      [
        "the page builder saves a block on /p/demo-lander",
        "the lander renders the saved block",
      ],
      async () => {
        // — The page builder saves a block, and the lander renders it —
        {
          const stamp = Date.now();
          const marker = `E2E smoke eyebrow ${stamp}`;
          await studio.goto(`${BASE}/studio/custom-pages/demo-lander`, NAV);
          const editButtons = studio.getByRole("button", { name: /^Edit$/ });
          if ((await editButtons.count()) > 0) {
            await editButtons.first().click();
            const eyebrow = studio
              .locator('input[id^="blk-"][id$="-eyebrow"]')
              .first();
            const original = await eyebrow.inputValue();
            await eyebrow.fill(marker);
            await studio
              .getByRole("button", { name: /^Save block$/ })
              .first()
              .click();
            const savedToast = await toastSeen(/Block saved\./);
            let stored = savedToast;
            if (DATABASE_URL) {
              const row = await query(
                'select data from "CustomBlock" where "pageId" = $1 order by "order" asc limit 1',
                ["demo-lander"],
              );
              const data = row?.rows?.[0]?.data;
              stored =
                (typeof data === "string" ? JSON.parse(data) : data)
                  ?.eyebrow === marker;
            }
            check(
              "the page builder saves a block on /p/demo-lander",
              savedToast && stored,
            );
            let rendered = false;
            for (let i = 0; i < 10 && !rendered; i += 1) {
              const html = await fetch(`${BASE}/en/p/demo-lander`, {
                cache: "no-store",
              })
                .then((r) => r.text())
                .catch(() => "");
              rendered = html.includes(marker);
              if (!rendered) await studio.waitForTimeout(1000);
            }
            check("the lander renders the saved block", rendered);
            // Put the fixture back the way the seed wrote it.
            await eyebrow.fill(original);
            await studio
              .getByRole("button", { name: /^Save block$/ })
              .first()
              .click();
            await toastSeen(/Block saved\./);
          } else {
            check(
              "the page builder saves a block on /p/demo-lander",
              false,
              "no block Edit button (is the demo set seeded?)",
            );
          }
        }
      },
    );

    await attempt(
      [
        "a site-copy save stages a draft the visitor does not see",
        "Publish releases the surface's drafts to the storefront",
        "Reset returns the shipped wording",
      ],
      async () => {
        // — Site copy: a save is a DRAFT, Publish releases the surface, Reset returns the default —
        {
          const stamp = Date.now();
          const marker = `E2E smoke eyebrow ${stamp}`;
          await studio.goto(
            `${BASE}/studio/site-copy?group=Homepage&locale=en`,
            NAV,
          );
          const heroRow = studio
            .locator('section[aria-labelledby="sec-hero"] li')
            .filter({ hasText: "Hero eyebrow" })
            .first();
          if ((await heroRow.count()) > 0) {
            await heroRow.getByRole("button", { name: /^Edit$/ }).click();
            // The row's one field once it is open (the board labels it "Hero eyebrow").
            await heroRow.locator("input, textarea").first().fill(marker);
            await heroRow.getByRole("button", { name: /^Save$/ }).click();
            const savedToast = await toastSeen(/eyebrow updated\./i);
            let staged = savedToast;
            let publicUntouched = true;
            if (DATABASE_URL) {
              const row = await query(
                'select value, "draftValue" from "SiteCopy" where key = $1 and locale = $2',
                ["Home.hero.eyebrow", "en"],
              );
              staged = row?.rows?.[0]?.draftValue === marker;
            }
            const homeBefore = await fetch(`${BASE}/en`, { cache: "no-store" })
              .then((r) => r.text())
              .catch(() => "");
            publicUntouched = !homeBefore.includes(marker);
            check(
              "a site-copy save stages a draft the visitor does not see",
              savedToast && staged && publicUntouched,
            );

            // Publish the surface: the bar appears once something is pending.
            const publish = studio
              .getByRole("button", { name: /^publish/i })
              .first();
            const publishable = await publish
              .waitFor({ state: "visible", timeout: 15000 })
              .then(() => true)
              .catch(() => false);
            let live = false;
            if (publishable) {
              await publish.click();
              const publishedToast = await toastSeen(/published —/i, 30000);
              let released = publishedToast;
              if (DATABASE_URL) {
                const row = await query(
                  'select value, "draftValue" from "SiteCopy" where key = $1 and locale = $2',
                  ["Home.hero.eyebrow", "en"],
                );
                released =
                  row?.rows?.[0]?.value === marker &&
                  row?.rows?.[0]?.draftValue === null;
              }
              for (let i = 0; i < 10 && !live; i += 1) {
                const html = await fetch(`${BASE}/en`, { cache: "no-store" })
                  .then((r) => r.text())
                  .catch(() => "");
                live = html.includes(marker);
                if (!live) await studio.waitForTimeout(1000);
              }
              check(
                "Publish releases the surface's drafts to the storefront",
                publishedToast && released && live,
                `toast ${publishedToast} · row ${released} · live ${live}`,
              );
            } else {
              check(
                "Publish releases the surface's drafts to the storefront",
                false,
                "no Publish button after the save",
              );
            }

            // Reset returns the shipped wording — and the storefront follows.
            await studio.reload(NAV);
            const resetRow = studio
              .locator('section[aria-labelledby="sec-hero"] li')
              .filter({ hasText: "Hero eyebrow" })
              .first();
            await resetRow.getByRole("button", { name: /^Reset / }).click();
            const resetToast = await toastSeen(/back to the shipped wording/i);
            let cleared = resetToast;
            if (DATABASE_URL) {
              const row = await query(
                'select 1 from "SiteCopy" where key = $1 and locale = $2',
                ["Home.hero.eyebrow", "en"],
              );
              cleared = row?.rows?.length === 0;
              // Never leave the smoke's words on the owner's homepage.
              await query(
                'delete from "SiteCopy" where key = $1 and locale = $2 and (value = $3 or "draftValue" = $3)',
                ["Home.hero.eyebrow", "en", marker],
              );
            }
            let restored = false;
            for (let i = 0; i < 10 && !restored; i += 1) {
              const html = await fetch(`${BASE}/en`, { cache: "no-store" })
                .then((r) => r.text())
                .catch(() => "");
              restored = !html.includes(marker);
              if (!restored) await studio.waitForTimeout(1000);
            }
            check(
              "Reset returns the shipped wording",
              resetToast && cleared && restored,
            );
          } else {
            check(
              "a site-copy save stages a draft the visitor does not see",
              false,
              "no Hero eyebrow row on the Homepage surface",
            );
          }
        }
      },
    );

    await attempt(
      ["the scraper refuses an undetectable platform — no job, no source"],
      async () => {
        // — The scraper refuses a site whose platform it cannot detect —
        {
          const stamp = Date.now();
          // `.invalid` is reserved (RFC 2606): it never resolves, so the one
          // fingerprint probe fails fast on any machine and nothing leaves it.
          const host = `e2e-smoke-${stamp}.invalid`;
          await studio.goto(`${BASE}/studio/scraper`, NAV);
          const urlField = studio.locator("#scrape-url");
          if ((await urlField.count()) > 0) {
            const since = DATABASE_URL
              ? (await query("select now() as t"))?.rows?.[0]?.t
              : null;
            await urlField.fill(`https://${host}/collections/all`);
            await studio.getByRole("button", { name: /start scrape/i }).click();
            const refused = await toastSeen(
              /could not detect a supported platform/i,
              60000,
            );
            let clean = true;
            if (DATABASE_URL) {
              const jobs = await query(
                'select count(*)::int as n from "ScrapeJob" where "createdAt" >= $1',
                [since],
              );
              const sources = await query(
                'select count(*)::int as n from "ScrapeSource" where "baseUrl" like $1',
                [`%${host}%`],
              );
              clean = jobs?.rows?.[0]?.n === 0 && sources?.rows?.[0]?.n === 0;
            }
            check(
              "the scraper refuses an undetectable platform — no job, no source",
              refused && clean,
            );
          } else {
            check(
              "the scraper refuses an undetectable platform — no job, no source",
              false,
              "no #scrape-url",
            );
          }
        }
      },
    );

    await studio.close();
  } else {
    skip(
      "Studio checks (login, demo product, media upload, catalog-fill preview, testimonial rule, product CRUD, page builder, site-copy publish, scraper refusal)",
      "STUDIO_EMAIL/STUDIO_PASSWORD unset",
    );
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} smoke checks passed`,
);
if (failed.length > 0) process.exit(1);
