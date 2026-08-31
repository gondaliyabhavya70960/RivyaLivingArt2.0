/**
 * Chrome (header/footer) verification: the restored original chrome in the
 * Midnight Gild skin. Run against :3111.
 * States captured: header at rest over the home hero (transparent), floating
 * chip after scroll, mega-menu open, mobile dialog open (375), footer rows;
 * plus behavior probes (scroll lock, focus trap presence, aria wiring).
 * Screenshots land in screenshots/chrome-*.png.
 */
import { chromium } from "playwright-core";
import { resolveChromiumPath } from "./lib/browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3111";
const OUT = "screenshots";

const bin = resolveChromiumPath();
const browser = await chromium.launch({
  executablePath: bin,
  args: ["--no-sandbox"],
});

/* ————— desktop ————— */
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
await p.waitForTimeout(1600);
await p.screenshot({ path: `${OUT}/chrome-header-rest-1280.png` });

/* floating chip */
await p.mouse.wheel(0, 600);
await p.waitForTimeout(900);
const chip = await p.evaluate(() => {
  const header = document.querySelector("header");
  const row = header?.querySelector("[data-floating], [class*='max-w-6xl']");
  return {
    dataFloating: header?.getAttribute("data-floating"),
    rowFound: Boolean(row),
    headerHeight: header?.getBoundingClientRect().height,
  };
});
console.log("[chip]", JSON.stringify(chip));
await p.screenshot({ path: `${OUT}/chrome-header-chip-1280.png` });

/* mega-menu */
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(900);
const shopTrigger = p.locator('button[aria-controls="shop-mega"]').first();
if ((await shopTrigger.count()) > 0) {
  await shopTrigger.hover();
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/chrome-mega-1280.png` });
  const megaInfo = await p.evaluate(() => {
    const panel = document.getElementById("shop-mega");
    return panel
      ? `open, links=${panel.querySelectorAll("a").length}, featured-img=${Boolean(panel.querySelector("img"))}`
      : "panel missing";
  });
  console.log("[mega]", megaInfo);
  await p.keyboard.press("Escape");
} else {
  console.log("[mega] trigger not found");
}

/* non-hero route: solid header at rest */
await p.goto(`${BASE}/faq`, { waitUntil: "networkidle", timeout: 240000 });
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/chrome-header-solid-1280.png` });

/* footer */
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1100);
const footerInfo = await p.evaluate(() => {
  const footer = document.querySelector("footer");
  if (!footer) return "missing";
  return {
    newsletter: Boolean(footer.querySelector('input[type="email"]')),
    maps: Boolean(footer.querySelector('a[href*="maps"], a[target="_blank"][href*="goo"]')),
    waSources: [...footer.querySelectorAll("[data-wa-source]")].map((a) =>
      a.getAttribute("data-wa-source"),
    ),
    navs: [...footer.querySelectorAll("nav")].map((n) =>
      n.getAttribute("aria-label"),
    ),
    logoSvg: Boolean(footer.querySelector("svg")),
  };
});
console.log("[footer]", JSON.stringify(footerInfo));
await p.screenshot({ path: `${OUT}/chrome-footer-1280.png` });
await ctx.close();

/* ————— mobile dialog ————— */
const ctxM = await browser.newContext({
  viewport: { width: 375, height: 720 },
  hasTouch: true,
  isMobile: true,
});
const pM = await ctxM.newPage();
await pM.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
await pM.waitForTimeout(1500);
const burger = pM.locator('button[aria-controls="mobile-menu"]').first();
if ((await burger.count()) > 0) {
  await burger.click();
  await pM.waitForTimeout(800);
  const dialogInfo = await pM.evaluate(() => {
    const dialog = document.getElementById("mobile-menu");
    return dialog
      ? {
          role: dialog.getAttribute("role"),
          modal: dialog.getAttribute("aria-modal"),
          bodyLocked: document.body.style.overflow === "hidden",
          headerInert: document.querySelector("header")?.hasAttribute("inert"),
          links: dialog.querySelectorAll("a").length,
        }
      : "missing";
  });
  console.log("[mobile-dialog]", JSON.stringify(dialogInfo));
  await pM.screenshot({ path: `${OUT}/chrome-mobile-menu-375.png` });
  await pM.keyboard.press("Escape");
  await pM.waitForTimeout(500);
  const restored = await pM.evaluate(
    () => document.body.style.overflow !== "hidden",
  );
  console.log("[mobile-dialog] escape closes + unlocks:", restored);
} else {
  console.log("[mobile-dialog] hamburger not found");
}
await pM.screenshot({ path: `${OUT}/chrome-mobile-375.png` });
await ctxM.close();

await browser.close();
console.log("[e2e] chrome sweep complete");
