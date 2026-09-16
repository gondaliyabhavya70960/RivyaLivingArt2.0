/**
 * Comparison scopes (B6, plan §6) — WHICH rows a benchmark reads.
 *
 * Leagues (leagues.ts) keep unlike MARKETS apart; scopes keep unlike QUESTIONS
 * apart inside one league. "What do variants of competitor pieces cost" and
 * "what does a piece cost" are different questions, and answering the second
 * by averaging the first lets a ten-variant listing outweigh a one-off
 * console ten to one.
 *
 * Four scopes:
 *   ALL_VARIANTS        — every comparable variant row, one vote each.
 *   BASE_PRODUCT        — one reference variant per snapshot, picked by
 *                         deterministic rules with the reason recorded.
 *   UNIQUE_DESIGN       — one vote per DESIGN (research product): the latest
 *                         snapshot's reference variant, so re-scrapes of the
 *                         same piece never multiply its weight.
 *   QUOTE_ONLY_SEPARATE — quote-only rows in their own arena. They carry a
 *                         NULL price on purpose (B3); averaging them into a
 *                         priced scope is the zero-price bug wearing a suit.
 *
 * Reference rows (isReference — marketplace listings, B2B MOQ prices) are
 * excluded from every scope. That exclusion is also enforced at the query by
 * `variantWhereForLeague`; it is repeated here because a scope applied to
 * rows somebody fetched without the guard should still refuse them.
 *
 * Pure module: no db, no fetch.
 */
import type { PriceBasis } from "@/generated/prisma/enums";

export const COMPARISON_SCOPES = [
  "ALL_VARIANTS",
  "BASE_PRODUCT",
  "UNIQUE_DESIGN",
  "QUOTE_ONLY_SEPARATE",
] as const;

export type ComparisonScope = (typeof COMPARISON_SCOPES)[number];

export const COMPARISON_SCOPE_LABELS: Record<ComparisonScope, string> = {
  ALL_VARIANTS: "All variants",
  BASE_PRODUCT: "Base product",
  UNIQUE_DESIGN: "Unique design",
  QUOTE_ONLY_SEPARATE: "Quote-only, separately",
};

/**
 * The minimal row a scope needs. Queries select exactly these fields; the
 * scope layer never touches the database itself, so it stays unit-testable
 * against literals.
 */
export type ScopedVariantRow = {
  snapshotId: string;
  researchProductId: string;
  capturedAt: Date;
  label: string | null;
  priceMinor: number | null;
  priceBasis: PriceBasis;
  isReference: boolean;
};

/** A row that survived a scope, with WHY recorded next to it. */
export type ScopedPick = {
  row: ScopedVariantRow;
  rationale: string;
};

/**
 * A row a benchmark may read: not a reference row, carries a real price, and
 * is not quote-only. QUOTE_ONLY rows carry NULL prices by guarantee (B3), so
 * the priceBasis check is the explicit statement of what the NULL already
 * implies.
 */
function isComparable(row: ScopedVariantRow): boolean {
  return (
    !row.isReference && row.priceMinor !== null && row.priceBasis !== "QUOTE_ONLY"
  );
}

/**
 * The deterministic reference-variant pick for one snapshot (BASE_PRODUCT),
 * or for one design's latest snapshot (UNIQUE_DESIGN).
 *
 * Rules, in order, all deterministic:
 *   1. Only comparable rows are eligible (reference/quote-only/unpriced
 *      never represent a product).
 *   2. A single candidate IS the reference — "only comparable variant".
 *   3. A row with no label is the implicit whole-product row an adapter
 *      emits when the page offered no options; exactly one of those beats
 *      labelled rows, because it IS the product rather than an option of it.
 *   4. Otherwise the lowest price wins — the entry point at which a buyer
 *      can have this piece, which is what "base product" means.
 *   5. Ties break on label, alphabetically, NULL first. Same price and same
 *      label would be two spellings of one variant; either is the same fact.
 *
 * Returns null when nothing is comparable — an all-quote-only snapshot has
 * no base product, and inventing one would be the zero-price bug again.
 */
