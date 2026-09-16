import { describe, expect, it } from "vitest";

import {
  COMPARISON_SCOPES,
  COMPARISON_SCOPE_LABELS,
  pickReferenceVariant,
  scopeRows,
  type ScopedVariantRow,
} from "@/lib/scraper/comparison-scopes";

/**
 * The four comparison scopes, pure. Rows are literals; the league guard that
 * fetches them is covered in tests/db/league-guard.test.ts.
 */

function row(overrides: Partial<ScopedVariantRow> = {}): ScopedVariantRow {
  return {
    snapshotId: "snap-1",
    researchProductId: "prod-1",
    capturedAt: new Date("2026-09-16T10:00:00Z"),
    label: null,
    priceMinor: 100_00,
    priceBasis: "PER_PIECE",
    isReference: false,
    ...overrides,
  };
}

describe("comparison scopes vocabulary", () => {
  it("every scope has a label", () => {
    for (const scope of COMPARISON_SCOPES) {
      expect(COMPARISON_SCOPE_LABELS[scope]).toBeTruthy();
    }
  });
});

describe("pickReferenceVariant", () => {
  it("returns null when nothing is comparable — an all-quote-only snapshot has no base product", () => {
    expect(
      pickReferenceVariant([
        row({ priceMinor: null, priceBasis: "QUOTE_ONLY" }),
        row({ isReference: true }),
      ]),
    ).toBeNull();
  });

  it("a single comparable variant IS the reference", () => {
    const only = row({ label: "Small" });
    const pick = pickReferenceVariant([only]);
    expect(pick?.row).toBe(only);
    expect(pick?.rationale).toBe("only comparable variant");
  });

  it("an implicit whole-product row beats labelled variants", () => {
    const implicit = row({ label: null, priceMinor: 200_00 });
    const pick = pickReferenceVariant([
      row({ label: "Small", priceMinor: 150_00 }),
      implicit,
      row({ label: "Large", priceMinor: 250_00 }),
    ]);
    expect(pick?.row).toBe(implicit);
    expect(pick?.rationale).toContain("implicit whole-product row");
  });

  it("otherwise the lowest price wins — the entry point is the base product", () => {
    const cheapest = row({ label: "Small", priceMinor: 150_00 });
    const pick = pickReferenceVariant([
      row({ label: "Large", priceMinor: 250_00 }),
      cheapest,
      row({ label: "Medium", priceMinor: 200_00 }),
    ]);
    expect(pick?.row).toBe(cheapest);
    expect(pick?.rationale).toBe("lowest-priced of 3 variants");
  });

  it("price ties break on label, deterministically, and the tie is recorded", () => {
    const pick = pickReferenceVariant([
      row({ label: "Round", priceMinor: 150_00 }),
      row({ label: "Square", priceMinor: 150_00 }),
    ]);
    expect(pick?.row.label).toBe("Round");
    expect(pick?.rationale).toContain("tie(s) broken by label");
  });

  it("reference rows are never eligible, however cheap", () => {
    const legit = row({ label: "Only", priceMinor: 300_00 });
    const pick = pickReferenceVariant([
      row({ label: "MOQ 100", priceMinor: 10_00, isReference: true }),
      legit,
    ]);
    expect(pick?.row).toBe(legit);
  });
});

describe("scopeRows", () => {
  it("ALL_VARIANTS keeps every comparable row and drops quote-only, unpriced and reference rows", () => {
    const picks = scopeRows(
      [
        row({ label: "A" }),
        row({ label: "B" }),
        row({ label: "Q", priceMinor: null, priceBasis: "QUOTE_ONLY" }),
        row({ label: "R", isReference: true }),
        row({ label: "U", priceMinor: null }),
      ],
      "ALL_VARIANTS",
    );
    expect(picks.map((p) => p.row.label)).toEqual(["A", "B"]);
  });

  it("QUOTE_ONLY_SEPARATE keeps ONLY quote-only rows, in their own arena", () => {
    const picks = scopeRows(
      [
        row({ label: "A" }),
        row({ label: "Q", priceMinor: null, priceBasis: "QUOTE_ONLY" }),
        row({ label: "QR", priceMinor: null, priceBasis: "QUOTE_ONLY", isReference: true }),
      ],
      "QUOTE_ONLY_SEPARATE",
    );
    expect(picks.map((p) => p.row.label)).toEqual(["Q"]);
    expect(picks[0].rationale).toContain("never averaged into priced benchmarks");
  });

  it("BASE_PRODUCT picks one reference variant PER SNAPSHOT", () => {
    const picks = scopeRows(
      [
        row({ snapshotId: "s1", label: "Small", priceMinor: 100_00 }),
        row({ snapshotId: "s1", label: "Large", priceMinor: 200_00 }),
        row({ snapshotId: "s2", label: "Only", priceMinor: 500_00 }),
      ],
      "BASE_PRODUCT",
    );
    expect(picks).toHaveLength(2);
    expect(picks[0].row.label).toBe("Small");
    expect(picks[1].rationale).toBe("only comparable variant");
  });

  it("UNIQUE_DESIGN gives one vote per design, from its LATEST snapshot", () => {
    const old = new Date("2026-09-01T10:00:00Z");
    const newer = new Date("2026-09-10T10:00:00Z");
    const picks = scopeRows(
      [
        // Same design scraped twice: the stale snapshot must not vote.
        row({ snapshotId: "s-old", capturedAt: old, label: null, priceMinor: 100_00 }),
        row({ snapshotId: "s-new", capturedAt: newer, label: null, priceMinor: 120_00 }),
        // A second design, one snapshot.
        row({ snapshotId: "s-other", researchProductId: "prod-2", priceMinor: 900_00 }),
      ],
      "UNIQUE_DESIGN",
    );
    expect(picks).toHaveLength(2);
    const first = picks.find((p) => p.row.researchProductId === "prod-1");
    expect(first?.row.priceMinor).toBe(120_00);
    expect(first?.rationale).toContain("unique-design scope: latest snapshot");
  });

  it("a design whose snapshots are all quote-only casts no vote in UNIQUE_DESIGN", () => {
    const picks = scopeRows(
      [row({ priceMinor: null, priceBasis: "QUOTE_ONLY" })],
      "UNIQUE_DESIGN",
    );
    expect(picks).toHaveLength(0);
  });
});
