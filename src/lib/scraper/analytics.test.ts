import { describe, expect, it } from "vitest";

import {
  ANALYTICS_VERSION,
  computedFrom,
  funnelOverviewPayload,
  leaguePriceBenchmarkPayload,
  PICKS_IN_PAYLOAD_CAP,
  priceStats,
  snapshotKey,
} from "@/lib/scraper/analytics";
import {
  scopeRows,
  type ScopedPick,
  type ScopedVariantRow,
} from "@/lib/scraper/comparison-scopes";

/**
 * The B8 analytics payloads, pure. Rows and picks are literals; the query
 * that fetches real rows through the league guard is covered in
 * tests/db/analytics.test.ts. What these tests prove is the property the
 * phase exists for: every payload carries "computed from X of N", and the
 * accounting closes — included + every exclusion = considered.
 */

let seq = 0;
function row(overrides: Partial<ScopedVariantRow> = {}): ScopedVariantRow {
  seq += 1;
  return {
    snapshotId: `snap-${seq}`,
    researchProductId: `prod-${seq}`,
    capturedAt: new Date("2026-09-16T10:00:00Z"),
    label: null,
    priceMinor: 100_00,
    priceBasis: "PER_PIECE",
    isReference: false,
    ...overrides,
  };
}

function pick(r: ScopedVariantRow, rationale = "test pick"): ScopedPick {
  return { row: r, rationale };
}

describe("snapshotKey", () => {
  it("fills absent key parts with the empty-string sentinel", () => {
    expect(snapshotKey({ view: "funnel-overview" })).toEqual({
      view: "funnel-overview",
      league: "",
      scope: "",
      sourceKey: "",
    });
    expect(
      snapshotKey({
        view: "league-price-benchmark",
        league: "FINISHED_ART",
        scope: "UNIQUE_DESIGN",
      }),
    ).toEqual({
      view: "league-price-benchmark",
      league: "FINISHED_ART",
      scope: "UNIQUE_DESIGN",
      sourceKey: "",
    });
  });
});

describe("computedFrom", () => {
  it("closes the books: included + every exclusion = considered", () => {
    const kept = row();
    const rows = [
      kept,
      row({ isReference: true }),
      row({ priceBasis: "QUOTE_ONLY", priceMinor: null }),
      row({ priceMinor: null }),
      row({ label: "a non-picked variant" }),
    ];
    const accounting = computedFrom(rows, [pick(kept)]);
    expect(accounting).toEqual({
      included: 1,
      considered: 5,
      exclusions: { reference: 1, quoteOnly: 1, unpriced: 1, outOfScope: 1 },
    });
    const excluded = Object.values(accounting.exclusions).reduce(
      (a, b) => a + b,
      0,
    );
    expect(accounting.included + excluded).toBe(accounting.considered);
  });

  it("empty input accounts for nothing and invents nothing", () => {
    expect(computedFrom([], [])).toEqual({
      included: 0,
      considered: 0,
      exclusions: { reference: 0, quoteOnly: 0, unpriced: 0, outOfScope: 0 },
    });
  });

  it("a reference row is classified reference even when it is also quote-only", () => {
    // Classification order mirrors comparison-scopes' isComparable: league
    // context first, then quote-only. A B2B marketplace quote-only row is
    // league context — the reference bucket claims it.
    const reference = row({
      isReference: true,
      priceBasis: "QUOTE_ONLY",
      priceMinor: null,
    });
    const accounting = computedFrom([reference], []);
    expect(accounting.exclusions.reference).toBe(1);
    expect(accounting.exclusions.quoteOnly).toBe(0);
  });
});

describe("priceStats", () => {
  it("empty input is an all-null distribution with an honest count of 0", () => {
    expect(priceStats([])).toEqual({
      count: 0,
      minMinor: null,
      p25Minor: null,
      medianMinor: null,
      p75Minor: null,
      maxMinor: null,
      meanMinor: null,
    });
  });

  it("interpolates the median of an even count (type-7)", () => {
    const stats = priceStats([100, 200]);
    expect(stats.medianMinor).toBe(150);
    expect(stats.meanMinor).toBe(150);
  });

  it("sorts the input and computes quartiles by type-7 interpolation", () => {
    const stats = priceStats([400, 100, 300, 200]);
    expect(stats).toMatchObject({
      count: 4,
      minMinor: 100,
      p25Minor: 175,
      medianMinor: 250,
      p75Minor: 325,
      maxMinor: 400,
      meanMinor: 250,
    });
  });

  it("a single price is every statistic at once", () => {
    const stats = priceStats([42_00]);
    expect(stats).toMatchObject({
      count: 1,
      minMinor: 42_00,
      p25Minor: 42_00,
      medianMinor: 42_00,
      p75Minor: 42_00,
      maxMinor: 42_00,
      meanMinor: 42_00,
    });
  });
});