export function pickReferenceVariant(
  rows: ScopedVariantRow[],
): ScopedPick | null {
  const candidates = rows.filter(isComparable);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return { row: candidates[0], rationale: "only comparable variant" };
  }

  const implicit = candidates.filter((r) => r.label === null);
  if (implicit.length === 1) {
    return {
      row: implicit[0],
      rationale: `implicit whole-product row over ${candidates.length - 1} labelled variant(s)`,
    };
  }

  const sorted = [...candidates].sort((a, b) => {
    const price = (a.priceMinor ?? 0) - (b.priceMinor ?? 0);
    if (price !== 0) return price;
    return (a.label ?? "").localeCompare(b.label ?? "");
  });
  const picked = sorted[0];
  const tied = sorted.filter(
    (r) => r.priceMinor === picked.priceMinor && r !== picked,
  );
  return {
    row: picked,
    rationale:
      tied.length > 0
        ? `lowest-priced of ${candidates.length} variants; ${tied.length} tie(s) broken by label`
        : `lowest-priced of ${candidates.length} variants`,
  };
}

/** Group rows by a key, preserving every row. */
function groupBy<K>(rows: ScopedVariantRow[], keyOf: (r: ScopedVariantRow) => K) {
  const groups = new Map<K, ScopedVariantRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/**
 * Rows belonging to a design's LATEST snapshot. Re-scrapes of an unchanged
 * product write no snapshot (B2), so the latest snapshot is the latest
 * actual state of the piece — ties on capturedAt break on snapshotId so the
 * pick is still deterministic.
 */
function latestSnapshotRows(rows: ScopedVariantRow[]): ScopedVariantRow[] {
  const sorted = [...rows].sort((a, b) => {
    const time = b.capturedAt.getTime() - a.capturedAt.getTime();
    if (time !== 0) return time;
    return b.snapshotId.localeCompare(a.snapshotId);
  });
  const latest = sorted[0];
  return sorted.filter(
    (r) =>
      r.snapshotId === latest.snapshotId &&
      r.capturedAt.getTime() === latest.capturedAt.getTime(),
  );
}

/**
 * Apply a scope to already-fetched rows. The league guard is the QUERY's job
 * (`variantWhereForLeague`); this function assumes one league's rows and
 * decides which of them answer the question being asked. Every returned row
 * carries its rationale, so a benchmark can show its working instead of
 * asking to be trusted.
 */
export function scopeRows(
  rows: ScopedVariantRow[],
  scope: ComparisonScope,
): ScopedPick[] {
  switch (scope) {
    case "ALL_VARIANTS":
      return rows.filter(isComparable).map((row) => ({
        row,
        rationale: "all-variants scope: every comparable variant, one vote each",
      }));

    case "QUOTE_ONLY_SEPARATE":
      return rows
        .filter((r) => !r.isReference && r.priceBasis === "QUOTE_ONLY")
        .map((row) => ({
          row,
          rationale:
            "quote-only scope: counted in its own arena, never averaged into priced benchmarks",
        }));

    case "BASE_PRODUCT": {
      const picks: ScopedPick[] = [];
      for (const snapshotRows of groupBy(rows, (r) => r.snapshotId).values()) {
        const pick = pickReferenceVariant(snapshotRows);
        if (pick) picks.push(pick);
      }
      return picks;
    }

    case "UNIQUE_DESIGN": {
      const picks: ScopedPick[] = [];
      for (const designRows of groupBy(rows, (r) => r.researchProductId).values()) {
        const pick = pickReferenceVariant(latestSnapshotRows(designRows));
        if (pick) {
          picks.push({
            ...pick,
            rationale: `unique-design scope: latest snapshot, ${pick.rationale}`,
          });
        }
      }
      return picks;
    }
  }
}
