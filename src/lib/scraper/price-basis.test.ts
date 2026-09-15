import { describe, expect, it } from "vitest";

import {
  derivePriceBasis,
  priceForBasis,
  toMinorUnits,
  PRICE_BASES,
} from "@/lib/scraper/price-basis";

describe("derivePriceBasis", () => {
  it("defaults to PER_PIECE for an ordinary priced listing", () => {
    expect(
      derivePriceBasis({
        priceMinor: 149900,
        text: "Resin Coaster Set — set of four, hand-poured.",
      }),
    ).toBe("PER_PIECE");
  });

  it("is QUOTE_ONLY when no price could be parsed", () => {
    expect(derivePriceBasis({ priceMinor: null, text: "Bespoke dining table" }))
      .toBe("QUOTE_ONLY");
  });

  it("an explicit quote phrase beats a parsed number", () => {
    // A studio that writes this beside a ₹1 placeholder means the phrase.
    expect(
      derivePriceBasis({ priceMinor: 100, text: "Price on request." }),
    ).toBe("QUOTE_ONLY");
    expect(
      derivePriceBasis({ priceMinor: 500000, text: "Contact us for a quote" }),
    ).toBe("QUOTE_ONLY");
  });

  it("reads area rates, and prefers them over a floor in the same sentence", () => {
    expect(
      derivePriceBasis({ priceMinor: 50000, text: "₹500 per sq ft" }),
    ).toBe("PER_AREA");
    // Both signals present: the rate is the more specific fact.
    expect(
      derivePriceBasis({
        priceMinor: 50000,
        text: "Starting from ₹500 per square foot",
      }),
    ).toBe("PER_AREA");
  });

  it("reads a floor as STARTING_FROM", () => {
    for (const text of [
      "Starting from ₹2,400",
      "Price starts at 2400",
      "₹2,400 onwards",
    ]) {
      expect(derivePriceBasis({ priceMinor: 240000, text })).toBe(
        "STARTING_FROM",
      );
    }
  });

  it("does not guess from an absent or unrelated description", () => {
    expect(derivePriceBasis({ priceMinor: 149900 })).toBe("PER_PIECE");
    expect(
      derivePriceBasis({
        priceMinor: 149900,
        // "square" here is a shape, not a rate — the pattern requires "per".
        text: "A square resin tray with a live edge.",
      }),
    ).toBe("PER_PIECE");
  });
});

describe("priceForBasis — quote-only is not free", () => {
  it("NULLS the price for QUOTE_ONLY, never zeroes it", () => {
    expect(priceForBasis("QUOTE_ONLY", 100)).toBeNull();
    expect(priceForBasis("QUOTE_ONLY", null)).toBeNull();
    // The distinction that matters: 0 is a price a supplier can publish.
    expect(priceForBasis("PER_PIECE", 0)).toBe(0);
  });

  it("passes every other basis through untouched", () => {
    for (const basis of PRICE_BASES.filter((b) => b !== "QUOTE_ONLY")) {
      expect(priceForBasis(basis, 149900)).toBe(149900);
    }
  });
});

describe("toMinorUnits", () => {
  it("converts rupees to paise and survives the float", () => {
    expect(toMinorUnits(1499)).toBe(149900);
    expect(toMinorUnits(1499.99)).toBe(149999);
    // 0.1 + 0.2 territory — the rounding is what keeps this an integer.
    expect(toMinorUnits(19.99)).toBe(1999);
  });

  it("keeps absent prices absent", () => {
    expect(toMinorUnits(null)).toBeNull();
    expect(toMinorUnits(undefined)).toBeNull();
    expect(toMinorUnits(Number.NaN)).toBeNull();
  });
});
