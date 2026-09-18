import { describe, expect, it } from "vitest";

import {
  IMPORT_LISTS,
  IMPORT_LIST_NAME,
  IMPORT_LIST_SHORT,
  importListLabel,
} from "@/lib/import-list";
import {
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_NAME,
  SIZE_TIER_NUMBER,
  sizeTierStudioLabel,
} from "@/lib/product-size-tier";
import {
  OFFERED_SCRAPE_TIERS,
  RETIRED_SCRAPE_TIERS,
  SCRAPE_TIERS,
  SCRAPE_TIER_SHORT,
  TIER_LABEL,
  TIER_NUMBER,
  describePurgePlan,
  isEmptyPurge,
  isRetiredScrapeTier,
  scrapeTierChips,
  scrapeTierOptions,
  scrapeTierStudioLabel,
  sizeTierNamedBy,
  tierNumbersFor,
} from "@/lib/scraper/purge";

const COUNTS = {
  sources: 38,
  stagedProducts: 12_400,
  jobs: 51,
  catalogProducts: 900,
};

/** The four retired provenance values — every source tier that is not a size. */
const RETIRED = SCRAPE_TIERS.filter((tier) => sizeTierNamedBy(tier) === null);

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
    // Google Sheets is gone (workstream C); the sentence no longer promises
    // rows in a spreadsheet the purge cannot reach.
    expect(plan).not.toMatch(/sheet/i);
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
    expect(plan).toContain(
      "1 catalog product from this source tier will be KEPT",
    );
  });

  it('calls the thing being purged a "source tier", never a bare "tier"', () => {
    // "In this tier" was true when there was one tier system. Now "tier" on
    // its own is the product tier, and a catalog product is never "in" a
    // supplier list — it came FROM one.
    const plan = describePurgePlan("resin goods", COUNTS, {
      deleteCatalogProducts: false,
    });
    expect(plan).not.toMatch(/\bin this tier\b/);
    expect(plan).toContain("from this source tier");
  });
});

describe("isEmptyPurge", () => {
  it("is true when there is nothing to remove", () => {
    expect(
      isEmptyPurge({
        sources: 0,
        stagedProducts: 0,
        jobs: 0,
        catalogProducts: 0,
      }),
    ).toBe(true);
  });

  it("is false when a source exists even with no products", () => {
    expect(
      isEmptyPurge({
        sources: 1,
        stagedProducts: 0,
        jobs: 0,
        catalogProducts: 0,
      }),
    ).toBe(false);
  });
});

describe("TIER_LABEL — the noun a purge sentence takes", () => {
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
    expect(Object.keys(SCRAPE_TIER_SHORT).sort()).toEqual(
      Object.keys(TIER_LABEL).sort(),
    );
  });

  it("reads the size values as SIZES — a supplier list, not a piece", () => {
    // "Remove all large-format sources" is a sentence about a list of
    // sellers. "Remove all collectible sources" would claim the sources sell
    // only collectibles, which a large-format supplier with a coaster range
    // does not.
    expect(TIER_LABEL.LARGE_FORMAT).toBe("Large-format");
    expect(TIER_LABEL.MEDIUM_FORMAT).toBe("Medium-format");
    expect(TIER_LABEL.SMALL_FORMAT).toBe("Small-format");
  });

  it("keeps the retired four as the plain nouns the buttons already say", () => {
    // The sources screen renders "Remove all resin goods sources" and
    // friends from these; the retired values were named after the import
    // lists and keep those words.
    expect(TIER_LABEL.OWNER).toBe("Owner");
    expect(TIER_LABEL.RESIN_GOODS).toBe("Resin goods");
    expect(TIER_LABEL.SUPPLIES).toBe("Supplies");
    expect(TIER_LABEL.PRINT3D).toBe("3D print");
  });

  it("carries no numbered prefix and never the word tier — that word is the product tier's", () => {
    for (const tier of SCRAPE_TIERS) {
      expect(TIER_LABEL[tier]).not.toMatch(/tier/i);
      // ("3D print" has a digit in it; the shape being refused is a
      // numbered prefix, "Tier 4 —" or "List 4 —", not any digit.)
      expect(TIER_LABEL[tier]).not.toMatch(/^(Tier|List) \d/);
      expect(SCRAPE_TIER_SHORT[tier]).not.toMatch(/tier/i);
      // A short form fits a cell: two words at most.
      expect(SCRAPE_TIER_SHORT[tier].split(" ").length).toBeLessThanOrEqual(2);
    }
  });
});

