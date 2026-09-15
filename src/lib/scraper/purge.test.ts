import { describe, expect, it } from "vitest";

import {
  describePurgePlan,
  isEmptyPurge,
  TIER_LABEL,
  TIER_NUMBER,
  tierNumbersFor,
} from "@/lib/scraper/purge";

const COUNTS = {
  sources: 38,
  stagedProducts: 12_400,
  jobs: 51,
  catalogProducts: 900,
};

describe("describePurgePlan", () => {
  it("names every number, not just the sources", () => {
    // "This will remove 38 sources" hides that it also takes 12,400 staged
    // products with it, and the second number is the one worth pausing over.
    const plan = describePurgePlan("resin goods", COUNTS, {
      deleteCatalogProducts: false,
    });
    expect(plan).toContain("38 sources");
    expect(plan).toContain("12,400 staged products");
    expect(plan).toContain("51 scrape jobs");
    expect(plan).toContain("sheet");
  });

  it("says catalog products will be KEPT when they are", () => {
    const plan = describePurgePlan("resin goods", COUNTS, {
      deleteCatalogProducts: false,
    });
    expect(plan).toMatch(/900 catalog products.*KEPT/);
  });

  it("lists catalog products among the casualties when opted in", () => {
    const plan = describePurgePlan("resin goods", COUNTS, {
      deleteCatalogProducts: true,
    });
    expect(plan).toContain("900 live catalog products");
    expect(plan).not.toMatch(/KEPT/);
  });

  it("says nothing about the catalog when there is none to speak of", () => {
    const plan = describePurgePlan(
      "supplies",
      { ...COUNTS, catalogProducts: 0 },
      { deleteCatalogProducts: false },
    );
    expect(plan).not.toMatch(/catalog/i);
  });

  it("reads correctly in the singular", () => {
    const plan = describePurgePlan(
      "supplies",
      { sources: 1, stagedProducts: 1, jobs: 1, catalogProducts: 1 },
      { deleteCatalogProducts: false },
    );
    expect(plan).toContain("1 source,");
    expect(plan).toContain("1 staged product,");
    expect(plan).toContain("1 scrape job");
    // Singular all the way through.
    // (was: "imported from IT" rather than
    // vs "from them" — the phrasing moved to tiers.)
    expect(plan).toContain("1 catalog product in this tier will be KEPT");
  });
});

describe("isEmptyPurge", () => {
  it("is true when there is nothing to remove", () => {
    expect(
      isEmptyPurge({ sources: 0, stagedProducts: 0, jobs: 0, catalogProducts: 0 }),
    ).toBe(true);
  });

  it("is false when a source exists even with no products", () => {
    expect(
      isEmptyPurge({ sources: 1, stagedProducts: 0, jobs: 0, catalogProducts: 0 }),
    ).toBe(false);
  });
});

describe("TIER_LABEL", () => {
  it("names every tier — an unlabelled button is unpressable", () => {
    expect(Object.keys(TIER_LABEL).sort()).toEqual([
      "LARGE_FORMAT",
      "MEDIUM_FORMAT",
      "OWNER",
      "PRINT3D",
      "RESIN_GOODS",
      "SMALL_FORMAT",
      "SUPPLIES",
    ]);
  });
});

describe("TIER_NUMBER", () => {
  it("maps the four PROVENANCE tiers onto the catalog tier column", () => {
    // `Product.tier` is the only link back to a tier once the ScrapeSource row
    // is gone. On a real database 2,500 of 3,500 goods/supplies products had
    // no surviving source key — matching on importSource alone left every one
    // of them on the storefront while the purge reported success.
    expect(TIER_NUMBER.OWNER).toBe(1);
    expect(TIER_NUMBER.RESIN_GOODS).toBe(2);
    expect(TIER_NUMBER.SUPPLIES).toBe(3);
    expect(TIER_NUMBER.PRINT3D).toBe(4);
  });

  it("maps the SIZE tiers onto nothing, which is the dangerous half", () => {
    // These numbers are not labels, they are `Product.tier` values written by
    // the catalog-fill importer from data/tiers/*.csv.gz. A size tier never
    // came from one of those files. Numbering LARGE_FORMAT 1 to "keep the
    // sequence tidy" would make purging large-format sources delete every
    // product imported from Tier1_Owner.csv.gz.
    expect(TIER_NUMBER.LARGE_FORMAT).toBeNull();
    expect(TIER_NUMBER.MEDIUM_FORMAT).toBeNull();
    expect(TIER_NUMBER.SMALL_FORMAT).toBeNull();
  });

  it("gives no two provenance tiers the same number", () => {
    const numbers = Object.values(TIER_NUMBER).filter((n) => n !== null);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

describe("tierNumbersFor", () => {
  it("drops the size tiers and keeps the rest", () => {
    expect(tierNumbersFor(["LARGE_FORMAT", "OWNER", "SUPPLIES"])).toEqual([
      1, 3,
    ]);
  });

  it("returns nothing at all for a size-only selection", () => {
    // Meaningful, not a bug: it tells the purge to match on importSource alone
    // rather than widening to a catalog tier these sources never wrote to.
    expect(tierNumbersFor(["LARGE_FORMAT", "MEDIUM_FORMAT"])).toEqual([]);
  });

  it("collapses duplicates", () => {
    expect(tierNumbersFor(["OWNER", "OWNER"])).toEqual([1]);
  });
});
