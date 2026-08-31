/**
 * Phase 6 verification: story & content sweep against :3111.
 * - /about (v2): transparent navbar, CraftChapters pinned scrub (2 checkpoints
 *   + rAF stats on a cold wheel pass), reduced-motion + 375px static fallback
 * - home: §9 UGC band (portfolio-fed) + footer socials + hero video wiring
 *   (socials/heroVideoUrl are set temporarily by the runner via psql)
 * Screenshots land in screenshots/p6-*.png.
 */
import { execSync } from "node:child_process";
import { chromium } from "playwright-core";

const BASE = process.env.P6_BASE ?? "http://localhost:3111";
const OUT = "screenshots";

const bin = execSync("find /opt/pw-browsers/chromium-1194 -name chrome | head -1")
  .toString()
  .trim();
const browser = await chromium.launch({
  executablePath: bin,
  args: ["--no-sandbox"],
});

const headerBg = (p) =>
  p.evaluate(() => {
    const header = document.querySelector('[data-slot="sf-navbar"]');
    return header ? getComputedStyle(header).backgroundColor : "missing";
  });

const chaptersMode = (p) =>
  p.evaluate(() => {
    const stage = document.querySelector('[data-slot="craft-chapters-stage"]');
    const stat = document.querySelector('[data-slot="craft-chapters-static"]');
    if (!stage || !stat) return "missing sections";
    const stageShown = getComputedStyle(stage).display !== "none";
    const statShown = getComputedStyle(stat).display !== "none";
    if (stageShown && !statShown) return "stage";
    if (!stageShown && statShown) return "static";
    return `both? stage=${stageShown} static=${statShown}`;
  });

/* ————— /about desktop pass ————— */
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/about`, { waitUntil: "networkidle", timeout: 240000 });
await p.waitForTimeout(1600);
console.log(`[about] nav top bg=${await headerBg(p)}`);
console.log(`[about] chapters composition: ${await chaptersMode(p)}`);
await p.screenshot({ path: `${OUT}/p6-about-hero-1280.png` });

const wrapper = await p.evaluate(() => {
  const el = document.querySelector('[data-slot="craft-chapters-stage"]');
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { top: rect.top + window.scrollY, height: rect.height };
});
if (wrapper) {
  /* cold wheel pass with rAF sampling through the pinned range */
  await p.evaluate(([y]) => window.scrollTo(0, y), [
    Math.round(wrapper.top - 900),
  ]);
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    const samples = [];
    let last = performance.now();
    const tick = (now) => {
      samples.push(now - last);
      last = now;
      window.__p6raf = requestAnimationFrame(tick);
    };
    window.__p6samples = samples;
    window.__p6raf = requestAnimationFrame(tick);
  });
  for (let i = 0; i < 46; i += 1) {
    await p.mouse.wheel(0, 120);
    await p.waitForTimeout(50);
  }
  const fps = await p.evaluate(() => {
    cancelAnimationFrame(window.__p6raf);
    const s = window.__p6samples.slice(1);
    s.sort((a, b) => a - b);
    return {
      avg: (s.reduce((a, b) => a + b, 0) / s.length).toFixed(1),
      p95: s[Math.floor(s.length * 0.95)].toFixed(1),
      max: Math.max(...s).toFixed(0),
      long: s.filter((x) => x > 34).length,
      n: s.length,
    };
  });
  console.log(
    `[about fps] avg=${fps.avg}ms p95=${fps.p95}ms max=${fps.max}ms frames>34ms=${fps.long}/${fps.n}`,
  );

  await p.waitForTimeout(1800); // Lenis settle before programmatic jumps
  const travel = wrapper.height - 900;
  for (const [i, t] of [0.35, 0.95].entries()) {
    await p.evaluate(([y]) => window.scrollTo(0, y), [
      Math.round(wrapper.top + travel * t),
    ]);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/p6-chapters-${i + 1}-1280.png` });
  }
}

/* maker band + close */
await p.locator("#maker-heading").scrollIntoViewIfNeeded({ timeout: 15000 });
await p.waitForTimeout(900);
await p.screenshot({ path: `${OUT}/p6-about-maker-1280.png` });

/* ————— home: UGC band + footer socials + hero video ————— */
await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
await p.waitForTimeout(1200);
const heroVideo = await p.evaluate(() => {
  const hero = document.querySelector("main section");
  const video = hero?.querySelector("video");
  return video
    ? `video present src=${video.currentSrc || video.querySelector("source")?.src || video.src}`
    : "no video (static image path)";
});
console.log(`[home hero] ${heroVideo}`);
await p.screenshot({ path: `${OUT}/p6-home-hero-1280.png` });

const ugc = await p.evaluate(() => {
  const section = document.querySelector('[data-slot="studio-gallery"]')
    ?? [...document.querySelectorAll("main section")].find((s) =>
      s.querySelector('a[href*="/portfolio/"]'),
    );
  if (!section) return null;
  const tiles = section.querySelectorAll('a[href*="/portfolio"]').length;
  const rect = section.getBoundingClientRect();
  return { tiles, top: rect.top + window.scrollY };
});
if (!ugc) {
  console.log("[home ugc] MISSING");
} else {
  console.log(`[home ugc] portfolio links=${ugc.tiles}`);
  await p.evaluate(([y]) => window.scrollTo(0, y - 120), [Math.round(ugc.top)]);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/p6-home-ugc-1280.png` });
}

/* footer socials */
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1200);
const socials = await p.evaluate(() => {
  const footer = document.querySelector("footer");
  if (!footer) return "no footer";
  const links = [...footer.querySelectorAll('a[target="_blank"]')]
    .map((a) => a.getAttribute("aria-label") || a.textContent.trim())
    .filter(Boolean);
  return links.join(" | ") || "no external links";
});
console.log(`[footer] external links: ${socials}`);
await p.screenshot({ path: `${OUT}/p6-footer-1280.png` });
await ctx.close();

/* ————— reduced-motion + 375 passes on /about ————— */
const ctxRm = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});
const pRm = await ctxRm.newPage();
await pRm.goto(`${BASE}/about`, { waitUntil: "networkidle", timeout: 240000 });
console.log(`[reduced-motion] chapters: ${await chaptersMode(pRm)}`);
await pRm
  .locator("#chapters-heading-static")
  .scrollIntoViewIfNeeded({ timeout: 15000 });
await pRm.waitForTimeout(400);
await pRm.screenshot({ path: `${OUT}/p6-chapters-reduced-1280.png` });
await ctxRm.close();

const ctxM = await browser.newContext({
  viewport: { width: 375, height: 720 },
  hasTouch: true,
  isMobile: true,
});
const pM = await ctxM.newPage();
await pM.goto(`${BASE}/about`, { waitUntil: "networkidle", timeout: 240000 });
await pM.waitForTimeout(1600);
console.log(`[375] chapters: ${await chaptersMode(pM)}`);
await pM.screenshot({ path: `${OUT}/p6-about-hero-375.png` });
await pM
  .locator("#chapters-heading-static")
  .scrollIntoViewIfNeeded({ timeout: 15000 });
await pM.waitForTimeout(400);
await pM.screenshot({ path: `${OUT}/p6-chapters-375.png` });
await ctxM.close();

await browser.close();
console.log("[e2e] phase 6 sweep complete");