describe("scrapeTierStudioLabel — the label a tab, a badge or an option shows", () => {
  it("derives a size value's number and name from the product tier, never types them", () => {
    // The five hand-typed copies this replaced all said "Tier 1 — Large".
    // The number and the name now come from product-size-tier.ts, so the
    // source registry and the product form can never disagree about what
    // "Tier 1" is called.
    for (const tier of PRODUCT_SIZE_TIERS) {
      expect(scrapeTierStudioLabel(tier)).toBe(
        `Tier ${SIZE_TIER_NUMBER[tier]} — ${SIZE_TIER_NAME[tier]}`,
      );
      expect(scrapeTierStudioLabel(tier)).toBe(sizeTierStudioLabel(tier));
    }
    expect(scrapeTierStudioLabel("LARGE_FORMAT")).toBe(
      "Tier 1 — Collectible Furniture & Spatial Art",
    );
  });

  it('with the "sources" qualifier, cannot be mistaken for the product-tier option beside it', () => {
    // The review inbox puts the source-tier filter next to the suggested
    // product-tier filter. Without the qualifier the two lists of options
    // would be word-for-word identical.
    for (const tier of PRODUCT_SIZE_TIERS) {
      const qualified = scrapeTierStudioLabel(tier, "sources");
      expect(qualified).toBe(
        `Tier ${SIZE_TIER_NUMBER[tier]} sources — ${SIZE_TIER_NAME[tier]}`,
      );
      expect(qualified).not.toBe(sizeTierStudioLabel(tier));
    }
    expect(scrapeTierStudioLabel("RESIN_GOODS", "sources")).toBe(
      "Resin goods sources",
    );
  });

  it("reads a retired provenance value as its noun, with no numbered prefix and no tier", () => {
    // "Tier 4 — 3D print" would put a fourth tier beside a three-tier
    // product architecture, and a numbered "Owner" is the label this replaced.
    expect(RETIRED).toEqual(["OWNER", "RESIN_GOODS", "SUPPLIES", "PRINT3D"]);
    expect(scrapeTierStudioLabel("OWNER")).toBe("Owner's store");
    expect(scrapeTierStudioLabel("RESIN_GOODS")).toBe("Resin goods");
    expect(scrapeTierStudioLabel("SUPPLIES")).toBe("Supplies");
    expect(scrapeTierStudioLabel("PRINT3D")).toBe("3D print");
    for (const tier of RETIRED) {
      expect(scrapeTierStudioLabel(tier)).not.toMatch(/tier/i);
      expect(scrapeTierStudioLabel(tier)).not.toMatch(/^(Tier|List) \d/);
      expect(scrapeTierStudioLabel(tier, "sources")).not.toMatch(/tier/i);
    }
  });

  it("labels every source tier, and no two the same", () => {
    const plain = SCRAPE_TIERS.map((tier) => scrapeTierStudioLabel(tier));
    const qualified = SCRAPE_TIERS.map((tier) =>
      scrapeTierStudioLabel(tier, "sources"),
    );
    expect(new Set(plain).size).toBe(SCRAPE_TIERS.length);
    expect(new Set(qualified).size).toBe(SCRAPE_TIERS.length);
    for (const label of [...plain, ...qualified]) expect(label).toBeTruthy();
  });

  it("never reads the same as an import-list label", () => {
    // The trap this change removes: Product.tier's four lists and
    // ScrapeSource.tier's three size values both printed as "Tier 1 …" on
    // adjacent screens. A size source tier must share no label with any
    // import list, in any of the three vocabularies, and the old catalog-fill
    // label — "Tier 1" followed by "Owner" — must not come back from here.
    const importListLabels = new Set(
      IMPORT_LISTS.flatMap((list) => [
        importListLabel(list),
        IMPORT_LIST_NAME[list],
        IMPORT_LIST_SHORT[list],
      ]),
    );
    for (const tier of PRODUCT_SIZE_TIERS) {
      for (const label of [
        TIER_LABEL[tier],
        SCRAPE_TIER_SHORT[tier],
        scrapeTierStudioLabel(tier),
        scrapeTierStudioLabel(tier, "sources"),
      ]) {
        expect(importListLabels.has(label)).toBe(false);
        expect(label).not.toMatch(/^Tier \d — (Owner|Large|Medium|Small)\b/);
      }
    }
    for (const tier of SCRAPE_TIERS) {
      expect(scrapeTierStudioLabel(tier)).not.toMatch(/^Tier \d — Owner/);
      expect(scrapeTierStudioLabel(tier, "sources")).not.toMatch(/^Tier \d \w+ — Owner/);
    }
  });
});

