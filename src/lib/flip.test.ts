import { describe, expect, it } from "vitest";

import { flipDelta, flipTransform } from "@/lib/flip";

describe("flipDelta", () => {
  it("is the identity delta when the two rects are the same", () => {
    const rect = { left: 100, top: 100, width: 200, height: 250 };
    expect(flipDelta(rect, rect)).toEqual({ x: 0, y: 0, sx: 1, sy: 1 });
  });

  it("computes scale from the width/height ratio", () => {
    const from = { left: 0, top: 0, width: 80, height: 80 };
    const to = { left: 0, top: 0, width: 800, height: 400 };
    const delta = flipDelta(from, to);
    expect(delta.sx).toBeCloseTo(0.1);
    expect(delta.sy).toBeCloseTo(0.2);
  });

  it("computes centre-to-centre translation", () => {
    // from centred at (50, 50); to centred at (450, 250) — delta is from - to.
    const from = { left: 0, top: 0, width: 100, height: 100 };
    const to = { left: 400, top: 200, width: 100, height: 100 };
    const delta = flipDelta(from, to);
    expect(delta.x).toBeCloseTo(-400);
    expect(delta.y).toBeCloseTo(-200);
  });

  it("never divides by zero for a degenerate target rect", () => {
    const from = { left: 0, top: 0, width: 50, height: 50 };
    const to = { left: 0, top: 0, width: 0, height: 0 };
    const delta = flipDelta(from, to);
    expect(delta.sx).toBe(1);
    expect(delta.sy).toBe(1);
    expect(Number.isFinite(delta.x)).toBe(true);
    expect(Number.isFinite(delta.y)).toBe(true);
  });
});

describe("flipTransform", () => {
  it("renders a translate + scale CSS transform string", () => {
    expect(flipTransform({ x: 10, y: -20, sx: 0.5, sy: 2 })).toBe(
      "translate(10px, -20px) scale(0.5, 2)",
    );
  });
});
