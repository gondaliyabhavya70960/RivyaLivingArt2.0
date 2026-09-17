/**
 * Bulk Import — the PRODUCTS row writer (server-only: writes the database,
 * mirrors images into storage).
 *
 * Lifted out of `src/actions/import.ts` so a database test can drive it
 * without a staff session; the action still owns the session, the batching,
 * the activity row and the revalidation. Nothing here is a Server Action —
 * this module has no `"use server"` directive on purpose (an export of one
 * is a callable endpoint).
 *
 * Two origins share one writer:
 *
 * - An ORDINARY products file — the owner's own spreadsheet. Identity is the
 *   slug; `status`, `tier` and `product_tier` are whatever the cells say;
 *   an owner-edited row is protected unless the operator ticked the
 *   overwrite box.
 * - A PRODUCT SCRAPER EXPORT (`origin: "scraper"`, see `scrape-export.ts`).
 *   Identity is the `(source_key, external_id)` pair, written to
 *   `importSource` / `importRef` EXACTLY as the promote path writes them
 *   (`importOneScrapedRow` in `src/actions/scraper-review.ts`: the bare
 *   source key and the supplier's external id), so a row imported by either
 *   path is the same row to the other. Every NEW row lands as DRAFT with
 *   `needsRewrite` on and a slug uniquified against the catalogue; an
 *   UPDATE re-flags the row for rewrite and leaves its status alone (a
 *   re-scrape never takes a live product off the shop); a catalog-fill twin
 *   (`sheet:<key>`, the owner's own list) is left untouched; and in every
 *   branch the staged twin is marked IMPORTED and its shortlist entry
 *   confirmed — the same guarantees, in the same order, as the promote
 *   path. The one rule kept from THIS importer rather than that one is the
 *   merge: only an owner edit protects a bare-key row (the reason is in
 *   `importProductRow` below).
 */

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  type ImportOrigin,
  PRODUCT_TIER_SUGGESTED_MARK,
} from "@/lib/import/scrape-export";
import { CUSTOM_FIELD_SLOTS } from "@/lib/import/templates";
import {
  buildImageList,
  type ExistingProduct,
  identityKey,
  intOrNull,
  loadExistingProducts,
  normalizeStatus,
  parseBool,
  parseOccasions,
  splitList,
} from "@/lib/import/validate";
import { parseSizeTierCell } from "@/lib/product-size-tier";
import { decideMerge } from "@/lib/scraper/merge-policy";
import { enrichScrapedFields } from "@/lib/scraper/product-enrich";
import { markImportedConfirmed } from "@/lib/scraper/shortlist-write";
import { safeFetch } from "@/lib/scraper/ssrf";
import { createWithUniqueSlug, slugify, uniqueSlug } from "@/lib/slug";
import { ACCEPTED_UPLOAD_TYPES, putFile } from "@/lib/storage";
import { nullIfEmpty } from "@/lib/utils";

const MIRROR_MAX_BYTES = 8 * 1024 * 1024; // matches the media library cap

/**
 * The gallery cap for a SCRAPER-ORIGIN row, the promote path's own number
 * (`MAX_IMPORT_IMAGES` in `src/actions/scraper-review.ts`, which imports it
 * from here so the two cannot drift).
 *
 * Load-bearing, not tidiness: a Shopify listing carries ten or more images,
 * each mirrored with its own fetch, blob write and `Media` row, and a
 * per-source export runs hundreds of rows inside ONE server action. Without
 * the cap a 500-row export is ~5,000 sequential downloads, which no function
 * budget survives — and a run killed half way leaves drafts written, twins
 * marked imported and no report of which. An ordinary products file is the
 * owner's own spreadsheet and keeps its uncapped behaviour.
 */
export const MAX_IMPORT_IMAGES = 6;

export type ProductRowOutcome = "created" | "updated" | "protected";

/** Shared lookups built once per import instead of once per row. */
export type ProductImportContext = {
  origin: ImportOrigin | undefined;
  categoryIdBySlug: Map<string, string>;
  /** The catalogue rows this file already matches, by `identityKey`. */
  existingByKey: Map<string, ExistingProduct>;
  /** Who is running the import — stamped on the shortlist confirmation a
   *  scraper-origin row records, null for a session-less caller. */
  changedBy: string | null;
};

