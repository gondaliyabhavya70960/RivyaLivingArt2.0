/**
 * One animation runtime, and it is GSAP + Lenis.
 *
 * `scripts/motion-budget.mjs` enforces this, but it only runs in CI and only
 * after `npm run build` — so the feedback arrives minutes after the mistake,
 * on a machine that is not yours. This test asks the same question in the unit
 * suite, where it answers in seconds.
 *
 * It exists because the budget gate had a hole worth naming: it detected
 * libraries by guessing at markers in minified chunks, and nothing in its table
 * looked for framer-motion. Most of the component libraries an owner is likely
 * to reach for ship on it, so the gate that exists to keep a second runtime out
 * would have let one through — silently, because a marker that matches nothing
 * measures zero rather than failing.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const script = readFileSync("scripts/motion-budget.mjs", "utf8");

const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);

describe("motion runtime", () => {
  it("ships no second animation runtime", () => {
    // GSAP + Lenis already spend the whole 49 KB ceiling. `motion` alone is
    // ~30 KB, so this is not "does it fit" — it is "which one goes", and that
    // is owner decision D29 rather than a dependency somebody adds in passing.
    for (const banned of [
      "motion",
      "framer-motion",
      "@react-spring/web",
      "react-spring",
      "@formkit/auto-animate",
      "animejs",
      "popmotion",
      "react-motion",
      "@motionone/dom",
    ]) {
      expect(declared.has(banned), `${banned} is installed`).toBe(false);
    }
  });

  it("still ships the runtime it is budgeted for", () => {
    // The inverse guard: if GSAP or Lenis ever leave, the budget script's
    // marker table measures nothing and reports a comfortable zero. A gate
    // that passes because it found nothing is worse than no gate.
    expect(declared.has("gsap")).toBe(true);
    expect(declared.has("lenis")).toBe(true);
  });

  it("keeps the dependency guard in the budget script", () => {
    // Pinned as text because the check runs before any build exists, which is
    // exactly the moment it is useful — and because deleting it would restore
    // the hole without failing anything else.
    expect(script).toMatch(/const BANNED_RUNTIMES = \[/);
    expect(script).toMatch(/function bannedDependencies\(\)/);
    expect(script).toMatch(/const banned = bannedDependencies\(\);/);
    // It must run BEFORE the chunk walk, or a tree nobody has built yet
    // reports "run npm run build first" and never reaches the guard.
    expect(script.indexOf("const banned = bannedDependencies();")).toBeLessThan(
      script.indexOf("const files = walk(DIR);"),
    );
  });

  it("does not ban three, which is a deliberate exception", () => {
    // `three` IS installed and IS a motion library, but it renders the PDP's
    // 3D model behind a demand-loaded viewer no other route pays for. Banning
    // it would fail the gate for architecture that is already correct.
    expect(declared.has("three")).toBe(true);
    // `[^\]]` already spans newlines, so the dotAll flag would be redundant —
    // and it is not available at this tsconfig target.
    expect(script).not.toMatch(/BANNED_RUNTIMES = \[[^\]]*"three"/);
  });
});
