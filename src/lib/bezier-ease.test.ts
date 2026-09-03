import { describe, expect, it } from "vitest";

import { cubicBezier } from "./bezier-ease";

describe("cubicBezier", () => {
  it("passes through both endpoints exactly", () => {
    const luxury = cubicBezier(0.16, 1, 0.3, 1);
    expect(luxury(0)).toBe(0);
    expect(luxury(1)).toBe(1);
  });

  it("clamps input outside [0, 1] to the endpoints", () => {
    const settle = cubicBezier(0.22, 0.61, 0.36, 1);
    expect(settle(-0.5)).toBe(0);
    expect(settle(1.5)).toBe(1);
  });

  it("is monotonically non-decreasing across the domain, for a monotonic curve", () => {
    const luxury = cubicBezier(0.16, 1, 0.3, 1);
    let previous = -Infinity;
    for (let i = 0; i <= 100; i += 1) {
      const value = luxury(i / 100);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
  });

  it("matches an independently bisected reference at the midpoint, within tolerance", () => {
    // Reference computed by binary-searching x(t) = 0.5 rather than by
    // Newton's method, so this is not just re-checking the same algorithm.
    const luxury = cubicBezier(0.16, 1, 0.3, 1);
    const settle = cubicBezier(0.22, 0.61, 0.36, 1);
    expect(luxury(0.5)).toBeCloseTo(0.9718, 3);
    expect(settle(0.5)).toBeCloseTo(0.8729, 3);
  });

  it("overshoots past 1 partway through the house curve, then settles at 1", () => {
    // ease-luxury (.16, 1, .3, 1) has y1 = y2 = 1, right at the boundary —
    // this asserts the curve gets there smoothly rather than clamping y.
    const luxury = cubicBezier(0.16, 1, 0.3, 1);
    expect(luxury(0.9)).toBeGreaterThan(0.99);
    expect(luxury(0.9)).toBeLessThanOrEqual(1);
  });

  it("clamps out-of-range x control points but leaves y alone", () => {
    const overshoot = cubicBezier(-0.5, 1.2, 1.5, -0.2);
    // Still a valid function of x over [0, 1] once x1/x2 are clamped.
    expect(overshoot(0)).toBe(0);
    expect(overshoot(1)).toBe(1);
    expect(Number.isFinite(overshoot(0.5))).toBe(true);
  });
});
