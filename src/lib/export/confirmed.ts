/**
 * The confirmed-products export — the replacement for the Google Sheet.
 *
 * `CONFIRMED_PRODUCTS ≡ { p : p.confirmedAt IS NOT NULL }` (see
 * `src/lib/scraper/confirm.ts`). That invariant does not change here; what
 * changes is where the list can be READ. Until now the only way to get it out
 * of the database was a push to a Google Sheet tab, which made a third-party
 * spreadsheet the owner's view of their own final list.
 *
 * This module produces the same list as a file. It is a prerequisite for
 * removing the Sheets integration, not a nice-to-have alongside it: the owner
 * must never be left without an export path (docs/plan/03-sheets-removal.md §5).
 *
 * Column keys are the machine-friendly ones from the resin-merchandiser brief
 * (`internal_product_id`, `price_basis`, `confirmed_at`), not presentation
 * labels — a spreadsheet header that reads "Price Min" is a column nobody can
 * write a formula against twice.
 *
 * Pure: no Prisma import, no database, no workbook library. (The one import
 * below is TYPE-ONLY and resolves through `product-size-tier.ts`, which is
 * itself pure — it erases at compile and adds no runtime edge.) The shaping rules
 * are the interesting part, so they live where a test can reach them.
 */

import type { ProductSizeTier } from "@/lib/product-size-tier";

/**
 * How a price should be read — the brief's central rule made into data.
 *
 * `QUOTE_ONLY` exists so that "price on request" is never exported as `0`.
 * A zero in a price column is a number, and a number gets averaged, charted
 * and compared; that is how a bespoke commission ends up dragging a category
 * mean to the floor. A quote-only row carries an EMPTY price cell and says so
 * in `price_basis`.
 *
 * Only two members today because `Product` stores one price pair and no unit.
 * `PER_AREA` and `STARTING_FROM` arrive with the resin ontology
 * (docs/plan/02-scraper-rebuild.md §4), and adding them here first would be a
 * column that is always `PER_PIECE` pretending to be a measurement.
 */
export type PriceBasis = "PER_PIECE" | "QUOTE_ONLY";

/**
 * Canonical export column order. Append only — never reorder.
 *
 * Someone's saved spreadsheet formula references column H. Reordering is a
 * silent break: the file still opens, the numbers are just wrong.
 */
export const CONFIRMED_EXPORT_COLUMNS = [
  "internal_product_id",
  "slug",
  "title",
  "canonical_product_type",
  "status",
  "price_basis",
  "currency",
  "list_price",
  "sale_price",
  "availability",
  "lead_time_text",
  "materials_raw",
  "dimensions_raw",
  "source_name",
  "source_product_id",
  "product_tier",
  "tier",
  "needs_rewrite",
  "hero_image_url",
  "image_count",
  "confirmed_at",
  "confirmed_by",
  "created_at",
  "updated_at",
] as const;

/**
 * The shape the export needs — deliberately not the whole `Product` row.
 *
 * Structural rather than a Prisma type so the unit test can build a row
 * without generating a client, and so a schema change that does not touch
 * these fields cannot break this module.
 */
export type ConfirmedExportProduct = {
  id: string;
  slug: string;
  title: string;
  category: { slug: string } | null;
  status: string;
  showPrice: boolean;
  priceMin: number | null;
  priceMax: number | null;
  inStock: boolean;
  timeline: string | null;
  materials: string | null;
  dimensions: string | null;
  importSource: string | null;
  importRef: string | null;
  /** The owner's product tier. Empty for a row nobody has filed yet. */
  sizeTier: ProductSizeTier | null;
  tier: number | null;
  needsRewrite: boolean;
  /** First gallery image by `order`, or null when the product has none. */
  heroImageUrl: string | null;
  /**
   * How many images the product has — counted in the database, not derived
   * from a `take: 1` hero select. The Sheet push fetched one image and could
   * not have reported a count; asking for every row's whole gallery just to
   * call `.length` would be a needless second table's worth of data.
   */
  imageCount: number;
  confirmedAt: Date | null;
  confirmedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The catalogue prices in rupees and `Product` carries no currency column, so
 * the constant is honest about being a constant rather than reading a field
 * that does not exist.
 */
export const EXPORT_CURRENCY = "INR";

/**
 * Quote-only when the product hides its price, or shows one it does not have.
 *
 * The second case is the one that matters: `showPrice: true` with a null
 * `priceMin` is a row mid-edit, and exporting it as `PER_PIECE` with an empty
 * price would let a reader assume the price is zero rather than absent.
 */
export function priceBasisOf(p: {
  showPrice: boolean;
  priceMin: number | null;
}): PriceBasis {
  return p.showPrice && p.priceMin !== null ? "PER_PIECE" : "QUOTE_ONLY";
}

/** ISO-8601 in UTC, or empty. Never a locale-formatted date in a data file. */
const iso = (d: Date | null): string => (d === null ? "" : d.toISOString());

/** Integers as digits, `null` as EMPTY — never `0`, never "N/A". */
const num = (n: number | null): string => (n === null ? "" : String(n));

/**
 * One product as one export row, in `CONFIRMED_EXPORT_COLUMNS` order.
 *
 * `canonical_product_type` is the category slug. That is the most specific
 * honest answer available today: the resin taxonomy (canonical family, product
 * type, scale class) does not exist in this schema yet, and emitting a guess
 * under a canonical-sounding key is how an inference becomes a fact.
 */
export function confirmedProductToRow(p: ConfirmedExportProduct): string[] {
  const basis = priceBasisOf(p);
  // The whole point: a quote-only row exports no number at all.
  const listPrice = basis === "QUOTE_ONLY" ? "" : num(p.priceMin);
  const salePrice = basis === "QUOTE_ONLY" ? "" : num(p.priceMax);

  return [
    p.id,
    p.slug,
    p.title,
    p.category?.slug ?? "",
    p.status,
    basis,
    EXPORT_CURRENCY,
    listPrice,
    salePrice,
    p.inStock ? "in_stock" : "out_of_stock",
    p.timeline ?? "",
    p.materials ?? "",
    p.dimensions ?? "",
    p.importSource ?? "",
    p.importRef ?? "",
    // The column Bulk Import reads back under the same name, so an export can
    // be edited in a spreadsheet and re-imported without losing the tier.
    p.sizeTier ?? "",
    num(p.tier),
    p.needsRewrite ? "true" : "false",
    p.heroImageUrl ?? "",
    String(p.imageCount),
    iso(p.confirmedAt),
    p.confirmedById ?? "",
    iso(p.createdAt),
    iso(p.updatedAt),
  ];
}

/** Every confirmed product as rows, in the order the caller supplied them. */
export function confirmedProductsToRows(
  products: readonly ConfirmedExportProduct[],
): string[][] {
  return products.map(confirmedProductToRow);
}
