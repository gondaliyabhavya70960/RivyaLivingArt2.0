import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

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
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };
