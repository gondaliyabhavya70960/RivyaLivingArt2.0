/**
 * Serialize scraped/imported products into the bulk-upload "products" column
 * format so they can be linked into the designated Google Sheet's **Sheet1**
 * tab and re-imported through the bulk uploader unchanged.
 *
 * Plain module (no "use client" / "use server" / server-only) — the same
 * enrichment defaults are shared by the DB import (importOneScrapedRow) and
 * the sheet serializer so the two never drift.
 */
import { cell } from "@/lib/scraper/export";
import { getImportTemplate, templateColumns } from "@/lib/import/templates";
import { slugify } from "@/lib/slug";

/** The gid=0 tab of a fresh Google Sheet — where selected products are linked. */
export const PRODUCT_SHEET_TAB = "Sheet1";

/**
 * Bulk-upload "products" columns, in template order. The merge key is `slug`
 * (column B); syncProductsToSheet1 relies on that position.
 */
export const PRODUCT_SHEET_COLUMNS: readonly string[] = (() => {
  const template = getImportTemplate("products");
  return template ? templateColumns(template) : [];
})();

/** Cap on gallery images written per row — matches the import mirror cap. */
const MAX_SHEET_IMAGES = 6;

/** Standard resin-care default so every product carries care notes. */
export const DEFAULT_CARE_NOTES =
  "Wipe clean with a soft, dry cloth. Keep away from direct sunlight and heat to preserve colour and shine. Do not soak or use harsh chemicals.";

/** Structural subset of a staged ScrapedProduct the serializer/enricher need. */
export type ScrapedForSheet = {
  title: string;
  slug: string;
  shortTagline: string | null;
  description: string | null;
  priceMin: number | null;
  priceMax: number | null;
  showPrice: boolean | null;
  timeline: string | null;
  materials: string | null;
  dimensions: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  images: unknown;
  imageAlts: unknown;
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Fill the fields a scraped source rarely provides with smart defaults so an
 * imported product is upload-complete. Shared verbatim by the DB import and
 * the Sheet1 serializer — keep this the single source of these defaults.
 */
export function enrichScrapedFields(row: ScrapedForSheet) {
  const description = row.description ?? "";
  return {
    shortTagline: row.shortTagline,
    description,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    showPrice: row.showPrice ?? true,
    timeline: row.timeline,
    materials: row.materials,
    dimensions: row.dimensions,
    careNotes: DEFAULT_CARE_NOTES,
    seoTitle: row.seoTitle ?? row.title.slice(0, 70),
    seoDescription:
      row.seoDescription ??
      ((row.shortTagline || description).slice(0, 160) || null),
  };
}

/**
 * One scraped row + its resolved catalog category slug → one bulk-upload
 * "products" row, in PRODUCT_SHEET_COLUMNS order. Built as a keyed map then
 * projected through the header so the column order can never fall out of sync.
 */
export function scrapedRowToProductSheetRow(
  row: ScrapedForSheet,
  categorySlug: string,
): string[] {
  const f = enrichScrapedFields(row);
  const values: Record<string, string> = {
    title: row.title,
    slug: row.slug || slugify(row.title),
    category_slug: categorySlug,
    short_tagline: cell(f.shortTagline),
    description: cell(f.description),
    price_min: cell(f.priceMin),
    price_max: cell(f.priceMax),
    show_price: cell(f.showPrice),
    timeline: cell(f.timeline),
    materials: cell(f.materials),
    dimensions: cell(f.dimensions),
    occasions: "",
    care_notes: cell(f.careNotes),
    status: "DRAFT",
    featured: "FALSE",
    video_url: "",
    model3d_url: "",
    seo_title: cell(f.seoTitle),
    seo_description: cell(f.seoDescription),
    images: cell(toStringArray(row.images).slice(0, MAX_SHEET_IMAGES)),
    image_alts: cell(toStringArray(row.imageAlts).slice(0, MAX_SHEET_IMAGES)),
  };
  return PRODUCT_SHEET_COLUMNS.map((col) => values[col] ?? "");
}
