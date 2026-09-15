/**
 * Enrichment defaults applied to a scraped row on its way into the catalog:
 * the care notes, the derived copy, the fields a supplier's page never
 * publishes.
 *
 * Was `product-sheet.ts`, and most of it WAS about Google Sheets — the Sheet1
 * tab name, the bulk-upload column contract and the row serializer all went
 * with the Sheets removal (plan C). What survived is the half that was never
 * about a spreadsheet: `importOneScrapedRow` shares these defaults so the
 * database import and anything else deriving a product from a scrape cannot
 * drift apart.
 *
 * Plain module (no "use client" / "use server" / server-only).
 */

/** Standard resin-care default so every product carries care notes. */
export const DEFAULT_CARE_NOTES =
  "Wipe clean with a soft, dry cloth. Keep away from direct sunlight and heat to preserve colour and shine. Do not soak or use harsh chemicals.";

/** Structural subset of a staged ScrapedProduct the enricher needs. */
export type ScrapedRow = {
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

/**
 * Fill the fields a scraped source rarely provides with smart defaults so an
 * imported product is upload-complete. Shared by the scraper's promote path
 * and the CSV tier fill — keep this the single source of these defaults.
 */
export function enrichScrapedFields(row: ScrapedRow) {
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
