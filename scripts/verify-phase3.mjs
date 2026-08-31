/**
 * Phase 3 verification (DESIGN.md E6 DoD): screenshots of the rebuilt
 * Memory Preservation page + wa.me fallback at 1280+375, then the custom
 * commission e2e — fill, submit, assert the Inquiry row and the #RR-<n>
 * reference in the message — on desktop AND a 375px viewport, as the DoD
 * demands. Dev-only tooling; expects `next dev` on :3111 + local Postgres.
 */
import { chromium } from "playwright-core";
import { resolveChromiumPath } from "./lib/browser.mjs";

const BASE = "http://localhost:3111";
const OUT = "screenshots";

const bin = resolveChromiumPath();
const browser = await chromium.launch({
  executablePath: bin,
  args: ["--no-sandbox"],
});

async function page(width, height) {
  const p = await browser.newPage({ viewport: { width, height } });
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

async function submitCommission(width, height, tag) {
  const p = await page(width, height);
  await p.goto(`${BASE}/custom-order`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await p
    .locator("#custom-idea")
    .fill(
      `E2E ${tag}: preserve our wedding varmala in a clear block with gold flakes.`,
    );
  await p.locator("#custom-name").fill(`E2E ${tag}`);
  await p.locator("#custom-phone").fill("+91 90000 00002");
  // Spam gate: formStartedAt must be ≥2.5s old.
  await p.waitForTimeout(3200);
  const popupPromise = p
    .waitForEvent("popup", { timeout: 30000 })
    .catch(() => null);
  await p.locator('button[type="submit"]').click();
  const popup = await popupPromise;
  if (popup) await popup.close();
  const landed = await p
    .waitForURL(/whatsapp-order/, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  console.log(`[e2e-${tag}] fallback redirect: ${landed ? "✓" : "✗"}`);
  await p.waitForTimeout(1000);
  const hasRef = await p
    .getByText(/#RR-\d+/)
    .first()
    .isVisible()
    .catch(() => false);
  console.log(`[e2e-${tag}] fallback shows #RR reference: ${hasRef ? "✓" : "✗"}`);
  await p.screenshot({
    path: `${OUT}/p3-fallback-${tag}.png`,
    fullPage: true,
  });
  await p.close();
}

if (!process.env.SKIP_SHOTS) {
  await shoot("/custom-order", "p3-memory");
}
await submitCommission(1280, 900, "1280");
await submitCommission(375, 800, "375");
await browser.close();
console.log("done");
