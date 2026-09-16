/**
 * Analytics payloads (B8, plan §4 phase 8) — the computation, kept pure so
 * every number is unit-testable against literals.
 *
 * What this module is FOR is stated in the plan as the thing B8 must prove:
 * **every payload carries `computed from X of N`.** A benchmark that does
 * not say how many rows it stands on — and what was excluded and why — is
 * a number asking to be trusted, which is the exact failure rule 7 exists
 * to prevent. So `computedFrom` is not a field some views populate; it is
 * built by one function every view goes through, and `AnalyticsSnapshot`'s
 * own columns duplicate its headline pair so the table is auditable as SQL.
 *
 * The league guard is NOT here. Which rows a league may contribute is
 * decided at the query (`variantWhereForLeague`, B6); this module receives
 * one league's rows and decides what the numbers are. A payload whose
 * league key part meant "all leagues" cannot be produced here — the key
 * vocabulary below has no spelling for it.
 *
 * Pure module: no db, no fetch.
 */
import type { AnalyticsLeague } from "@/generated/prisma/enums";
import type { ShortlistState } from "@/generated/prisma/enums";
import type {
  ComparisonScope,
  ScopedPick,
  ScopedVariantRow,
} from "@/lib/scraper/comparison-scopes";

/**
 * Bump when any computation in this module or opportunity.ts changes. The
 * stamp rides on every `AnalyticsSnapshot` and `OpportunityScore` row, so a
 * formula change makes stale rows recognizable instead of silently wrong.
 */
export const ANALYTICS_VERSION = 1;

/** What was computed — the `view` key part of every AnalyticsSnapshot. */
export const ANALYTICS_VIEWS = [
  "league-price-benchmark",
  "funnel-overview",
] as const;
export type AnalyticsView = (typeof ANALYTICS_VIEWS)[number];

export const ANALYTICS_VIEW_LABELS: Record<AnalyticsView, string> = {
  "league-price-benchmark": "Price benchmark",
  "funnel-overview": "Funnel overview",
};

export const ANALYTICS_VIEW_DESCRIPTIONS: Record<AnalyticsView, string> = {
  "league-price-benchmark":
    "Price distribution for one league under one comparison scope, with the rows it stands on counted and every exclusion named.",
  "funnel-overview":
    "Where the researched corpus stands in the shortlist funnel — a count per state, nothing averaged.",
};

/** The key of a stored snapshot. "" in a part means "not applicable to this
 *  view", never "all" — see the schema comment on AnalyticsSnapshot. */
export type SnapshotKey = {
  view: AnalyticsView;
  league: AnalyticsLeague | "";
  scope: ComparisonScope | "";
  sourceKey: string;
};

export function snapshotKey(
  key: Partial<SnapshotKey> & { view: AnalyticsView },
): SnapshotKey {
  return {
    view: key.view,
    league: key.league ?? "",
    scope: key.scope ?? "",
    sourceKey: key.sourceKey ?? "",
  };
}

// ————————————————————— computed from X of N —————————————————————

/**
 * Why a row the computation looked at is NOT in the number. `outOfScope`
 * covers rows the scope's one-vote rules dropped (a non-picked variant of a
 * snapshot, an older snapshot of a design) — comparable rows, just not
 * voters under this scope.
 */
export type ExclusionReason = "reference" | "quoteOnly" | "unpriced" | "outOfScope";

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  reference: "reference rows (other leagues / marketplace context)",
  quoteOnly: "quote-only rows (no price by design — never averaged in)",
  unpriced: "rows with no parseable price",
  outOfScope: "rows this scope gives no vote (non-picked variants, older snapshots)",
};

/**
 * The proof every payload carries: `included` rows produced the number out
 * of `considered` rows looked at, with the difference accounted for by
 * reason. Invariant: included + Σ exclusions = considered.
 */
export type ComputedFrom = {
  included: number;
  considered: number;
  exclusions: Record<ExclusionReason, number>;
};

/**
 * Account for every fetched row. The scope's picks are matched by object
 * identity — `scopeRows` never clones a row — so a pick and its source row
 * are the same object, and every non-picked row falls into exactly one
 * exclusion bucket. The classification order mirrors comparison-scopes.ts's
 * `isComparable`: reference first (league context), then quote-only (a NULL
 * price by design), then unpriced.
 */
export function computedFrom(
  rows: ScopedVariantRow[],
  picks: ScopedPick[],
): ComputedFrom {
  const picked = new Set(picks.map((p) => p.row));
  const exclusions: Record<ExclusionReason, number> = {
    reference: 0,
    quoteOnly: 0,
    unpriced: 0,
    outOfScope: 0,
  };
  for (const row of rows) {
    if (picked.has(row)) continue;
    if (row.isReference) exclusions.reference += 1;
    else if (row.priceBasis === "QUOTE_ONLY") exclusions.quoteOnly += 1;
    else if (row.priceMinor === null) exclusions.unpriced += 1;
    else exclusions.outOfScope += 1;
  }
  return {
    included: picks.length,
    considered: rows.length,
    exclusions,
  };
}

