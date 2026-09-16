import { describe, expect, it } from "vitest";

import { AnalyticsLeague } from "@/generated/prisma/enums";
import {
  ANALYTICS_LEAGUE_DESCRIPTIONS,
  ANALYTICS_LEAGUE_LABELS,
  BENCHMARK_LEAGUE,
  isBenchmarkLeague,
  referenceReasonForLeague,
  snapshotWhereForLeague,
  variantWhereForLeague,
} from "@/lib/scraper/leagues";

/**
 * The league vocabulary, pure. The db half (`sourceKeysForLeague`) is covered
 * by tests/db/league-guard.test.ts, which has a database.
 */
describe("analytics leagues", () => {
  it("labels and describes EVERY enum value — a league with no words is a mystery in the UI", () => {
    for (const league of Object.values(AnalyticsLeague)) {
      expect(ANALYTICS_LEAGUE_LABELS[league]).toBeTruthy();
      expect(ANALYTICS_LEAGUE_DESCRIPTIONS[league]).toBeTruthy();
    }
  });

  it("FINISHED_ART is the benchmark league, and the only one", () => {
    expect(BENCHMARK_LEAGUE).toBe("FINISHED_ART");
    expect(isBenchmarkLeague("FINISHED_ART")).toBe(true);
    expect(isBenchmarkLeague("MATERIALS_DIY")).toBe(false);
    expect(isBenchmarkLeague("MARKETPLACE_B2B")).toBe(false);
  });

  it("non-benchmark leagues produce a machine-filterable reference reason; the benchmark league does not", () => {
    expect(referenceReasonForLeague("MATERIALS_DIY")).toBe(
      "league:MATERIALS_DIY",
    );
    expect(referenceReasonForLeague("MARKETPLACE_B2B")).toBe(
      "league:MARKETPLACE_B2B",
    );
    expect(referenceReasonForLeague("FINISHED_ART")).toBeNull();
  });

  it("the snapshot guard restricts by source key AND demands a comparable variant", () => {
    expect(snapshotWhereForLeague(["a", "b"])).toEqual({
      researchProduct: { sourceKey: { in: ["a", "b"] } },
      variants: { some: { isReference: false } },
    });
  });

  it("the variant guard excludes reference rows BY CLAUSE — a coaster never benchmarks against a dining table", () => {
    expect(variantWhereForLeague(["a"])).toEqual({
      isReference: false,
      snapshot: { researchProduct: { sourceKey: { in: ["a"] } } },
    });
  });
});