export async function buildProductImportContext(
  rows: Record<string, string>[],
  origin: ImportOrigin | undefined,
  changedBy: string | null,
): Promise<ProductImportContext> {
  const categories = await db.category.findMany({
    select: { id: true, slug: true },
  });
  return {
    origin,
    categoryIdBySlug: new Map(categories.map((c) => [c.slug, c.id])),
    existingByKey: await loadExistingProducts(rows, origin),
    changedBy,
  };
}

/**
 * Mirror a remote image into our storage (folder "products") and register
 * it in the media library. Non-fatal by design: any failure — unreachable
 * host, non-image response, oversize file — keeps the original URL so the
 * row still imports.
 */
export async function mirrorProductImage(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) return url; // already a local /uploads path
  if (url.includes(".blob.vercel-storage.com")) return url; // already ours

  try {
    const response = await safeFetch(url, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return url;
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim();
    if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
      return url;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MIRROR_MAX_BYTES) return url;

    const ext = ACCEPTED_UPLOAD_TYPES[contentType] ?? ".jpg";
    const base =
      slugify(
        decodeURIComponent(
          new URL(url).pathname.split("/").pop() ?? "",
        ).replace(/\.[^.]+$/, ""),
      ) || "import";
    const stored = await putFile(buffer, {
      pathname: `products/${base}${ext}`,
      contentType,
    });

    // Best effort — the mirrored file is useful even if the library row fails.
    await db.media
      .create({
        data: {
          url: stored.url,
          pathname: stored.pathname,
          type: "IMAGE",
          folder: "products",
          bytes: buffer.length,
        },
      })
      .catch((error) => {
        console.error(`Media row failed for ${stored.pathname}:`, error);
      });

    return stored.url;
  } catch (error) {
    console.error(`Image mirror failed for ${url}:`, error);
    return url;
  }
}

type CustomFieldType =
  | "SELECT"
  | "TEXT"
  | "SWATCH"
  | "SIZE"
  | "NUMBER"
  | "FILE";

function parseCustomFields(row: Record<string, string>): {
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  order: number;
}[] {
  const fields = [];
  for (let i = 1; i <= CUSTOM_FIELD_SLOTS; i += 1) {
    const label = row[`custom${i}_label`]?.trim();
    if (!label) continue;
    fields.push({
      label,
      type: (row[`custom${i}_type`]?.trim().toUpperCase() ??
        "TEXT") as CustomFieldType,
      options: splitList(row[`custom${i}_options`]),
      required: parseBool(row[`custom${i}_required`]) ?? false,
      order: fields.length,
    });
  }
  return fields;
}

/**
 * The scraper-origin row's twin bookkeeping — the promote path's own three
 * writes, in its order: the staged `ScrapedProduct` is marked IMPORTED and
 * pointed at the catalogue row, then its shortlist entry is confirmed (the
 * import IS the human confirmation — the owner uploaded the file). Both
 * tolerate a missing twin: the file may come from another environment, or
 * the staged rows may have been purged, and a catalogue row is still the
 * right outcome.
 */
async function markScrapedTwinImported(
  row: Record<string, string>,
  productId: string,
  changedBy: string | null,
): Promise<void> {
  const sourceKey = row.source_key.trim();
  const externalId = row.external_id.trim();
  await db.scrapedProduct.updateMany({
    where: { sourceKey, externalId },
    data: { reviewStatus: "IMPORTED", importedProductId: productId },
  });
  await markImportedConfirmed({ sourceKey, externalId }, changedBy);
}

