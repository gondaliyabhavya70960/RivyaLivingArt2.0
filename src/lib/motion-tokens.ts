/**
 * Part 3.8's two curves and four durations, as JS values.
 *
 * `src/styles/tokens.css` is the source of truth (`--ease-luxury`,
 * `--ease-settle`, `--dur-fast|base|slow|reveal`); this file mirrors them for
 * code that cannot read a CSS custom property — `gsap.registerEase` (needs
 * the raw control points, not a `cubic-bezier()` string) and any JS timer
 * that has to agree with a CSS transition it is coordinating with.
 * `motion-tokens.test.ts` reads tokens.css back and asserts these stay in
 * lockstep, so a tokens.css edit that forgets this file fails a test instead
 * of silently animating two different curves.
 */

/** `--ease-luxury: cubic-bezier(0.16, 1, 0.3, 1)` — the house curve. */
export const EASE_LUXURY: readonly [number, number, number, number] = [
  0.16, 1, 0.3, 1,
];

/** `--ease-settle: cubic-bezier(0.22, 0.61, 0.36, 1)` — UI state changes. */
export const EASE_SETTLE: readonly [number, number, number, number] = [
  0.22, 0.61, 0.36, 1,
];

/** `--dur-fast: 180ms`. */
export const DUR_FAST_MS = 180;
/** `--dur-base: 350ms`. */
export const DUR_BASE_MS = 350;
/** `--dur-slow: 800ms`. */
export const DUR_SLOW_MS = 800;
/** `--dur-reveal: 900ms`. */
export const DUR_REVEAL_MS = 900;
