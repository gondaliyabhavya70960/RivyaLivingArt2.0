/**
 * Bulk Import — a Product Scraper export (the ScrapeDeck CSV that
 * `/studio/scraper` downloads, columns in `SCRAPEDECK_COLUMNS`) read as a
 * PRODUCTS file.
 *
 * For a year `validate.ts` refused any file carrying the ScrapeDeck signature,
 * for every template type, with a toast that sent the owner back to the
 * scraper's review inbox. The owner exported that file and wanted it to
 * import. It now does, as PRODUCTS ONLY, and with the guarantees the
 * scraper's own promote path gives (`importOneScrapedRow` in
 * `src/actions/scraper-review.ts`): every row lands as a DRAFT with the
 * rewrite guard on, is deduplicated on `(importSource, importRef)` — the
 * same pair, in the same format, so a row imported by either path is the
 * same row to the other — and its staged twin is marked IMPORTED.
 *
 * This module is the PURE half: the detection and the column remap. The
 * writer (`product-row.ts`) and the validator (`validate.ts`) read the
 * remapped row; nothing here touches the database.
 *
 * The parser lower-cases every header, so a ScrapeDeck column such as
 * `shortTagline` arrives as `shorttagline`, and the products template's own
 * name for it is `short_tagline`. `remapScrapeExportRow` accepts BOTH
 * spellings and is idempotent — `runImport` re-validates the rows the wizard
 * echoes back, and those rows have already been remapped once.
 */

import { uncsvCell } from "@/lib/export/csv";
import { slugify } from "@/lib/slug";

/** The origin a validated file can carry; `undefined` is an ordinary file. */
export type ImportOrigin = "scraper";

/**
 * Provenance columns the remap ADDS beside the products template's own — the
 * identity the writer deduplicates on, the source's own category text the
 * validator auto-maps from, the listing's URL, and the adapter's `fields`
 * JSON (`productType` feeds the tier suggestion).
 */
export const SCRAPE_EXPORT_PROVENANCE_COLUMNS = [
  "source_key",
  "external_id",
  "source_category",
  "source_url",
  "fields",
] as const;

/**
 * Marker cells the VALIDATOR writes beside a value it filled in — `TRUE`
 * when `category_slug` was auto-mapped from the source category, `TRUE`
 * when `product_tier` was suggested from the listing. They exist because the
 * wizard echoes the validated rows back to `runImport`, which validates
 * them again: without the marks a second pass would read our own fill as
 * the owner's explicit cell, count nothing as suggested, and — worse — let
 * a SUGGESTED tier overwrite one the owner had filed in the studio. An
 * explicit cell always wins over a suggestion; the marks are how the writer
 * still knows which is which.
 */
export const CATEGORY_AUTO_MARK = "category_auto";
export const PRODUCT_TIER_SUGGESTED_MARK = "product_tier_suggested";

/**
 * True when the lower-cased header set carries the ScrapeDeck signature:
 * a source key AND an external id, in either the export's camelCase (as the
 * parser lower-cases it) or the snake_case a sheet edit — or our own remap —
 * introduces. `contenthash` is a supporting signal only: a file with a
 * content hash and no identity pair is not one we could deduplicate, so it
 * is read as an ordinary file and judged on its columns.
 */
export function detectScrapeExport(headers: Iterable<string>): boolean {
  const set = new Set<string>();
  for (const header of headers) set.add(header.trim().toLowerCase());
  const hasSourceKey = set.has("sourcekey") || set.has("source_key");
  const hasExternalId = set.has("externalid") || set.has("external_id");
  return hasSourceKey && hasExternalId;
}

/**
 * The first non-empty cell among `keys`, trimmed, or "".
 *
 * `uncsvCell` undoes the export's formula-injection guard: the writer
 * prefixes an apostrophe to a cell starting `=`, `+`, `-`, `@`, tab or CR so
 * a spreadsheet renders it as text, and a spreadsheet eats that apostrophe
 * on the way back — a program does not. Scraped titles genuinely start with
 * "-", so without this the catalogue would carry the guard character.
 */
function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return uncsvCell(value);
  }
  return "";
}

/**
 * `in_stock` from the ScrapeDeck `status` column, which is the listing's
 * availability (`active` / `out_of_stock`), never a `ContentStatus`. An
 * explicit `in_stock` cell (a hand edit, or the previous pass of this remap)
 * wins; anything else the column says leaves the cell blank, which the
 * importer reads as "no opinion".
 */
