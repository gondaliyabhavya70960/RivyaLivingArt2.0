import { chromium } from "playwright-core";

const OUT = process.env.OUT_DIR || "screenshots";
const URL = "http://localhost:3111/design-lab";

import { resolveChromiumPath } from "./lib/browser.mjs";
const bin = resolveChromiumPath();

const browser = await chromium.launch({
  executablePath: bin || "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});

const errors = [];
async function shoot(width, height, name) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${name}] console: ${m.text().slice(0, 300)}`);
  });
  const resp = await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  errors.push(`[${name}] HTTP ${resp?.status()}`);
  // Walk the page so lazy content settles.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 800) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await page.close();
}

await shoot(1280, 900, "lab-1280");
await shoot(375, 800, "lab-375");
await browser.close();
console.log(errors.join("\n") || "no console/page errors");
