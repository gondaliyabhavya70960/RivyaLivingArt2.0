/**
 * Product explorer (A9, plan §6 — "the doc's Prompt 21 filter set over raw +
 * normalized values side by side"). This module is the pure half: what one
 * explorer row IS, and how the normalized column reads next to the raw one.
 *
 * The side-by-side is the point of the screen. The raw column is what the
 * source SAID (the staged twin's own fields); the normalized column is what
 * we call it after B6's reference-variant pick and B4's owner aliases —
 * computed at read time, so a mapping fix relabels history without a
 * re-scrape. Where the two differ, the row shows both; where a value cannot
 * be normalized (a quote-only piece has no price), the normalized cell is
 * an honest "—", never a zero.
 *
 * Pure module: no db, no fetch.
 */
import type { PriceBasis } from "@/generated/prisma/enums";
import type { ScopedPick, ScopedVariantRow } from "@/lib/scraper/comparison-scopes";
import { pickReferenceVariant } from "@/lib/scraper/comparison-scopes";

/** Split a free-text materials string ("epoxy resin, acacia wood") into
 *  phrases for alias resolution or display. Shared by the explorer and the
 *  B9 embedder — two readers, one splitting rule. */
export function splitMaterialList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;+/]|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The columns an explorer row carries, raw and normalized apart. */
export type ExplorerRow = {
  researchProductId: string;
  title: string;
  url: string;
  sourceKey: string;
  sourceName: string;
  league: string;
  state: string;
  /** RAW: the staged row's own price fields (major units, as scraped). */
  rawPriceMin: number | null;
  rawPriceMax: number | null;
  /** RAW: the staged row's materials string, verbatim. */
  rawMaterials: string | null;
  /** RAW: the staged row's dimensions string, verbatim. */
  rawDimensions: string | null;
  /** NORMALIZED: the reference variant's price in paise, or null when no
   *  comparable price exists (quote-only / unpriced) — never zero. */
  referencePriceMinor: number | null;
  /** NORMALIZED: what the reference price MEANS. */
  priceBasis: PriceBasis | null;
  /** NORMALIZED: why this row is the reference ("only comparable variant"…). */
  referenceRationale: string | null;
  /** NORMALIZED: materials through the owner's alias map. */
  canonicalMaterials: string[];
  /** How many variant rows the latest snapshot carries. */
  variantCount: number;
  lastSeen: Date;
};

/** What the db layer hands over, already joined: identity + twin + the
 *  latest snapshot's rows. */
export type ExplorerRowInput = {
  researchProductId: string;
  sourceKey: string;
  sourceName: string;
  league: string;
  state: string;
  canonicalUrl: string;
  lastSeen: Date;
  twin: {
    title: string;
    url: string;
    priceMin: number | null;
    priceMax: number | null;
    materials: string | null;
    dimensions: string | null;
  } | null;
  rows: ScopedVariantRow[];
  /** Split + alias-resolve materials; injected so this module stays pure. */
  resolveMaterials: (raw: string | null) => string[];
};

/**
 * Shape one explorer row. The normalized price is B6's reference-variant
 * pick over the latest snapshot — the same row benchmarks and embeddings
 * read, so "the price" means one thing across every screen.
 */
export function shapeExplorerRow(input: ExplorerRowInput): ExplorerRow {
  const pick: ScopedPick | null = pickReferenceVariant(input.rows);
  const quoteOnly = input.rows.some((r) => r.priceBasis === "QUOTE_ONLY");
  return {
    researchProductId: input.researchProductId,
    title: input.twin?.title ?? input.canonicalUrl,
    url: input.twin?.url ?? input.canonicalUrl,
    sourceKey: input.sourceKey,
    sourceName: input.sourceName,
    league: input.league,
    state: input.state,
    rawPriceMin: input.twin?.priceMin ?? null,
    rawPriceMax: input.twin?.priceMax ?? null,
    rawMaterials: input.twin?.materials ?? null,
    rawDimensions: input.twin?.dimensions ?? null,
    referencePriceMinor: pick?.row.priceMinor ?? null,
    // A product whose rows are all quote-only reports QUOTE_ONLY even with
    // no pick — the basis is a fact about the listing, not about the pick.
    priceBasis: pick?.row.priceBasis ?? (quoteOnly ? "QUOTE_ONLY" : null),
    referenceRationale: pick?.rationale ?? null,
    canonicalMaterials: input.resolveMaterials(input.twin?.materials ?? null),
    variantCount: input.rows.length,
    lastSeen: input.lastSeen,
  };
}

/** The price-basis filter vocabulary: the four bases, or "none" for a row
 *  with no comparable price and no quote-only marker. */
export type ExplorerBasisFilter = PriceBasis | "NONE";

/**
 * Does one shaped row match a price-basis filter? "NONE" matches rows whose
 * listing told us nothing about price at all — exactly the rows the data
 * quality screen wants found.
 */
export function matchesBasis(
  row: Pick<ExplorerRow, "priceBasis">,
  filter: ExplorerBasisFilter | "ALL",
): boolean {
  if (filter === "ALL") return true;
  if (filter === "NONE") return row.priceBasis === null;
  return row.priceBasis === filter;
}

/** Case-insensitive substring match over title — the explorer's `q`. */
export function matchesQuery(
  row: Pick<ExplorerRow, "title">,
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return row.title.toLowerCase().includes(needle);
}
