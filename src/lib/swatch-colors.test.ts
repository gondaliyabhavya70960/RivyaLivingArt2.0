import { describe, expect, it } from "vitest";

import { SWATCH_COLORS, swatchColor } from "@/lib/swatch-colors";

/**
 * Snapshots the key set (A3's pure move out of `order-panel.tsx`) so a future
 * edit to this table is a deliberate, reviewed diff rather than a silent
 * regression against every existing product's colour options.
 */
describe("SWATCH_COLORS", () => {
  it("keeps its known key set", () => {
    expect(Object.keys(SWATCH_COLORS).sort()).toMatchSnapshot();
  });

  it("every value is a 6-digit hex colour", () => {
    for (const [name, hex] of Object.entries(SWATCH_COLORS)) {
      expect(hex, `${name} should be a hex colour`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("swatchColor", () => {
  it("resolves an exact, case-insensitive name", () => {
    expect(swatchColor("Ivory")).toBe(SWATCH_COLORS.ivory);
    expect(swatchColor("BLACK")).toBe(SWATCH_COLORS.black);
  });

  it("resolves the last word of a compound option string", () => {
    expect(swatchColor("Antique Gold")).toBe(SWATCH_COLORS.gold);
    expect(swatchColor("Ocean Blue")).toBe(SWATCH_COLORS.blue);
  });

  it("falls back to sapphire for an unknown name", () => {
    expect(swatchColor("Holographic Shimmer")).toBe("#0f52ba");
  });
});
