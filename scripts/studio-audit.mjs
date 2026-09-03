#!/usr/bin/env node
/**
 * The Studio's own audit — the gate the storefront has had since Part 19 and
 * the staff panel never did.
 *
 *   STUDIO_EMAIL=… STUDIO_PASSWORD=… node scripts/studio-audit.mjs [--w 390]
 *   node scripts/studio-audit.mjs "/studio,/studio/products" [--w 390]
 *
 * `a11y-audit.mjs` and `redesign-audit.mjs` cover 12 PUBLIC routes. Every
 * /studio route sits behind `requireStaffPage`, so an unauthenticated audit
 * only ever measures the login screen — which is why 41 screens the owner uses
 * all day have never been checked by anything. This logs in once, reuses the
 * session cookie, and runs axe plus the structural checks that actually bite
 * in a dense admin UI.
 *
 * Fails on axe `critical`/`serious` (§19.6) and on the structural checks.
 * Moderate and minor are printed, not failed — a gate that cries wolf stops
 * being read.
 */
import { AxeBuilder } from "@axe-core/playwright";

import { launchChromium } from "./lib/browser.mjs";

const DEFAULT_ROUTES = [
  "/studio",
  "/studio/products",
  "/studio/products/new",
  "/studio/categories",
  "/studio/inquiries",
  "/studio/media",
  "/studio/site-images",
  "/studio/site-copy",
  "/studio/sections",
  "/studio/navigation",
  "/studio/forms",
  "/studio/custom-pages",
  "/studio/blog",
  "/studio/portfolio",
  "/studio/testimonials",
  "/studio/faqs",
  "/studio/pages",
  "/studio/scraper",
  "/studio/scraper/sources",
  "/studio/scraper/review",
  "/studio/scraper/quality",
  "/studio/scraper/mapping",
  "/studio/sheet-import",
  "/studio/import",
  "/studio/analytics",
  "/studio/subscribers",
  "/studio/settings",
  "/studio/seo",
  "/studio/users",
  "/studio/activity",
  "/studio/testimonials/new",
];

const args = process.argv.slice(2);
const widthIndex = args.indexOf("--w");
const width = widthIndex === -1 ? 1440 : Number(args[widthIndex + 1]);
const routesArg = args.find((a) => a.startsWith("/"));
const routes = routesArg ? routesArg.split(",") : DEFAULT_ROUTES;

const base = process.env.BASE_URL ?? "http://localhost:3000";
const email = process.env.STUDIO_EMAIL;
const password = process.env.STUDIO_PASSWORD;
if (!email || !password) {
  console.error("STUDIO_EMAIL and STUDIO_PASSWORD are required — every");
  console.error("/studio route is behind requireStaffPage, and an audit that");
  console.error("cannot log in silently measures the login screen 30 times.");
  process.exit(1);
}

const browser = await launchChromium();
const context = await browser.newContext({
  viewport: { width, height: width < 700 ? 844 : 900 },
});
const page = await context.newPage();