describe("leaguePriceBenchmarkPayload", () => {
  it("carries the computed-from proof, and the accounting closes", () => {
    const rows = [
      row({ researchProductId: "prod-a", priceMinor: 45000_00 }),
      row({
        researchProductId: "prod-b",
        snapshotId: "snap-b",
        label: "large",
        priceMinor: 52000_00,
      }),
      row({
        researchProductId: "prod-q",
        priceBasis: "QUOTE_ONLY",
        priceMinor: null,
      }),
    ];
    const picks = scopeRows(rows, "UNIQUE_DESIGN");
    const payload = leaguePriceBenchmarkPayload({
      league: "FINISHED_ART",
      scope: "UNIQUE_DESIGN",
      rows,
      picks,
    });
    expect(payload.computedFrom.included).toBe(2);
    expect(payload.computedFrom.considered).toBe(3);
    expect(payload.computedFrom.exclusions.quoteOnly).toBe(1);
    const excluded = Object.values(payload.computedFrom.exclusions).reduce(
      (a, b) => a + b,
      0,
    );
    expect(payload.computedFrom.included + excluded).toBe(
      payload.computedFrom.considered,
    );
    expect(payload.stats.count).toBe(2);
    expect(payload.picksTruncated).toBe(false);
  });

  it("the quote-only arena is a COUNT, never a price", () => {
    const rows = [
      row({ priceBasis: "QUOTE_ONLY", priceMinor: null }),
      row({
        snapshotId: "snap-q2",
        researchProductId: "prod-q2",
        priceBasis: "QUOTE_ONLY",
        priceMinor: null,
      }),
    ];
    const picks = scopeRows(rows, "QUOTE_ONLY_SEPARATE");
    const payload = leaguePriceBenchmarkPayload({
      league: "FINISHED_ART",
      scope: "QUOTE_ONLY_SEPARATE",
      rows,
      picks,
    });
    expect(payload.computedFrom.included).toBe(2);
    expect(payload.stats.count).toBe(0);
    expect(payload.stats.medianMinor).toBeNull();
    expect(payload.stats.meanMinor).toBeNull();
  });

  it("caps the stored working at 500 picks while counting the full set", () => {
    const rows = Array.from({ length: PICKS_IN_PAYLOAD_CAP + 25 }, (_, i) =>
      row({ priceMinor: (i + 1) * 100 }),
    );
    const picks = scopeRows(rows, "ALL_VARIANTS");
    const payload = leaguePriceBenchmarkPayload({
      league: "FINISHED_ART",
      scope: "ALL_VARIANTS",
      rows,
      picks,
    });
    expect(payload.picks).toHaveLength(PICKS_IN_PAYLOAD_CAP);
    expect(payload.picksTruncated).toBe(true);
    expect(payload.computedFrom.included).toBe(PICKS_IN_PAYLOAD_CAP + 25);
    expect(payload.computedFrom.considered).toBe(PICKS_IN_PAYLOAD_CAP + 25);
  });
});

describe("funnelOverviewPayload", () => {
  it("counts every product exactly once: included = considered, no exclusions", () => {
    const payload = funnelOverviewPayload({
      NEW: 40,
      REVIEW: 5,
      SHORTLISTED: 3,
      REJECTED: 2,
      CONFIRMED: 1,
      INSPIRATION_ONLY: 1,
      DUPLICATE: 0,
    });
    expect(payload.computedFrom).toEqual({
      included: 52,
      considered: 52,
      exclusions: { reference: 0, quoteOnly: 0, unpriced: 0, outOfScope: 0 },
    });
    expect(payload.states.SHORTLISTED).toBe(3);
  });
});

describe("ANALYTICS_VERSION", () => {
  it("is a positive integer — the stamp every stored row carries", () => {
    expect(Number.isInteger(ANALYTICS_VERSION)).toBe(true);
    expect(ANALYTICS_VERSION).toBeGreaterThan(0);
  });
});
