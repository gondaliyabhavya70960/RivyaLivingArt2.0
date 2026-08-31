/**
 * Phase 5 verification: signature-motion smoke test.
 * Run against a PRODUCTION server (`next build` + `next start`) for FPS
 * numbers that mean anything; a dev server works for the visual checks.
 * - transparent-over-hero navbar (home top) → solid after scroll
 * - pinned pour→cure showcase: CSS-gated composition choice, canvas draws,
 *   wheel-driven COLD first pass through the pinned range with rAF stats
 *   (avg / p95 / max / long frames), then three scrub checkpoints
 * - reduced-motion + 375px touch → static composition (animated display:none)
 * Screenshots land in screenshots/p5-*.png.
 */
import { execSync } from "node:child_process";
import { chromium } from "playwright-core";

const BASE = process.env.P5_BASE ?? "http://localhost:3111";
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

/** Which showcase composition is visible? -> "stage" | "static" | report */
const showcaseMode = (p) =>
  p.evaluate(() => {
    const stage = document.querySelector('[data-slot="pour-cure-stage"]');
    const stat = document.querySelector('[data-slot="pour-cure-static"]');
    if (!stage || !stat) return "missing sections";
    const stageShown = getComputedStyle(stage).display !== "none";
    const statShown = getComputedStyle(stat).display !== "none";
    if (stageShown && !statShown) return "stage";
    if (!stageShown && statShown) return "static";
    return `both? stage=${stageShown} static=${statShown}`;
  });

/* ————— desktop pass ————— */
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
await p.waitForTimeout(1600); // preloader window + SplitText entrance

const bgTop = await headerBg(p);
await p.screenshot({ path: `${OUT}/p5-home-hero-1280.png` });

console.log(`[showcase] desktop composition: ${await showcaseMode(p)}`);

/* Cold first-pass FPS: wheel continuously from just above the stage to its
   end, sampling rAF intervals ONLY inside the pinned range. Runs before any
   checkpoint jump so the frames arrive mid-scroll like a real first visit. */
const wrapper = await p.evaluate(() => {
  const el = document.querySelector('[data-slot="pour-cure-stage"]');
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { top: rect.top + window.scrollY, height: rect.height };
});
if (!wrapper) {
  console.log("[showcase] MISSING — stage section not found");
} else {
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
      window.__p5raf = requestAnimationFrame(tick);
    };
    window.__p5samples = samples;
    window.__p5raf = requestAnimationFrame(tick);
  });
  // ~40 wheel ticks of 120px ≈ 900px lead-in + the 2-viewport pinned travel.
  for (let i = 0; i < 40; i += 1) {
    await p.mouse.wheel(0, 120);
    await p.waitForTimeout(50);
  }
  const fps = await p.evaluate(() => {
    cancelAnimationFrame(window.__p5raf);
    const s = window.__p5samples.slice(1);
    s.sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / s.length;
    const p95 = s[Math.floor(s.length * 0.95)];
    return {
      avg: avg.toFixed(1),
      p95: p95.toFixed(1),
      max: Math.max(...s).toFixed(0),
      long: s.filter((x) => x > 34).length,
      n: s.length,
    };
  });
  console.log(
    `[fps] cold first pass: avg=${fps.avg}ms p95=${fps.p95}ms max=${fps.max}ms frames>34ms=${fps.long}/${fps.n}`,
  );

  /* scrub checkpoints — let Lenis's post-wheel inertia settle first, or its
     raf loop overrides the programmatic jumps back toward its own target */
  await p.waitForTimeout(1800);
  const travel = wrapper.height - 900;
  for (const [i, t] of [0.12, 0.5, 0.92].entries()) {
    await p.evaluate(([y]) => window.scrollTo(0, y), [
      Math.round(wrapper.top + travel * t),
    ]);
    await p.waitForTimeout(900); // scrub 0.5 settle
    await p.screenshot({ path: `${OUT}/p5-showcase-${i + 1}-1280.png` });
  }
  const canvasInfo = await p.evaluate(() => {
    const canvas = document.querySelector('[data-slot="pour-cure-stage"] canvas');
    if (!canvas) return "no canvas";
    const ctx2 = canvas.getContext("2d");
    const { data } = ctx2.getImageData(
      Math.floor(canvas.width / 2),
      Math.floor(canvas.height / 2),
      8,
      8,
    );
    const lit = data.some((v, idx) => idx % 4 !== 3 && v > 8);
    return `canvas ${canvas.width}x${canvas.height} drawn=${lit}`;
  });
  console.log(`[showcase] ${canvasInfo}`);
}

/* navbar states — checked after the scroll work so bgTop is the cold value */
await p.evaluate(() => window.scrollTo(0, 400));
await p.waitForTimeout(600);
const bgScrolled = await headerBg(p);
console.log(`[nav] top bg=${bgTop} scrolled bg=${bgScrolled}`);
if (!/rgba?\(.*0\)$|transparent/.test(bgTop.replaceAll(" ", ""))) {
  console.log("[nav] WARN: header not transparent at top of home");
}
await p.screenshot({ path: `${OUT}/p5-home-navsolid-1280.png` });

/* custom-order transparent hero */
await p.goto(`${BASE}/custom-order`, {
  waitUntil: "networkidle",
  timeout: 240000,
});
await p.waitForTimeout(800);
console.log(`[nav] custom-order top bg=${await headerBg(p)}`);
await p.screenshot({ path: `${OUT}/p5-customorder-hero-1280.png` });
await ctx.close();

/* ————— reduced-motion pass ————— */
const ctxRm = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});
const pRm = await ctxRm.newPage();
await pRm.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
console.log(`[reduced-motion] showcase composition: ${await showcaseMode(pRm)}`);
await pRm
  .locator("#showcase-heading-static")
  .scrollIntoViewIfNeeded({ timeout: 15000 });
await pRm.waitForTimeout(400);
await pRm.screenshot({ path: `${OUT}/p5-showcase-reduced-1280.png` });
await ctxRm.close();

/* ————— 375px (touch / coarse pointer) pass ————— */
const ctxM = await browser.newContext({
  viewport: { width: 375, height: 720 },
  hasTouch: true,
  isMobile: true,
});
const pM = await ctxM.newPage();
await pM.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
await pM.waitForTimeout(1600);
await pM.screenshot({ path: `${OUT}/p5-home-hero-375.png` });
console.log(`[375] showcase composition: ${await showcaseMode(pM)}`);
await pM
  .locator("#showcase-heading-static")
  .scrollIntoViewIfNeeded({ timeout: 15000 });
await pM.waitForTimeout(400);
await pM.screenshot({ path: `${OUT}/p5-showcase-375.png` });
await ctxM.close();

await browser.close();
console.log("[e2e] phase 5 sweep complete");
