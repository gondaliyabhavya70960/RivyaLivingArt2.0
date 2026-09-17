import { describe, expect, it } from "vitest";

import {
  diffConflictFields,
  DROPPED_SAMPLES_PER_REASON,
  emptySizeTierTally,
  planTierRows,
  summarizeDropped,
  tallySizeTiers,
  type TierSpec,
} from "@/lib/import/tier-fill";
import { PRODUCT_SIZE_TIERS } from "@/lib/product-size-tier";

/** A minimal, otherwise-valid raw list row — override just what a test cares about. */
function row(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    title: "Resin Coaster Set",
    externalid: "ext-1",
    sourcekey: "some-store",
    pricemin: "499",
    pricemax: "599",
    images: "https://example.com/a.jpg",
    description: "A lovely set of coasters, hand-poured.",
    ...overrides,
  };
}

const TIER1: TierSpec = { tab: "Tier1_Owner", tier: 1, cap: null };
const TIER2_CAPPED: TierSpec = { tab: "Tier2_ResinGoods", tier: 2, cap: 2 };

describe("planTierRows", () => {
  it("selects a well-formed row", () => {
    const plan = planTierRows(TIER2_CAPPED, [row()], new Set());
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].externalId).toBe("ext-1");
    expect(plan.dropped).toEqual([]);
    expect(plan.detectedCount).toBe(1);
  });

  it("drops a row missing title/externalId/sourceKey, with a list-wide count", () => {
    const plan = planTierRows(
      TIER1,
      [row({ title: "" }), row({ externalid: "" }), row()],
      new Set(),
    );
    expect(plan.rows).toHaveLength(1);
    expect(plan.dropped).toEqual([
      {
        tab: "Tier1_Owner",
        reason: "2 row(s) missing title, externalId or sourceKey",
      },
    ]);
  });

  it("excludes a gift card outside List 1", () => {
    const plan = planTierRows(
      TIER2_CAPPED,
      [row({ title: "$50 Gift Card" })],
      new Set(),
    );
    expect(plan.rows).toHaveLength(0);
    expect(plan.dropped).toEqual([
      expect.objectContaining({
        reason: expect.stringContaining("gift card"),
      }),
    ]);
  });

  it("keeps a gift card in List 1 — the owner's own store", () => {
    const plan = planTierRows(
      TIER1,
      [row({ title: "$50 Gift Card" })],
      new Set(),
    );
    expect(plan.rows).toHaveLength(1);
    expect(plan.dropped).toEqual([]);
  });

  it("drops a row the owner tombstoned, named by reason", () => {
    const plan = planTierRows(
      TIER1,
      [row()],
      new Set(["sheet:some-store|ext-1"]),
    );
    expect(plan.rows).toHaveLength(0);
    expect(plan.dropped[0].reason).toContain("deleted by the owner");
  });

  it("dedupes within the list, keeping the first occurrence", () => {
    const plan = planTierRows(
      TIER1,
      [row({ title: "First" }), row({ title: "Second" })],
      new Set(),
    );
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].title).toBe("First");
    expect(plan.dropped[0].reason).toBe("duplicate row in this list");
  });

  it("caps a list's selection and reports every row beyond it", () => {
    const rows = [
      row({ externalid: "a", title: "A" }),
      row({ externalid: "b", title: "B" }),
      row({ externalid: "c", title: "C" }),
    ];
    const plan = planTierRows(TIER2_CAPPED, rows, new Set());
    expect(plan.rows.map((r) => r.externalId)).toEqual(["a", "b"]);
    expect(plan.dropped).toEqual([
      expect.objectContaining({
        externalId: "c",
        reason: "beyond this list's cap of 2",
      }),
    ]);
  });

  it("never calls the list a tier in a dropped-row reason — that word is the product tier's", () => {
    // Four dropped rows, four reasons: missing fields, gift card, tombstone,
    // duplicate, over cap. The reason is what the operator reads in the
    // preview beside "Would file as", where "tier" means Collectible / Memory
    // / Personal; a reason that said "tier" for the list would put both
    // meanings in one panel.
    const plan = planTierRows(
      TIER2_CAPPED,
      [
        row({ title: "" }),
        row({ externalid: "gift", title: "$50 Gift Card" }),
        row({ externalid: "gone" }),
        row({ externalid: "a" }),
        row({ externalid: "a" }),
        row({ externalid: "b" }),
        row({ externalid: "c" }),
      ],
      new Set(["sheet:some-store|gone"]),
    );
    expect(plan.dropped.length).toBeGreaterThanOrEqual(5);
    for (const { reason } of plan.dropped) {
      expect(reason).not.toMatch(/tier/i);
    }
  });

  it("selects List-1 featured rows only from rows with images and real description", () => {
    const plan = planTierRows(
      TIER1,
      [
        row({
          externalid: "has-both",
          description:
            "A lovely, hand-poured resin coaster set — six pieces, gift-boxed, food-safe finish.",
        }),
        row({ externalid: "no-image", images: "" }),
        row({
          externalid: "short-desc",
          description: "Nice.",
        }),
      ],
      new Set(),
    );
    expect([...plan.featuredKeys]).toEqual(["some-store:has-both"]);
  });

  it("never features anything outside List 1", () => {
    const plan = planTierRows(TIER2_CAPPED, [row()], new Set());
    expect(plan.featuredKeys.size).toBe(0);
  });

  it("detectedCount is after the gift-card/tombstone screen, before dedupe/cap", () => {
    const plan = planTierRows(
      TIER2_CAPPED,
      [
        row({ externalid: "a" }),
        row({ externalid: "a" }),
        row({ externalid: "b" }),
      ],
      new Set(),
    );
    // Two distinct externalIds pass the screen (detected), one is then
    // deduped away (selected === 1 after dedupe, cap 2 never engages).
    expect(plan.detectedCount).toBe(3);
    expect(plan.rows).toHaveLength(2);
  });
});

