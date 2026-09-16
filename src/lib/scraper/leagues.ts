/**
 * Analytics leagues — the vocabulary of fair comparison (B6, plan §6).
 *
 * A league says WHICH MARKET a source sells into, and the rule is absolute:
 * benchmarks are computed within one league, never across them. A coaster is
 * never benchmarked against a dining table, and a per-kilo pigment price is
 * never averaged into the price of a finished console. The guard lives here,
 * in the query fragments the analytics layer builds with — not in a UI
 * filter a user can clear.
 *
 * Pure module: no db, no fetch. The one query the guard needs — resolving a
 * league to its source keys — lives in `league-query.ts`, so this file stays
 * importable from client components and unit tests alike.
 */
import { AnalyticsLeague } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/** The league benchmarks are computed against unless told otherwise. */
export const BENCHMARK_LEAGUE = AnalyticsLeague.FINISHED_ART;

export const ANALYTICS_LEAGUE_LABELS: Record<AnalyticsLeague, string> = {
  FINISHED_ART: "Finished art",
  MATERIALS_DIY: "Materials & DIY",
  MARKETPLACE_B2B: "B2B marketplace",
};

/** One-line description shown under the league select, so the choice is never a mystery. */
export const ANALYTICS_LEAGUE_DESCRIPTIONS: Record<AnalyticsLeague, string> = {
  FINISHED_ART:
    "Finished resin art sold to end customers — Rivya's competitors. Benchmarks compare against this league.",
  MATERIALS_DIY:
    "Moulds, pigments, kits — supplies for making resin art. Kept for context, never benchmarked against finished pieces.",
  MARKETPLACE_B2B:
    "Wholesale / MOQ listings. Prices are negotiated bulk starting points, kept for context only.",
};

/**
 * Whether rows from this league may enter a benchmark. Non-benchmark leagues
 * are not deleted or hidden — they are CONTEXT, kept so the owner can still
 * look up what pigment costs; they are simply never averaged against
 * finished art.
 */
export function isBenchmarkLeague(league: AnalyticsLeague): boolean {
  return league === BENCHMARK_LEAGUE;
}

/**
 * The `referenceReason` stamped on every variant row written from a
 * non-benchmark league's source. Returns null for the benchmark league,
 * whose rows are comparators, not context. The `league:` prefix keeps this
 * reason machine-filterable alongside any future reasons.
 */
export function referenceReasonForLeague(league: AnalyticsLeague): string | null {
  return isBenchmarkLeague(league) ? null : `league:${league}`;
}

/**
 * Where-fragment restricting a `ProductSnapshot` query to one league. Pair
 * with `isReference: false` — belt and suspenders: the league filter is the
 * CURRENT classification (a source the owner re-leagues moves immediately),
 * the flag is the stamp recorded at write time, and a row that fails either
 * test has no business in a benchmark.
 */
export function snapshotWhereForLeague(
  sourceKeys: string[],
): Prisma.ProductSnapshotWhereInput {
  return {
    researchProduct: { sourceKey: { in: sourceKeys } },
    variants: { some: { isReference: false } },
  };
}

/**
 * Where-fragment restricting a `ProductVariant` query (through its snapshot)
 * to one league, reference rows excluded BY CLAUSE. This is the shape an
 * average or min/max over prices should use — a query that omits it is a
 * query that compares coasters to dining tables.
 */
export function variantWhereForLeague(
  sourceKeys: string[],
): Prisma.ProductVariantWhereInput {
  return {
    isReference: false,
    snapshot: { researchProduct: { sourceKey: { in: sourceKeys } } },
  };
}
