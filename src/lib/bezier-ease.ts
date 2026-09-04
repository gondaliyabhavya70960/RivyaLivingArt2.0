/**
 * A CSS-spec cubic-bezier easing solver — pure, no dependency.
 *
 * `gsap.registerEase` (src/lib/gsap.ts) needs a plain `(p: number) => number`
 * function to install the house curves as named GSAP eases; `gsap/CustomEase`
 * would do the same job but adds ~2.5 KB gzipped to the shared motion chunk,
 * which `scripts/motion-budget.mjs` weighs against Part 14's 45 KB ceiling.
 * This file is the ~30-line alternative: solve the bezier's `x(t) = p` for
 * `t` with Newton–Raphson (the same method browsers use internally), then
 * evaluate `y(t)`.
 */

/** Newton–Raphson converges in well under this for every curve this repo
 *  uses (the two Part 3.8 house curves have no near-vertical tangents). */
const NEWTON_ITERATIONS = 8;

/** A near-zero slope means the tangent is too flat to trust for a Newton
 *  step — bail out at the current guess rather than divide by ~0. */
const MIN_SLOPE = 1e-6;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** One axis of a cubic bezier at parametric `t`, given its two control
 *  ordinates (the curve always starts at 0 and ends at 1). */
function bezierAt(t: number, p1: number, p2: number): number {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return ((a * t + b) * t + c) * t;
}

/** The derivative of `bezierAt`, needed for the Newton step. */
function bezierSlope(t: number, p1: number, p2: number): number {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return 3 * a * t * t + 2 * b * t + c;
}

/**
 * Build a CSS `cubic-bezier(x1, y1, x2, y2)`-compatible easing function.
 *
 * `x1`/`x2` are clamped to [0, 1] — the CSS spec's own requirement, and the
 * reason the curve is a function of x at all (a Newton search assumes a
 * unique `t` for every `x`, which an out-of-range control point can break).
 * `y1`/`y2` are left unclamped, same as CSS: an easing that overshoots past
 * 0 or 1 (a bounce, a slight anticipation) is legal and this repo's two
 * house curves both have a `y1`/`y2` of exactly 1, right at that edge.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (p: number) => number {
  const cx1 = clamp01(x1);
  const cx2 = clamp01(x2);

  function solveT(x: number): number {
    let t = x; // The curve is close to linear near its own control points,
    // so `x` itself is already a good first guess.
    for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
      const slope = bezierSlope(t, cx1, cx2);
      if (Math.abs(slope) < MIN_SLOPE) break;
      t -= (bezierAt(t, cx1, cx2) - x) / slope;
    }
    return clamp01(t);
  }

  return function ease(p: number): number {
    // Fast paths: every caller evaluates exactly 0 and 1 at the ends of a
    // tween, and the curve is defined to pass through them exactly — no
    // reason to run the solver just to arrive back at an endpoint.
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    return bezierAt(solveT(p), y1, y2);
  };
}
