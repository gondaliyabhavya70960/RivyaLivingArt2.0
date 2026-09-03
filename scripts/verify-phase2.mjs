/**
 * Phase 2 verification (DESIGN.md E8): screenshots of the rebuilt Home /
 * Shop / PDP at 1280+375, then the end-to-end order flow — fill the PDP
 * customization form, submit, assert the wa.me deep link and the /whatsapp-
 * order fallback. Dev-only tooling; expects `next dev` on :3000 (BASE_URL) against the
 * local Postgres. Usage: node scripts/verify-phase2.mjs [product-slug]
 */
import { chromium } from "playwright-core";
import { resolveChromiumPath } from "./lib/browser.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SLUG =
  process.argv[2] ??
  "varmala-preservation-resin-clock-custom-anniversary-keepsake";
const OUT = "screenshots";

const bin = resolveChromiumPath();
const browser = await chromium.launch({
  executablePath: bin,
  args: ["--no-sandbox"],
});

const errors = [];
async function page(width, height) {
  const p = await browser.newPage({ viewport: { width, height } });
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`);
  });
  return p;
}

async function shoot(path, name) {
  for (const [w, h, tag] of [
    [1280, 900, "1280"],
    [375, 800, "375"],
  ]) {
    const p = await page(w, h);
    const resp = await p.goto(`${BASE}${path}`, {
      waitUntil: "networkidle",
      timeout: 180000,
    });
    console.log(`[${name}-${tag}] HTTP ${resp?.status()}`);
    await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 800) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
    });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: true });
    await p.close();
  }
}

if (!process.env.SKIP_SHOTS) {
  await shoot("/", "p2-home");
  await shoot("/shop", "p2-shop");
  await shoot(`/product/${SLUG}`, "p2-pdp");
}

/* ————— E2E order flow ————— */
const p = await page(1280, 900);
await p.goto(`${BASE}/product/${SLUG}`, {
  waitUntil: "networkidle",
  timeout: 180000,
});

// Scope to the order panel — the navbar's locale <select> is also a combobox.
const panel = p.locator("#order-panel");
// Size (radix SELECT — options portal to <body>)
await panel.getByRole("combobox").first().click();
await p.getByRole("option", { name: "16 inch" }).click();
// Base colour (SWATCH chips)
await panel.getByRole("button", { name: /Ivory/ }).first().click();
// Engraving (TEXT)
await panel.getByLabel(/engraving/i).fill("A & R · 14.02.2026");
// Contact
await panel
  .getByRole("textbox", { name: "Name (required)" })
  .fill("Local E2E Test");
await panel
  .getByRole("textbox", { name: /^Phone/ })
  .fill("+91 90000 00001");
await panel
  .getByRole("textbox", { name: /Additional notes/i })
  .fill("Local end-to-end verification — safe to close.");

// Spam gate: formStartedAt must be ≥2.5s old.
await p.waitForTimeout(3200);

const popupPromise = p.waitForEvent("popup", { timeout: 30000 }).catch(() => null);
await p.getByRole("button", { name: /place order/i }).click();
const popup = await popupPromise;
const waUrl = popup ? popup.url() : "(no popup)";
console.log(`[e2e] wa.me URL: ${waUrl.slice(0, 140)}…`);
if (popup) await popup.close();

await p
  .waitForURL(/whatsapp-order/, { timeout: 30000 })
  .then(() => console.log("[e2e] landed on /whatsapp-order fallback ✓"))
  .catch(() => console.log("[e2e] NO fallback redirect ✗"));
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/p2-fallback-1280.png`, fullPage: true });
await p.close();
await browser.close();

const ok =
  waUrl.startsWith("https://wa.me/") &&
  /Size/.test(decodeURIComponent(waUrl)) &&
  /16 inch/.test(decodeURIComponent(waUrl));
console.log(`[e2e] message carries selections: ${ok ? "✓" : "✗"}`);
console.log(errors.length ? errors.slice(0, 12).join("\n") : "no console/page errors");