describe("diffConflictFields", () => {
  it("returns nothing when every field matches", () => {
    const side = {
      title: "A",
      priceMin: 100,
      priceMax: 200,
      materials: "Resin",
      dimensions: "10cm",
      description: "d",
      inStock: true,
    };
    expect(diffConflictFields(side, side)).toEqual([]);
  });

  it("reports only the fields that differ", () => {
    const dbSide = {
      title: "Old title",
      priceMin: 100,
      priceMax: 200,
      materials: "Resin",
      dimensions: "10cm",
      description: "d",
      inStock: true,
    };
    const sheetSide = { ...dbSide, title: "New title", priceMin: 150 };
    const diffs = diffConflictFields(sheetSide, dbSide);
    expect(diffs.map((d) => d.field).sort()).toEqual(["priceMin", "title"]);
  });

  it("serializes values to strings, and null stays null", () => {
    const dbSide = {
      title: "A",
      priceMin: 100,
      priceMax: null,
      materials: null,
      dimensions: "10cm",
      description: "d",
      inStock: true,
    };
    const sheetSide = {
      ...dbSide,
      priceMax: 200,
      materials: "Wood",
      inStock: false,
    };
    const diffs = diffConflictFields(sheetSide, dbSide);
    const byField = Object.fromEntries(diffs.map((d) => [d.field, d]));
    expect(byField.priceMax).toEqual({
      field: "priceMax",
      importedValue: "200",
      dbValue: null,
    });
    expect(byField.materials).toEqual({
      field: "materials",
      importedValue: "Wood",
      dbValue: null,
    });
    expect(byField.inStock).toEqual({
      field: "inStock",
      importedValue: "false",
      dbValue: "true",
    });
  });
});

/**
 * How the fill's rows would file into the three product tiers — the tally
 * every list's summary carries since 2026-09-17, by the SAME rule the
 * deploy-time pass runs over the catalogue afterwards
 * (`suggestCatalogSizeTier`). The fill never writes `sizeTier`; the tally is
 * the forecast the Catalog fill screen shows beside each list.
 */
describe("the product-tier tally", () => {
  it("files a furniture row as Collectible and a coaster set as Personal", () => {
    const plan = planTierRows(
      TIER1,
      [
        row({
          externalid: "table",
          title: "River Dining Table",
          category: "Furniture",
        }),
        row({ externalid: "coasters" }), // "Resin Coaster Set" → tablespace-sets
      ],
      new Set(),
    );
    expect(plan.sizeTiers).toEqual({
      LARGE_FORMAT: 1,
      MEDIUM_FORMAT: 0,
      SMALL_FORMAT: 1,
      NONE: 0,
    });
  });

  it("files a mold and a pigment as NONE — a supply is not a piece", () => {
    const plan = planTierRows(
      TIER1,
      [
        row({
          externalid: "mold",
          vertical: "supplies",
          category: "Molds",
          title: "6 Cavity Coaster Mold",
        }),
        row({
          externalid: "pigment",
          vertical: "supplies",
          category: "Pigments",
          title: "Mica Pigment Powder Blue 50gms",
        }),
        // Mis-filed under a piece category, caught by its own title.
        row({
          externalid: "hands",
          title: "Black Clock Hand Design 1",
          category: "Wall Clocks",
        }),
      ],
      new Set(),
    );
    expect(plan.sizeTiers).toEqual({
      LARGE_FORMAT: 0,
      MEDIUM_FORMAT: 0,
      SMALL_FORMAT: 0,
      NONE: 3,
    });
  });

  it("counts the SELECTED rows only — a dropped row is not in the catalogue", () => {
    const rows = [
      row({ externalid: "a", title: "Resin Wall Clock A" }),
      row({ externalid: "b", title: "Resin Wall Clock B" }),
      row({ externalid: "c", title: "Resin Wall Clock C" }), // beyond the cap
      row({ externalid: "gift", title: "$50 Gift Card" }), // excluded
    ];
    const plan = planTierRows(TIER2_CAPPED, rows, new Set());
    expect(plan.rows).toHaveLength(2);
    const total = Object.values(plan.sizeTiers).reduce((a, b) => a + b, 0);
    expect(total).toBe(plan.rows.length);
    expect(plan.sizeTiers.MEDIUM_FORMAT).toBe(2);
    expect(tallySizeTiers(plan.rows)).toEqual(plan.sizeTiers);
  });

  it("carries every product tier and NONE, at zero when nothing filed there", () => {
    // The screen reads every key of the tally; a key that appears only when
    // its count is non-zero would render as "undefined Collectible".
    const empty = emptySizeTierTally();
    expect(Object.keys(empty).sort()).toEqual(
      [...PRODUCT_SIZE_TIERS, "NONE"].sort(),
    );
    expect(Object.values(empty)).toEqual([0, 0, 0, 0]);
    expect(planTierRows(TIER1, [], new Set()).sizeTiers).toEqual(empty);
  });
});

