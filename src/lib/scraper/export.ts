/**
 * ScrapeDeck v4 serialization — the CSV the owner downloads from the Studio
 * (`/api/scraper/export`: the per-job and per-source CSV buttons, and the
 * admin-only "Scraped products" row on `/studio/exports`), in this exact
 * column order. Column A is sourceKey and column C is externalId: that pair
 * is the row's identity, and Bulk Import's scraper-export path
 * (`src/lib/import/scrape-export.ts`) deduplicates on it when the owner
 * feeds the file back in as Products. There is no other destination — the
 * Google Sheet sync that used to emit these same columns was removed on
 * 2026-09-15 (plan C), and the file is the whole export.
 */
import { toCsvDocument } from "@/lib/export/csv";

/** EXACT ScrapeDeck v4 column order — never reorder, only append. */
export const SCRAPEDECK_COLUMNS = [
  "sourceKey",
  "vertical",
  "externalId",
  "title",
  "slug",
  "category",
  "shortTagline",
  "description",
  "priceMin",
  "priceMax",
  "currency",
  "showPrice",
  "timeline",
  "materials",
  "dimensions",
  "status",
  "featured",
  "images",
  "imageAlts",
  "fields",
  "seoTitle",
  "seoDescription",
  "url",
  "firstSeen",
  "lastSeen",
  "contentHash",
] as const;

/**
 * Structural subset of the Prisma `ScrapedProduct` row that the serializer
 * needs — Json columns arrive as `unknown`, optional columns as `null`.
 */
export type ScrapeDeckProduct = {
  sourceKey: string;
  vertical: string;
  externalId: string;
  title: string;
  slug: string;
  category?: string | null;
  shortTagline?: string | null;
  description?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  currency: string;
  showPrice?: boolean | null;
  timeline?: string | null;
  materials?: string | null;
  dimensions?: string | null;
  status?: string | null;
  featured?: boolean | null;
  images: unknown;
  imageAlts: unknown;
  fields: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
  url: string;
  firstSeen?: Date | string | null;
  lastSeen?: Date | string | null;
  contentHash?: string | null;
};

/**
 * Scalar cell serialization: null/undefined → "", booleans → TRUE/FALSE,
 * dates → ISO 8601, arrays → " | "-joined, everything else → String().
 */
export function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => cell(v)).join(" | ");
  return String(value);
}

/** One staged product → one ScrapeDeck row, in SCRAPEDECK_COLUMNS order. */
export function rowToScrapeDeck(p: ScrapeDeckProduct): string[] {
  return [
    p.sourceKey,
    p.vertical,
    p.externalId,
    p.title,
    p.slug,
    cell(p.category),
    cell(p.shortTagline),
    cell(p.description),
    cell(p.priceMin),
    cell(p.priceMax),
    p.currency,
    cell(p.showPrice),
    cell(p.timeline),
    cell(p.materials),
    cell(p.dimensions),
    cell(p.status),
    cell(p.featured),
    cell(p.images),
    cell(p.imageAlts),
    JSON.stringify(p.fields ?? {}),
    cell(p.seoTitle),
    cell(p.seoDescription),
    p.url,
    cell(p.firstSeen),
    cell(p.lastSeen),
    cell(p.contentHash),
  ];
}

/**
 * Full CSV document: header row + data rows, CRLF line endings.
 *
 * The quoting and the formula-injection guard (SEC-108: scraped third-party
 * text can start with =, +, -, @, tab or CR, which a spreadsheet would
 * evaluate on open) live in `@/lib/export/csv`, so that this download and
 * the Studio exports cannot disagree about how a cell containing a comma is
 * written. Every row leaves through that guard — the file is the only
 * destination now, so there is no raw-value path beside it.
 */
export function toCsv(rows: string[][]): string {
  return toCsvDocument(SCRAPEDECK_COLUMNS, rows);
}
