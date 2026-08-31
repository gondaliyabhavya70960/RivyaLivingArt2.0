import { describe, expect, it } from "vitest";

import {
  ALL_ECOSYSTEMS,
  DEFAULT_ECOSYSTEM,
  ECOSYSTEMS,
  isEcosystem,
  normalizeEcosystemParam,
} from "@/lib/shop-filters";

/**
 * The shop's ecosystem default decides what a visitor sees at `/shop`.
 *
 * Supplies and 3D printing are ~2,900 of the 4,373 published products, so the
 * difference between "art" and "no constraint" is the difference between an
 * art catalogue and a hardware catalogue. These assertions exist because that
 * is a silent failure — a regression changes what the shop sells, not whether
 * it renders.
 */
describe("ecosystem resolution", () => {
  it("defaults a bare /shop to the art ecosystem", () => {
    expect(normalizeEcosystemParam(undefined)).toBe("art");
    expect(normalizeEcosystemParam(undefined)).toBe(DEFAULT_ECOSYSTEM);
  });

  it("passes real ecosystems through untouched", () => {
    for (const eco of ECOSYSTEMS) {
      expect(normalizeEcosystemParam(eco)).toBe(eco);
    }
  });

  it("carries the all-sentinel through so the mixed view stays reachable", () => {
    expect(normalizeEcosystemParam(ALL_ECOSYSTEMS)).toBe(ALL_ECOSYSTEMS);
  });

  it("keeps the sentinel OUT of the ecosystem set, so no category clause is built", () => {
    // This is the whole mechanism: `buildProductWhere` adds its category
    // filter only when `isEcosystem` is true, so "all" must stay unrecognised.
    // If someone ever adds "all" to ECOSYSTEMS, the mixed view would try to
    // filter by a group whose slug list does not exist and return nothing.
    expect(isEcosystem(ALL_ECOSYSTEMS)).toBe(false);
    expect(ECOSYSTEMS as readonly string[]).not.toContain(ALL_ECOSYSTEMS);
  });

  it("falls back to art for unrecognised input rather than reopening the mixed catalogue", () => {
    // A stale link from the v6 catalogue, a typo, or a crafted param must not
    // be a back door to the unfiltered shop.
    for (const junk of ["v6", "ART", "", "supplies ", "print;all", "__proto__"]) {
      expect(normalizeEcosystemParam(junk)).toBe(DEFAULT_ECOSYSTEM);
    }
  });
});