/**
 * Why `scripts/purge-products.ts` switches the automatic fill OFF rather than
 * trusting tombstones alone.
 *
 * The cap is applied AFTER the tombstone filter, so on a capped list deleting
 * the current selection does not empty the list — it promotes the rows that
 * were sitting just below the cap. That is the right behaviour for "I deleted
 * these items, show me the next ones", and it is precisely wrong for "remove
 * all products": measured on the real data, a purge + redeploy re-created
 * 4,000 different products, because Lists 2-4 hold 35,128 / 21,508 / 7,685
 * rows against caps of 1,000 / 2,500 / 500.
 *
 * List 1 is the opposite case and is asserted here too: no cap, so tombstoning
 * its rows really does empty it. If either of these ever flips, the purge
 * script's default is wrong and this test is how you find out.
 */
describe("tombstones against a list cap", () => {
  const four = [
    row({ externalid: "ext-1" }),
    row({ externalid: "ext-2" }),
    row({ externalid: "ext-3" }),
    row({ externalid: "ext-4" }),
  ];

  it("promotes the rows below the cap when the selection is tombstoned", () => {
    const first = planTierRows(TIER2_CAPPED, four, new Set());
    expect(first.rows.map((r) => r.externalId)).toEqual(["ext-1", "ext-2"]);

    // Delete what the first run imported — one tombstone per selected row.
    const tombstones = new Set(
      first.rows.map((r) => `sheet:${r.sourceKey}|${r.externalId}`),
    );

    const second = planTierRows(TIER2_CAPPED, four, tombstones);
    expect(second.rows).toHaveLength(2);
    expect(second.rows.map((r) => r.externalId)).toEqual(["ext-3", "ext-4"]);
  });

  it("empties an UNCAPPED list, which is why List 1 needs no switch", () => {
    const first = planTierRows(TIER1, four, new Set());
    expect(first.rows).toHaveLength(4);

    const tombstones = new Set(
      first.rows.map((r) => `sheet:${r.sourceKey}|${r.externalId}`),
    );
    const second = planTierRows(TIER1, four, tombstones);
    expect(second.rows).toEqual([]);
    expect(second.dropped).toHaveLength(4);
    expect(second.dropped[0].reason).toContain("deleted by the owner");
  });
});

describe("summarizeDropped — the examples travel, the counts stay exact", () => {
  const rows = (reason: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      tab: "Tier2_ResinGoods",
      reason,
      externalId: `${reason}-${i}`,
    }));

  it("caps the examples per reason and reports the true totals", () => {
    const dropped = [
      ...rows("beyond this list's cap of 1,000", 33_900),
      ...rows("duplicate row in this list", 12),
    ];
    const summary = summarizeDropped(dropped);
    expect(summary.total).toBe(33_912);
    expect(summary.byReason).toEqual({
      "beyond this list's cap of 1,000": 33_900,
      "duplicate row in this list": 12,
    });
    // A hundred of the first reason, all twelve of the second — the browser
    // receives a few hundred rows instead of ~34,000, and the counts beside
    // them are still the real ones.
    expect(summary.samples).toHaveLength(DROPPED_SAMPLES_PER_REASON + 12);
    expect(
      summary.samples.filter((r) => r.reason.startsWith("beyond")),
    ).toHaveLength(DROPPED_SAMPLES_PER_REASON);
    expect(summary.samples[0].externalId).toBe(
      "beyond this list's cap of 1,000-0",
    );
  });

  it("an empty run summarizes to nothing", () => {
    expect(summarizeDropped([])).toEqual({
      samples: [],
      byReason: {},
      total: 0,
    });
  });
});
