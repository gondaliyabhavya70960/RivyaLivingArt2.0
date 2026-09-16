import { describe, expect, it } from "vitest";

import type { ScopedVariantRow } from "@/lib/scraper/comparison-scopes";
import {
  matchesBasis,
  matchesQuery,
  shapeExplorerRow,
  splitMaterialList,
  type ExplorerRowInput,
} from "@/lib/scraper/explorer";

/**
 * The explorer's pure half (A9): the raw-vs-normalized pairing, the
 * quote-only honesty rule, and the two in-memory filters. The db assembly
 * that feeds it is covered by tests/db via the league guard suite's
 * fixtures.
 */

function row(overrides: Partial<ScopedVariantRow> = {}): ScopedVariantRow {
  return {
    snapshotId: "snap-1",
    researchProductId: "prod-1",
    capturedAt: new Date("2026-09-16T10:00:00Z"),
    label: null,
    priceMinor: 45000_00,
    priceBasis: "PER_PIECE",
    isReference: false,
    ...overrides,
  };
}

function input(overrides: Partial<ExplorerRowInput> = {}): ExplorerRowInput {
  return {
    researchProductId: "prod-1",
    sourceKey: "source-a",
    sourceName: "Source A",
    league: "FINISHED_ART",
    state: "NEW",
    canonicalUrl: "https://example.test/p/1",
    lastSeen: new Date("2026-09-16T10:00:00Z"),
    twin: {
      title: "Blue River Console",
      url: "https://example.test/p/1",
      priceMin: 45000,
      priceMax: null,
      materials: "epoxy resin, acacia wood",
      dimensions: "120 x 40 x 75 cm",
    },
    rows: [row()],
    resolveMaterials: (raw) => splitMaterialList(raw),
    ...overrides,
  };
}

describe("splitMaterialList", () => {
  it("splits on commas, slashes, pluses, semicolons and 'and', trimmed", () => {
    expect(
      splitMaterialList("epoxy resin, acacia wood / brass + pigment; sand and varnish"),
    ).toEqual(["epoxy resin", "acacia wood", "brass", "pigment", "sand", "varnish"]);
  });

  it("null and blank are empty lists, not [\"\"]", () => {
    expect(splitMaterialList(null)).toEqual([]);
    expect(splitMaterialList("  ")).toEqual([]);
  });
});

describe("shapeExplorerRow", () => {
  it("carries the twin's own fields as the RAW column, verbatim", () => {
    const shaped = shapeExplorerRow(input());
    expect(shaped.rawPriceMin).toBe(45000);
    expect(shaped.rawMaterials).toBe("epoxy resin, acacia wood");
    expect(shaped.rawDimensions).toBe("120 x 40 x 75 cm");
    expect(shaped.title).toBe("Blue River Console");
  });

  it("the normalized price is the reference-variant pick, with its rationale", () => {
    const shaped = shapeExplorerRow(
      input({
        rows: [
          row({ priceMinor: 45000_00, label: "Small" }),
          row({ priceMinor: 60000_00, label: "Large" }),
        ],
      }),
    );
    expect(shaped.referencePriceMinor).toBe(45000_00);
    expect(shaped.priceBasis).toBe("PER_PIECE");
    expect(shaped.referenceRationale).toContain("lowest-priced");
    expect(shaped.variantCount).toBe(2);
  });

  it("a quote-only listing shows no normalized price and QUOTE_ONLY — never a zero", () => {
    const shaped = shapeExplorerRow(
      input({
        twin: {
          title: "Bespoke Commission",
          url: "https://example.test/p/2",
          priceMin: null,
          priceMax: null,
          materials: null,
          dimensions: null,
        },
        rows: [row({ priceBasis: "QUOTE_ONLY", priceMinor: null })],
      }),
    );
    expect(shaped.referencePriceMinor).toBeNull();
    expect(shaped.priceBasis).toBe("QUOTE_ONLY");
    expect(shaped.rawPriceMin).toBeNull();
  });

  it("reference rows never represent the product in the normalized column", () => {
    const shaped = shapeExplorerRow(
      input({
        rows: [row({ isReference: true, priceMinor: 500_00 })],
      }),
    );
    expect(shaped.referencePriceMinor).toBeNull();
    expect(shaped.priceBasis).toBeNull();
  });

  it("falls back to the canonical URL when the staged twin is gone", () => {
    const shaped = shapeExplorerRow(input({ twin: null }));
    expect(shaped.title).toBe("https://example.test/p/1");
    expect(shaped.rawMaterials).toBeNull();
    expect(shaped.canonicalMaterials).toEqual([]);
  });

  it("materials normalize through the injected alias resolution", () => {
    const shaped = shapeExplorerRow(
      input({
        resolveMaterials: (raw) =>
          splitMaterialList(raw).map((m) =>
            m === "acacia wood" ? "Sheesham" : m,
          ),
      }),
    );
    expect(shaped.canonicalMaterials).toEqual(["epoxy resin", "Sheesham"]);
  });
});

describe("matchesBasis", () => {
  it("ALL passes everything; a basis matches itself; NONE matches the price-less", () => {
    const priced = { priceBasis: "PER_PIECE" as const };
    const quoted = { priceBasis: "QUOTE_ONLY" as const };
    const nothing = { priceBasis: null };
    expect(matchesBasis(priced, "ALL")).toBe(true);
    expect(matchesBasis(priced, "PER_PIECE")).toBe(true);
    expect(matchesBasis(priced, "QUOTE_ONLY")).toBe(false);
    expect(matchesBasis(quoted, "QUOTE_ONLY")).toBe(true);
    expect(matchesBasis(nothing, "NONE")).toBe(true);
    expect(matchesBasis(quoted, "NONE")).toBe(false);
  });
});

describe("matchesQuery", () => {
  it("is a case-insensitive substring on the title; blank passes everything", () => {
    const row = { title: "Blue River Console" };
    expect(matchesQuery(row, "river")).toBe(true);
    expect(matchesQuery(row, "CONSOLE")).toBe(true);
    expect(matchesQuery(row, "pigment")).toBe(false);
    expect(matchesQuery(row, "  ")).toBe(true);
  });
});