function inStockFrom(row: Record<string, string>): string {
  const explicit = pick(row, "in_stock");
  if (explicit) return explicit;
  const status = pick(row, "status").toLowerCase();
  if (status === "active") return "TRUE";
  if (status === "out_of_stock") return "FALSE";
  return "";
}

/**
 * One lower-cased ScrapeDeck row → one products-template row.
 *
 * What is FORCED, whatever the file says:
 * - `status` is always blank. A scraped row lands as a DRAFT; the writer
 *   sets that itself, and the ScrapeDeck `status` column means availability
 *   (it becomes `in_stock` instead).
 * - `tier` (the import list, 1–4) is always blank. A scraped row came from
 *   a supplier's site, not from one of the four committed CSV lists.
 * - `slug` is made URL-safe (`slugify`), falling back to the title, the way
 *   `uniqueSlug` does on the promote path — a supplier's handle is not a
 *   slug the validator should refuse.
 *
 * What is KEPT when the owner added it by hand: `category_slug` and
 * `product_tier` (blank otherwise, for the validator to fill), every
 * products column that already carries its template name, and the
 * `custom1_*…custom6_*` customization columns — the wizard invites exactly
 * this kind of hand edit, and a column silently dropped is worse than one
 * refused.
 */
export function remapScrapeExportRow(
  row: Record<string, string>,
): Record<string, string> {
  const title = pick(row, "title");
  const slug = slugify(pick(row, "slug")) || slugify(title);
  const custom = Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => /^custom[1-6]_/.test(key))
      .map(([key, value]) => [key, uncsvCell(value?.trim() ?? "")]),
  );
  return {
    ...custom,
    title,
    slug,
    category_slug: pick(row, "category_slug"),
    short_tagline: pick(row, "short_tagline", "shorttagline"),
    description: pick(row, "description"),
    price_min: pick(row, "price_min", "pricemin"),
    price_max: pick(row, "price_max", "pricemax"),
    show_price: pick(row, "show_price", "showprice"),
    timeline: pick(row, "timeline"),
    materials: pick(row, "materials"),
    dimensions: pick(row, "dimensions"),
    occasions: pick(row, "occasions"),
    care_notes: pick(row, "care_notes"),
    status: "",
    product_tier: pick(row, "product_tier"),
    tier: "",
    in_stock: inStockFrom(row),
    featured: pick(row, "featured"),
    video_url: pick(row, "video_url"),
    model3d_url: pick(row, "model3d_url"),
    seo_title: pick(row, "seo_title", "seotitle"),
    seo_description: pick(row, "seo_description", "seodescription"),
    images: pick(row, "images"),
    image_alts: pick(row, "image_alts", "imagealts"),
    // Provenance — what the writer and the validator need that the products
    // template has no column for.
    source_key: pick(row, "source_key", "sourcekey"),
    external_id: pick(row, "external_id", "externalid"),
    source_category: pick(row, "source_category", "category"),
    source_url: pick(row, "source_url", "url"),
    fields: pick(row, "fields"),
    // The validator's own marks survive the round trip (see above).
    [CATEGORY_AUTO_MARK]: pick(row, CATEGORY_AUTO_MARK),
    [PRODUCT_TIER_SUGGESTED_MARK]: pick(row, PRODUCT_TIER_SUGGESTED_MARK),
  };
}

/**
 * The adapter's `fields` JSON, parsed — or null when the cell is empty or
 * not JSON. Never throws: a hand-edited cell must fail one suggestion, not
 * the file.
 */
export function parseScrapeFields(raw: string | undefined): unknown {
  const text = raw?.trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * The identity a scraper-origin row is deduplicated on — the same pair the
 * promote path writes to `Product.importSource` / `Product.importRef`,
 * joined the way `tier-fill.ts` joins its tombstone keys. Null when either
 * half is missing: such a row is refused by the validator rather than
 * written, because without the pair a second upload could only duplicate it.
 */
export function scrapeIdentityKey(row: Record<string, string>): string | null {
  const sourceKey = row.source_key?.trim();
  const externalId = row.external_id?.trim();
  return sourceKey && externalId ? `${sourceKey}|${externalId}` : null;
}
