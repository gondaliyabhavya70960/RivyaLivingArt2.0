import { describe, expect, it } from "vitest";

import {
  describePriceMove,
  priceMoved,
} from "@/lib/scraper/price-history";

const at = (min: number | null, max: number | null = null) => ({
  priceMin: min,
  priceMax: max,
});

describe("priceMoved", () => {
  it("is false when nothing changed", () => {
    expect(priceMoved(at(799), at(799))).toBe(false);
  });

  it("is true when the floor moves", () => {
    expect(priceMoved(at(799), at(849))).toBe(true);
  });

  it("is true when only the ceiling moves", () => {
    expect(priceMoved(at(799, 1200), at(799, 1400))).toBe(true);
  });

  it("treats losing a price as a move", () => {
    // A product that stopped advertising a price has changed in a way worth
    // recording — it is not missing data.
    expect(priceMoved(at(799), at(null))).toBe(true);
  });

  it("treats gaining a price as a move", () => {
    expect(priceMoved(at(null), at(799))).toBe(true);
  });

  it("is false when both readings have no price", () => {
    expect(priceMoved(at(null), at(null))).toBe(false);
  });
});

describe("describePriceMove", () => {
  it("says nothing when the price held", () => {
    expect(describePriceMove(at(799), at(799))).toBeNull();
  });

  it("reads as an arrow", () => {
    expect(describePriceMove(at(799), at(849))).toBe("₹799 → ₹849");
  });

  it("shows a band when there is one", () => {
    expect(describePriceMove(at(799, 1200), at(899, 1400))).toBe(
      "₹799–₹1200 → ₹899–₹1400",
    );
  });

  it("collapses a band whose ends are equal", () => {
    expect(describePriceMove(at(799, 799), at(849, 849))).toBe("₹799 → ₹849");
  });

  it("names the absence of a price rather than printing null", () => {
    expect(describePriceMove(at(799), at(null))).toBe("₹799 → no price");
    expect(describePriceMove(at(null), at(849))).toBe("no price → ₹849");
  });
});
