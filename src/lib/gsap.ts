import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { cubicBezier } from "@/lib/bezier-ease";
import { EASE_LUXURY, EASE_SETTLE } from "@/lib/motion-tokens";

/**
 * The one GSAP entry point. Every consumer reaches it through
 * `await import("@/lib/gsap")` behind a reduced-motion / touch guard, so the
 * library lands in one shared chunk and never in the initial bundle.
 *
 * `SplitText` was registered here until D18 deleted `kinetic-heading.tsx`,
 * its only consumer. A registered plugin with no caller is not free: it is
 * 3.6 KB gzipped inside the very chunk `scripts/motion-budget.mjs` weighs
 * against Part 14's budget, so it was pure dead weight on every route that
 * uses any GSAP effect. If a future phase brings back a text reveal
 * (roadmap Phase 1b's `sf-hero-rise`, gated on D20), re-add it here.
 *
 * `"luxury"`/`"settle"` register the Part 3.8 house curves as named GSAP
 * eases, from the same control points `tokens.css` defines (mirrored in
 * `motion-tokens.ts`, checked against the CSS by a test) — so `ease:
 * "luxury"` moves a tween on the identical curve a CSS transition using
 * `ease-(--ease-luxury)` does. This is `gsap.registerEase` +
 * `src/lib/bezier-ease.ts`'s ~30-line Newton–Raphson solver, not
 * `gsap/CustomEase`: CustomEase is a separate plugin at ~2.5 KB gzipped,
 * which would breach the 49 KB ratchet `scripts/motion-budget.mjs` enforces
 * for a feature this small — two fixed curves, never edited at runtime, are
 * exactly what a plugin built for arbitrary/user-drawn eases is overkill for.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
  gsap.registerEase("luxury", cubicBezier(...EASE_LUXURY));
  gsap.registerEase("settle", cubicBezier(...EASE_SETTLE));
}

export { gsap, ScrollTrigger };