describe("sizeTierNamedBy", () => {
  it("returns the product tier a size value is named after, and null for the rest", () => {
    for (const tier of PRODUCT_SIZE_TIERS)
      expect(sizeTierNamedBy(tier)).toBe(tier);
    for (const tier of RETIRED) expect(sizeTierNamedBy(tier)).toBeNull();
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

  it("is unmoved by the relabel: the label says Tier 1, the number stays null", () => {
    // scrapeTierStudioLabel("LARGE_FORMAT") now reads "Tier 1 — …", which is
    // exactly the kind of tidy sequence that tempts someone to write 1 here.
    // The label is the product tier's number; this map is the import list's.
    for (const tier of PRODUCT_SIZE_TIERS) {
      expect(scrapeTierStudioLabel(tier)).toMatch(/^Tier \d/);
      expect(TIER_NUMBER[tier]).toBeNull();
    }
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

describe("the offered / retired split", () => {
  it("partitions SCRAPE_TIERS exactly — no value in both, none in neither", () => {
    // The failure this catches: a new enum value added to `SCRAPE_TIERS` and
    // to neither list. It would validate, it would save, and it would appear
    // in no picker on any screen — unofferable, which is the same silent hole
    // the `SCRAPE_TIERS` tuple itself was introduced to close.
    const offered = new Set<string>(OFFERED_SCRAPE_TIERS);
    const retired = new Set<string>(RETIRED_SCRAPE_TIERS);
    expect(offered.size + retired.size).toBe(SCRAPE_TIERS.length);
    for (const tier of SCRAPE_TIERS) {
      expect(offered.has(tier) !== retired.has(tier)).toBe(true);
    }
  });

  it("keeps OWNER offered, though it is not a size tier either", () => {
    // `RETIRED` above is "every tier that names no size", which includes
    // OWNER. `RETIRED_SCRAPE_TIERS` is a different set and deliberately does
    // not: the owner's own store is still somewhere a source gets filed. Two
    // similar names, two meanings — pinned so neither drifts onto the other.
    expect(RETIRED).toContain("OWNER");
    expect(isRetiredScrapeTier("OWNER")).toBe(false);
    expect(OFFERED_SCRAPE_TIERS).toContain("OWNER");
  });

  it("never drops a retired value from SCRAPE_TIERS itself", () => {
    // The zod schemas in the actions are built from this tuple. Narrowing it
    // would make an existing RESIN_GOODS row unsaveable and unpurgeable — the
    // Studio refusing a value its own database holds.
    for (const tier of RETIRED_SCRAPE_TIERS) {
      expect(SCRAPE_TIERS).toContain(tier);
    }
  });

  it("offers four options for a new source and never a retired one", () => {
    expect(scrapeTierOptions()).toEqual([
      "LARGE_FORMAT",
      "MEDIUM_FORMAT",
      "SMALL_FORMAT",
      "OWNER",
    ]);
  });

  it("adds the row's own retired value when editing, so a Select has its value", () => {
    // Without this the edit form renders a placeholder and the first save
    // silently retypes the source to whatever the operator picks.
    expect(scrapeTierOptions("SUPPLIES")).toContain("SUPPLIES");
    expect(scrapeTierOptions("SUPPLIES")).not.toContain("PRINT3D");
    // Order stays SCRAPE_TIERS order, not "current first".
    expect(scrapeTierOptions("SUPPLIES").at(-1)).toBe("SUPPLIES");
  });

  it("shows a retired tab only while it still holds rows", () => {
    const empty = scrapeTierChips({ LARGE_FORMAT: 5, RESIN_GOODS: 0 });
    expect(empty).not.toContain("RESIN_GOODS");
    expect(empty).toEqual(OFFERED_SCRAPE_TIERS);

    const held = scrapeTierChips({ RESIN_GOODS: 3 });
    expect(held).toContain("RESIN_GOODS");
    // Hiding the tab would hide the three sources behind it rather than
    // retire them — which is why the rule is a count and not a list.
    expect(held).not.toContain("SUPPLIES");
  });
});
