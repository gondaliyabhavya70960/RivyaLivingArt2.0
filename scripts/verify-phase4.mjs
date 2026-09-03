/**
 * Phase 4 verification: staff login → dashboard / inquiries screenshots →
 * pricing e2e (set quoted price + staff note on an inquiry, save, verify).
 * Dev-only; expects `next dev` on :3000 (BASE_URL), local Postgres, and the local
 * admin (STUDIO_EMAIL / STUDIO_PASSWORD — never a real account).
 */
import { chromium } from "playwright-core";
import { resolveChromiumPath } from "./lib/browser.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "screenshots";

// Credentials come from the environment so none is committed. scripts/ci-staff-user.ts
// creates the matching row and refuses any non-local DATABASE_URL.
const STUDIO_EMAIL = process.env.STUDIO_EMAIL ?? "studio-audit@example.com";
const STUDIO_PASSWORD = process.env.STUDIO_PASSWORD ?? "ci-studio-audit-only";

const bin = resolveChromiumPath();
const browser = await chromium.launch({
  executablePath: bin,
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();

// Login
await p.goto(`${BASE}/studio/login`, { waitUntil: "networkidle", timeout: 180000 });
await p.screenshot({ path: `${OUT}/p4-login-1280.png`, fullPage: true });
await p.locator('input[name="email"]').fill(STUDIO_EMAIL);
await p.locator('input[name="password"]').fill(STUDIO_PASSWORD);
await p.locator('button[type="submit"]').click();
await p.waitForURL(/\/studio(?!\/login)/, { timeout: 60000 });
console.log("[e2e] logged in ✓");

// Dashboard
await p.goto(`${BASE}/studio`, { waitUntil: "networkidle", timeout: 180000 });
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/p4-dashboard-1280.png`, fullPage: true });

// Inquiries list
await p.goto(`${BASE}/studio/inquiries`, { waitUntil: "networkidle", timeout: 180000 });
await p.screenshot({ path: `${OUT}/p4-inquiries-1280.png`, fullPage: true });

// Open the #RR-3 inquiry via its row link
await p.getByRole("link", { name: "E2E 1280" }).first().click();
await p.waitForLoadState("networkidle");

// Pricing e2e
await p.getByLabel(/quoted price/i).fill("4999");
await p.getByLabel(/staff notes/i).fill("Quoted over WhatsApp — customer thinking it over.");
await p.getByRole("button", { name: /save/i }).click();
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/p4-inquiry-detail-1280.png`, fullPage: true });
console.log("[e2e] pricing saved (verify DB next)");

await browser.close();