// ── Sign in once; every route below reuses the cookie. ────────────────────
await page.goto(`${base}/studio/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await Promise.all([
  page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 60_000 }),
  page.click('button[type="submit"]'),
]).catch(() => {});
if (page.url().includes("/login")) {
  console.error(`\nSign-in failed for ${email} — audit cannot proceed.`);
  await browser.close();
  process.exit(1);
}
console.log(`signed in as ${email} · ${width}px · ${routes.length} routes`);

let blocking = 0;
const note = (route, msg) => {
  blocking += 1;
  console.log(`  ✗ ${msg}`);
  failures.push(`${route} — ${msg}`);
};
const failures = [];

for (const route of routes) {
  console.log(`\n${route}`);
  let status = 0;
  try {
    const res = await page.goto(base + route, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    status = res?.status() ?? 0;
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
  } catch (err) {
    note(route, `did not load: ${err.message.split("\n")[0]}`);
    continue;
  }

  // A route that 404s still renders a perfectly accessible not-found page, so
  // without this a typo in the route list reports "ok" and the screen it was
  // meant to cover is never checked at all.
  if (status >= 400) {
    note(route, `HTTP ${status} — route does not exist or is not reachable`);
    continue;
  }

  if (page.url().includes("/studio/login")) {
    note(route, "bounced to login — session lost mid-audit");
    continue;
  }

  // ── axe (§19.6) ────────────────────────────────────────────────────────
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  for (const v of violations) {
    const line = `${v.impact}: ${v.id} (${v.nodes.length}) — ${v.help}`;
    if (v.impact === "critical" || v.impact === "serious") {
      note(route, line);
      console.log(`      ${v.nodes[0]?.target?.join(" ")}`);
    } else {
      console.log(`  · ${line}`);
    }
  }

  // ── Structural checks the storefront audit makes, applied here ─────────
  const structure = await page.evaluate(() => {
    const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    // `sr-only` is a 1px clipped box: visible to a screen reader, invisible to
    // the eye, and meaningless to a target-size check. Counting it reported
    // the skip link as an undersized target on all 30 routes.
    const screenReaderOnly = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 4 || r.height > 4) return false;
      const cs = getComputedStyle(el);
      return cs.position === "absolute" || cs.clip !== "auto" || cs.clipPath !== "none";
    };

    const h1s = [...document.querySelectorAll("h1")].filter(visible).map(text);

    // Heading order: a jump from h2 to h4 reads as a missing section to a
    // screen reader walking the outline.
    const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter(visible)
      .map((el) => Number(el.tagName[1]));
    const jumps = [];
    for (let i = 1; i < levels.length; i += 1) {
      if (levels[i] - levels[i - 1] > 1) {
        jumps.push(`h${levels[i - 1]} → h${levels[i]}`);
      }
    }

    // Controls whose only content is an icon, with nothing to announce.
    //
    // The name has to be computed the way a screen reader computes it — an
    // aria-label, an aria-labelledby target, a <label for>, a wrapping
    // <label>, a title, then the text. Checking only aria-label and
    // textContent reports every properly-labelled Radix checkbox in the
    // Studio as broken, which is how a gate teaches people to ignore it.
    const accessibleName = (el) => {
      const aria = el.getAttribute("aria-label");
      if (aria && aria.trim()) return aria.trim();
      const by = el.getAttribute("aria-labelledby");
      if (by) {
        const named = by
          .split(/\s+/)
          .map((id) => text(document.getElementById(id)))
          .filter(Boolean)
          .join(" ");
        if (named) return named;
      }
      if (el.id) {
        const forLabel = document.querySelector(
          `label[for="${CSS.escape(el.id)}"]`,
        );
        if (forLabel && text(forLabel)) return text(forLabel);
      }
      const wrapping = el.closest("label");
      if (wrapping && text(wrapping)) return text(wrapping);
      const title = el.getAttribute("title");
      if (title && title.trim()) return title.trim();
      return text(el);
    };

    const nameless = [...document.querySelectorAll("button, a[href], [role=checkbox], [role=switch]")]
      .filter(visible)
      .filter((el) => !screenReaderOnly(el))
      .filter((el) => accessibleName(el).length === 0)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}` +
          `[${(el.className || "").toString().split(" ")[0] || "?"}]`,
      );

    // Tap targets — the Studio is used on a phone in a workshop.
    // WCAG 2.2 §2.5.8 target size (minimum) is 24×24, and exempts a control
    // that is inline in a sentence. The Studio gets used on a phone in a
    // workshop, so this is a real check — but only over standalone controls.
    const small = [...document.querySelectorAll("button, a[href], [role=button]")]
      .filter(visible)
      .filter((el) => !screenReaderOnly(el))
      .filter((el) => {
        const parentText = (el.parentElement?.textContent ?? "").trim();
        const own = text(el);
        if (own && parentText.length > own.length + 12) return false; // inline in prose
        const r = el.getBoundingClientRect();
        // A ::before can enlarge the hit area beyond the border box — the
        // Studio's checkboxes stay a 16px square but take a 24px target that
        // way. Measuring the element alone reports them as too small.
        const before = getComputedStyle(el, "::before");
        const px = (v) => (v && v.endsWith("px") ? parseFloat(v) : 0);
        const w = Math.max(r.width, px(before.width));
        const h = Math.max(r.height, px(before.height));
        return h < 24 || w < 24;
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${text(el).slice(0, 24)}" ` +
          `${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`,
      );

    // Data tables without a header row cannot be navigated by column.
    const headless = [...document.querySelectorAll("table")]
      .filter(visible)
      .filter((t) => t.querySelectorAll("th").length === 0).length;

    return {
      h1s,
      jumps,
      nameless,
      small,
      headless,
      overflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });

  if (structure.h1s.length === 0) note(route, "no <h1> — the page has no name");
  if (structure.h1s.length > 1) {
    note(route, `${structure.h1s.length} <h1>: ${structure.h1s.join(" | ")}`);
  }
  if (structure.overflow) {
    note(
      route,
      `horizontal overflow: ${structure.scrollWidth}px in ${structure.clientWidth}px`,
    );
  }
  if (structure.headless > 0) {
    note(route, `${structure.headless} table(s) with no <th>`);
  }
  if (structure.nameless.length > 0) {
    note(
      route,
      `${structure.nameless.length} control(s) with no accessible name: ${structure.nameless.slice(0, 3).join(", ")}`,
    );
  }
  if (structure.jumps.length > 0) {
    console.log(`  · heading level jumps: ${structure.jumps.join(", ")}`);
  }
  if (structure.small.length > 0) {
    console.log(
      `  · ${structure.small.length} target(s) under 24px: ${structure.small.slice(0, 3).join(", ")}`,
    );
  }
  if (blocking === 0 || !failures.some((f) => f.startsWith(route))) {
    console.log("  ok");
  }
}

await browser.close();

console.log(`\n${"─".repeat(60)}`);
if (blocking > 0) {
  console.log(`${blocking} blocking finding(s) at ${width}px:\n`);
  for (const f of failures) console.log(`  ${f}`);
} else {
  console.log(`clean at ${width}px across ${routes.length} studio routes`);
}
process.exitCode = blocking > 0 ? 1 : 0;
