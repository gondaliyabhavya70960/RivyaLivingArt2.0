import { describe, expect, it } from "vitest";

import {
  diffConflictFields,
  planTierRows,
  type TierSpec,
} from "@/lib/import/tier-fill";

/** A minimal, otherwise-valid raw sheet row — override just what a test cares about. */
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

  it("drops a row missing title/externalId/sourceKey, with a tab-wide count", () => {
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

  it("excludes a gift card outside Tier 1", () => {
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

  it("keeps a gift card in Tier 1 — the owner's own store", () => {
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

  it("dedupes within the tab, keeping the first occurrence", () => {
    const plan = planTierRows(
      TIER1,
      [row({ title: "First" }), row({ title: "Second" })],
      new Set(),
    );
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].title).toBe("First");
    expect(plan.dropped[0].reason).toBe("duplicate row in this tab");
  });

  it("caps a tier's selection and reports every row beyond it", () => {
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
        reason: "beyond this tier's cap of 2",
      }),
    ]);
  });

  it("selects Tier-1 featured rows only from rows with images and real description", () => {
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

  it("never features anything outside Tier 1", () => {
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
      sheetValue: "200",
      dbValue: null,
    });
    expect(byField.materials).toEqual({
      field: "materials",
      sheetValue: "Wood",
      dbValue: null,
    });
    expect(byField.inStock).toEqual({
      field: "inStock",
      sheetValue: "false",
      dbValue: "true",
    });
  });
});