// ————————————————————— price statistics —————————————————————

/**
 * A price distribution in MINOR units (paise), or every field null when
 * there is nothing to summarize. `count` is always honest: it is the number
 * of prices that went in, which for a scoped benchmark is the pick count.
 */
export type PriceStats = {
  count: number;
  minMinor: number | null;
  p25Minor: number | null;
  medianMinor: number | null;
  p75Minor: number | null;
  maxMinor: number | null;
  meanMinor: number | null;
};

/**
 * Quantile by linear interpolation on the sorted values (the type-7
 * definition, as R and numpy default to), rounded to whole paise. A
 * deterministic, bog-standard definition — stated here so "median" on the
 * screen means this and nothing else.
 */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return Math.round(
    sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower),
  );
}

export function priceStats(prices: number[]): PriceStats {
  if (prices.length === 0) {
    return {
      count: 0,
      minMinor: null,
      p25Minor: null,
      medianMinor: null,
      p75Minor: null,
      maxMinor: null,
      meanMinor: null,
    };
  }
  const sorted = [...prices].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    count: sorted.length,
    minMinor: sorted[0],
    p25Minor: quantile(sorted, 0.25),
    medianMinor: quantile(sorted, 0.5),
    p75Minor: quantile(sorted, 0.75),
    maxMinor: sorted[sorted.length - 1],
    meanMinor: Math.round(mean),
  };
}

// ————————————————————— league price benchmark —————————————————————

/**
 * Cap on the per-pick working stored inside a payload. The picks are the
 * audit trail — which rows, at which prices, picked for which reasons — and
 * a thousand-row league would make one JSON row unreadable. The counts in
 * `computedFrom` are always over the FULL set; only the listed working is
 * truncated, and `picksTruncated` says so.
 */
export const PICKS_IN_PAYLOAD_CAP = 500;

export type BenchmarkPickWorking = {
  researchProductId: string;
  label: string | null;
  priceMinor: number | null;
  rationale: string;
};

export type LeaguePriceBenchmarkPayload = {
  computedFrom: ComputedFrom;
  league: AnalyticsLeague;
  scope: ComparisonScope;
  /** "" for the league-wide row, else the source the benchmark is narrowed to. */
  sourceKey: string;
  /**
   * The distribution over the picks' prices. Every field is null for the
   * QUOTE_ONLY_SEPARATE scope — quote-only rows carry NULL prices by design
   * (B3), so their benchmark is a COUNT (computedFrom.included), never an
   * average. That is the "quote-only is not free" rule wearing its suit.
   */
  stats: PriceStats;
  picks: BenchmarkPickWorking[];
  picksTruncated: boolean;
};

export function leaguePriceBenchmarkPayload(args: {
  league: AnalyticsLeague;
  scope: ComparisonScope;
  sourceKey?: string;
  rows: ScopedVariantRow[];
  picks: ScopedPick[];
}): LeaguePriceBenchmarkPayload {
  const prices = args.picks
    .map((p) => p.row.priceMinor)
    .filter((v): v is number => v !== null);
  return {
    computedFrom: computedFrom(args.rows, args.picks),
    league: args.league,
    scope: args.scope,
    sourceKey: args.sourceKey ?? "",
    stats: priceStats(prices),
    picks: args.picks.slice(0, PICKS_IN_PAYLOAD_CAP).map((p) => ({
      researchProductId: p.row.researchProductId,
      label: p.row.label,
      priceMinor: p.row.priceMinor,
      rationale: p.rationale,
    })),
    picksTruncated: args.picks.length > PICKS_IN_PAYLOAD_CAP,
  };
}

// ————————————————————— funnel overview —————————————————————

export type FunnelOverviewPayload = {
  computedFrom: ComputedFrom;
  states: Record<ShortlistState, number>;
};

/**
 * The corpus counted through the funnel. Not league-scoped and not a price
 * anywhere — `computedFrom` here accounts for PRODUCTS, not variant rows:
 * every researched product is in exactly one state (NEW folded in), so
 * included = considered and the exclusions are all zero, said explicitly
 * rather than omitted.
 */
export function funnelOverviewPayload(
  states: Record<ShortlistState, number>,
): FunnelOverviewPayload {
  const total = Object.values(states).reduce((a, b) => a + b, 0);
  return {
    computedFrom: {
      included: total,
      considered: total,
      exclusions: { reference: 0, quoteOnly: 0, unpriced: 0, outOfScope: 0 },
    },
    states,
  };
}
