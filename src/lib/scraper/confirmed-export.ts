/**
 * The confirmed-list export (B7, plan §6 + 03 §C) — the column contract and
 * the row serializer for the gated final list. The route
 * (`/api/scraper/export-confirmed`) assembles the rows; this module turns
 * one row into cells, so CSV and XLSX can never disagree about what a
 * column means.
 *
 * Pure module: no db, no fetch. Prices leave here as MAJOR units
 * ("45000.00") — the export is a working file for Excel, and paise are an
 * implementation detail. A quote-only pick exports an empty price with
 * `priceBasis` saying QUOTE_ONLY: quote-only is not free, and an empty cell
 * plus the basis says exactly that (rule 3).
 */
import { toCsvDocument } from "@/lib/export/csv";
import type { ScopedPick } from "@/lib/scraper/comparison-scopes";
import type { PriceBasis } from "@/generated/prisma/enums";

/** EXACT confirmed-list v1 column order — never reorder, only append. */
export const CONFIRMED_COLUMNS = [
  "sourceKey",
  "sourceName",
  "externalId",
  "title",
  "url",
  "referencePrice",
  "currency",
  "priceBasis",
  "referenceVariant",
  "pickRationale",
  "note",
  "tags",
  "confirmedBy",
  "confirmedAt",
  "firstSeen",
  "lastSeen",
] as const;

export type ConfirmedExportRow = {
  sourceKey: string;
  /** Human website name ("sumaiyaresin.art"), falling back to the key. */
  sourceName: string;
  externalId: string;
  title: string;
  url: string;
  /**
   * The deterministic reference-variant pick over the latest snapshot (B6),
   * or null when nothing is comparable — an all-quote-only listing has no
   * base product, and inventing one would be the zero-price bug again.
   */
  pick: ScopedPick | null;
  currency: string;
  note: string | null;
  tags: string[];
  /** Email of the staff user who confirmed, or "" when nobody recorded it. */
  confirmedBy: string;
  confirmedAt: Date | null;
  firstSeen: Date;
  lastSeen: Date;
};

/** paise → "45000.00"; null (quote-only / unpriced) → "". */
export function formatPriceMajor(priceMinor: number | null): string {
  if (priceMinor === null) return "";
  return (priceMinor / 100).toFixed(2);
}

const PRICE_BASIS_LABELS: Record<PriceBasis, string> = {
  PER_PIECE: "per piece",
  PER_AREA: "per area",
  STARTING_FROM: "starting from",
  QUOTE_ONLY: "quote only",
};

/** One confirmed product → one export row, in CONFIRMED_COLUMNS order. */
export function confirmedRowToCells(row: ConfirmedExportRow): string[] {
  const pick = row.pick;
  return [
    row.sourceKey,
    row.sourceName,
    row.externalId,
    row.title,
    row.url,
    formatPriceMajor(pick?.row.priceMinor ?? null),
    row.currency,
    pick ? PRICE_BASIS_LABELS[pick.row.priceBasis] : "",
    pick?.row.label ?? "",
    pick?.rationale ?? "",
    row.note ?? "",
    row.tags.join(" | "),
    row.confirmedBy,
    row.confirmedAt?.toISOString() ?? "",
    row.firstSeen.toISOString(),
    row.lastSeen.toISOString(),
  ];
}

/**
 * Full CSV document: header + rows, CRLF throughout, with the shared
 * formula-injection guard from `@/lib/export/csv` — a scraped title starting
 * with `=` must arrive in Excel as text, not as a formula (SEC-108).
 */
export function confirmedRowsToCsv(rows: ConfirmedExportRow[]): string {
  return toCsvDocument(CONFIRMED_COLUMNS, rows.map(confirmedRowToCells));
}