export async function importProductRow(
  row: Record<string, string>,
  ctx: ProductImportContext,
  overwriteOwnerEdited: boolean,
): Promise<ProductRowOutcome> {
  const scraped = ctx.origin === "scraper";
  const slug = row.slug.trim();
  const categoryId = ctx.categoryIdBySlug.get(row.category_slug.trim());
  if (!categoryId) throw new Error(`Unknown category ${row.category_slug}`);

  const key = identityKey("products", row, ctx.origin);
  const existing = key ? (ctx.existingByKey.get(key) ?? null) : null;

  // A catalog-fill twin (`sheet:<key>`) is the fill's own row — PUBLISHED,
  // from one of the owner's import lists. The promote path marks the staged
  // twin IMPORTED and leaves the product alone, and so does this door: a
  // supplier's export must neither rewrite nor demote it, whatever the
  // overwrite box says (that box is about OWNER-edited rows).
  if (scraped && existing?.importSource?.startsWith("sheet:")) {
    await markScrapedTwinImported(row, existing.id, ctx.changedBy);
    return "protected";
  }

  // H5, extended from the sheet importer and the scraper's promote path to
  // Bulk Import: an owner-edited row is never silently overwritten by a
  // stale export re-run through this screen. `previewImport` computed and
  // showed the same verdict before the operator confirmed, and
  // `overwriteOwnerEdited` is their explicit "yes, replace it anyway".
  const tier0 = intOrNull(row.tier);
  const inStock0 = parseBool(row.in_stock);
  const verdict = decideMerge(
    existing
      ? {
          ownerTouched: existing.ownerTouched,
          needsRewrite: existing.needsRewrite,
        }
      : null,
  );
  if (!overwriteOwnerEdited && existing) {
    // Only OWNERSHIP protects a row here, which is the same gate tier-fill
    // applies. `decideMerge`'s other guard verdict, "skip", means "already
    // rewritten, the SCRAPE has nothing new to say" — a judgement about a
    // re-scrape of a supplier's page. This importer's incoming row is the
    // owner's own upload, so reading "skip" as "protected" made Bulk
    // Import — one of the three sanctioned ways to fill the catalogue
    // (HARD RULE 3) — refuse to update almost every existing product,
    // reporting them as protected rather than written. A scraper export
    // uploaded here is the owner's decision too, and the preview said
    // "update" for the row; it follows the same rule.
    if (verdict === "refresh-availability") {
      if (inStock0 !== null) {
        await db.product.update({
          where: { id: existing.id },
          data: { inStock: inStock0 },
        });
      }
      // The promote path marks the twin in its protected branch as well —
      // the product exists, the owner chose to keep it, the inbox should
      // stop offering the row.
      if (scraped)
        await markScrapedTwinImported(row, existing.id, ctx.changedBy);
      return "protected";
    }
  }

  // needsRewrite is intentionally untouched on an ORDINARY update: bulk
  // import must never silently clear the scraper's rewrite guard. A
  // scraper-origin row sets it, on create and on update, because the copy
  // being written IS scraped copy — the promote path's rule.
  //
  // tier / in_stock (audit L-AD2): validated upstream (tier 1-4 int,
  // in_stock TRUE/FALSE). An EMPTY cell is "no opinion" — omitted from the
  // write so an update never clobbers an existing tier or stock flag; on
  // create the schema defaults apply (tier null, inStock true). The remap
  // blanks `tier` for a scraper export — a scraped row came from a
  // supplier's site, not from one of the four import lists.
  const tier = tier0;
  const inStock = inStock0;
  // product_tier reads the same way: empty means "no opinion", so a re-import
  // of an older export never un-tiers a product the owner filed in the studio.
  // It is a DIFFERENT column from `tier` above — that one is where the row
  // came from, this one is what the piece is. A SUGGESTED tier (the mark the
  // validator left) is fill-only, the promote path's rule: an explicit cell
  // overwrites, a suggestion never revisits a filing the owner has made.
  const sizeTierCell = parseSizeTierCell(row.product_tier);
  const sizeTierSuggested =
    parseBool(row[PRODUCT_TIER_SUGGESTED_MARK]) === true;
  const sizeTier =
    sizeTierCell === null
      ? null
      : sizeTierSuggested && existing?.sizeTier
        ? null
        : sizeTierCell;

  const title = row.title.trim();
  const shortTagline = nullIfEmpty(row.short_tagline);
  const description = row.description?.trim() ?? "";
  // The promote path's defaults for the fields a supplier's page never
  // publishes (care notes, SEO fallbacks) — the same call it makes, so a
  // draft from either door carries the same fields. A cell the file DOES
  // carry wins over the default.
  const enriched = scraped
    ? enrichScrapedFields({
        title,
        slug,
        shortTagline,
        description,
        priceMin: intOrNull(row.price_min),
        priceMax: intOrNull(row.price_max),
        showPrice: parseBool(row.show_price),
        timeline: nullIfEmpty(row.timeline),
        materials: nullIfEmpty(row.materials),
        dimensions: nullIfEmpty(row.dimensions),
        seoTitle: nullIfEmpty(row.seo_title),
        seoDescription: nullIfEmpty(row.seo_description),
        images: [],
        imageAlts: [],
      })
    : null;

  // FORCED for a scraper export, whatever the file said: scraped copy is
  // reference material until a human rewrites it, and the rewrite guard is
  // what keeps publish refusing until then. On CREATE only — an update
  // leaves the existing status alone, the promote path's rule: a re-scrape
  // re-flags a live product for rewrite, it never takes it off the shop.
  const status = scraped ? ("DRAFT" as const) : normalizeStatus(row.status);

  const base = {
    ...(tier !== null && tier >= 1 && tier <= 4 ? { tier } : {}),
    ...(sizeTier !== null ? { sizeTier } : {}),
    ...(inStock !== null ? { inStock } : {}),
    title,
    shortTagline,
    description,
    priceMin: intOrNull(row.price_min),
    priceMax: intOrNull(row.price_max),
    showPrice: parseBool(row.show_price) ?? true,
    timeline: nullIfEmpty(row.timeline),
    materials: nullIfEmpty(row.materials),
    dimensions: nullIfEmpty(row.dimensions),
    occasions: parseOccasions(row.occasions),
    careNotes: nullIfEmpty(row.care_notes) ?? enriched?.careNotes ?? null,
    ...(scraped ? { needsRewrite: true } : {}),
    featured: parseBool(row.featured) ?? false,
    videoUrl: nullIfEmpty(row.video_url),
    model3dUrl: nullIfEmpty(row.model3d_url),
    categoryId,
    seoTitle: enriched ? enriched.seoTitle : nullIfEmpty(row.seo_title),
    seoDescription: enriched
      ? enriched.seoDescription
      : nullIfEmpty(row.seo_description),
  };

  // Mirror remote gallery images into our storage before touching the DB
  // so a slow download never sits inside the transaction.
  const images: { url: string; alt: string; order: number }[] = [];
  const gallery = buildImageList(row);
  for (const image of scraped ? gallery.slice(0, MAX_IMPORT_IMAGES) : gallery) {
    images.push({ ...image, url: await mirrorProductImage(image.url) });
  }

  const customFields = parseCustomFields(row);

  const writeChildren = async (
    tx: Prisma.TransactionClient,
    productId: string,
  ) => {
    // Replace-all strategy for both child collections — mirrors upsertProduct.
    await tx.productImage.deleteMany({ where: { productId } });
    if (images.length > 0) {
      await tx.productImage.createMany({
        data: images.map((image) => ({ ...image, productId })),
      });
    }
    await tx.customizationField.deleteMany({ where: { productId } });
    if (customFields.length > 0) {
      await tx.customizationField.createMany({
        data: customFields.map((field) => ({ ...field, productId })),
      });
    }
  };

  if (existing) {
    // Identity columns (slug, importSource, importRef) are never rewritten
    // on update — a `sheet:` twin stays the CSV fill's row, a bare-key row
    // stays the promote path's.
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: existing.id },
        data: { ...base, ...(scraped ? {} : { status }) },
      });
      await writeChildren(tx, existing.id);
    });
    if (scraped) await markScrapedTwinImported(row, existing.id, ctx.changedBy);
    return "updated";
  }

  if (!scraped) {
    await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { ...base, status, slug },
      });
      await writeChildren(tx, product.id);
    });
    return "created";
  }

  // Scraper origin, create: the slug is uniquified against the catalogue
  // (a slug collision with an unrelated product is a new product, not an
  // overwrite) and the identity pair is written the way the promote path
  // writes it. `createWithUniqueSlug` covers the race two rows in one batch
  // can run on the same candidate.
  const candidate = await uniqueSlug(slug, async (probe) =>
    Boolean(
      await db.product.findUnique({
        where: { slug: probe },
        select: { id: true },
      }),
    ),
  );
  const created = await createWithUniqueSlug(candidate, (finalSlug) =>
    db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...base,
          status,
          slug: finalSlug,
          importSource: row.source_key.trim(),
          importRef: row.external_id.trim(),
        },
        select: { id: true },
      });
      await writeChildren(tx, product.id);
      return product;
    }),
  );
  await markScrapedTwinImported(row, created.id, ctx.changedBy);
  return "created";
}
