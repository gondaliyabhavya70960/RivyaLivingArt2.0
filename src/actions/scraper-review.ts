"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { enrichScrapedFields } from "@/lib/scraper/product-enrich";
import { decideMerge } from "@/lib/scraper/merge-policy";
import {
  PRODUCT_SIZE_TIERS,
  type ProductSizeTier,
} from "@/lib/product-size-tier";
import { markImportedConfirmed } from "@/lib/scraper/shortlist-write";
import { SCRAPER_UA } from "@/lib/scraper/types";
import { safeFetch } from "@/lib/scraper/ssrf";
import { createWithUniqueSlug, slugify, uniqueSlug } from "@/lib/slug";
import { MAX_IMPORT_IMAGES } from "@/lib/import/product-row";
import { putFile } from "@/lib/storage";

const REVIEW_PATH = "/studio/scraper/review";
const PRODUCTS_PATH = "/studio/products";

/** Only the leading gallery images are imported/mirrored per product — the
 *  cap lives in `product-row.ts` now, shared with Bulk Import's
 *  scraper-origin path so the two doors cannot drift. */
const MIRROR_TIMEOUT_MS = 12_000;
/** Matches the media library cap. */
const MIRROR_MAX_BYTES = 8 * 1024 * 1024;

/** Content-type → extension (ACCEPTED_UPLOAD_TYPES-like, images only). */
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// ————————————————————— Inline edit of a staged row —————————————————————

const editSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Title is required.").max(300),
  shortTagline: z.string().trim().max(500).nullable(),
  category: z.string().trim().max(200).nullable(),
  priceMin: z.number().int().nonnegative().nullable(),
  priceMax: z.number().int().nonnegative().nullable(),
});

export type EditStagedInput = z.input<typeof editSchema>;

/**
 * Edit a staged product before import (title / tagline / category / price
 * range). Curating here means the imported draft starts from cleaner data.
 * Already-imported rows are locked.
 */
export async function updateStagedProduct(
  input: EditStagedInput,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const session = await requireStaff();
    const p = editSchema.parse(input);

    const row = await db.scrapedProduct.findUnique({
      where: { id: p.id },
      select: { reviewStatus: true },
    });
    if (!row) throw new Error("That staged product no longer exists.");
    if (row.reviewStatus === "IMPORTED") {
      throw new Error("This item is already imported and can't be edited.");
    }

    await db.scrapedProduct.update({
      where: { id: p.id },
      data: {
        title: p.title,
        shortTagline: p.shortTagline || null,
        category: p.category || null,
        priceMin: p.priceMin,
        priceMax: p.priceMax,
      },
    });
    await logActivity({
      userId: session.user.id,
      action: "edit",
      entity: "ScrapedProduct",
      entityId: p.id,
    });
    revalidatePath(REVIEW_PATH);
  });
}

// ————————————————————— Import → DRAFT products —————————————————————

// Reviewer notes moved to ShortlistEntry with the B7 inbox rebuild — see
// setShortlistNote in actions/scraper-shortlist.ts. ScrapedProduct.notes
// stays in the schema (the backfill carried its contents forward); it is
// simply no longer edited from the Studio.

export type ImportScrapedReport = {
  /** Newly created draft products. */
  imported: number;
  /** Existing (still-uncurated) products refreshed via the import keys. */
  updated: number;
  /** Not APPROVED / gone, or an already-curated product left untouched. */
  skipped: number;
  /**
   * Rows whose catalog product the owner had edited. Counted separately from
   * `skipped` on purpose: "we left your work alone" and "there was nothing to
   * do" look identical in a total, and only one of them is worth telling
   * somebody about.
   */
  protected: number;
  errors: { title: string; message: string }[];
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Mirror one scraped image into our storage (folder "products") and
 * register it in the media library. Non-fatal by design: any failure —
 * unreachable host, oversize file, storage error — falls back to the
 * ORIGINAL source URL so the import never fails on images.
 */
async function mirrorScrapedImage(
  sourceUrl: string,
  slug: string,
  index: number,
): Promise<string> {
  try {
    // safeFetch enforces the SSRF guard on the scraped image URL and each
    // redirect hop (SEC-107).
    const response = await safeFetch(sourceUrl, {
      headers: { "user-agent": SCRAPER_UA },
      signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
    });
    if (!response.ok) return sourceUrl;

    const declaredLength = response.headers.get("content-length");
    if (declaredLength && Number(declaredLength) > MIRROR_MAX_BYTES) {
      return sourceUrl;
    }

    const contentType =
      (response.headers.get("content-type") ?? "").split(";")[0].trim() ||
      "image/jpeg";
    // Only mirror actual images — a scraped host returning html/svg must not
    // be stored under an image content type (SEC-104 residual).
    if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
      return sourceUrl;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MIRROR_MAX_BYTES) {
      return sourceUrl;
    }

    const ext = IMAGE_EXTENSIONS[contentType] ?? ".jpg";
    const stored = await putFile(buffer, {
      pathname: `products/${slug}-${index}${ext}`,
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
    console.error(`Scraped image mirror failed for ${sourceUrl}:`, error);
    return sourceUrl;
  }
}

/** A staged product row as loaded from the DB. */
type StagedRow = Awaited<ReturnType<typeof db.scrapedProduct.findMany>>[number];

/**
 * Import ONE approved staging row into a DRAFT product in `categoryId`,
 * filling missing fields with smart defaults (care notes, SEO, occasions).
 * Idempotent by (importSource, importRef): re-importing updates an uncurated
 * draft in place; an already-curated product (needsRewrite cleared) is left
 * untouched. Returns what happened so the caller can tally.
 */
async function importOneScrapedRow(
  row: StagedRow,
  categoryId: string,
  mirrorImages: boolean,
  changedBy: string | null,
  /** The operator's product tier for the draft (docs/plan/07 step 6). A
   *  null never writes: empty means "no opinion", the rule Bulk Import
   *  already follows, so a re-import can never un-tier a product. */
  sizeTier: ProductSizeTier | null = null,
): Promise<"created" | "updated" | "skipped" | "protected"> {
  // Every path below that marks the twin IMPORTED also confirms its
  // shortlist entry (B7): IMPORTED→CONFIRMED is the backfill's mapping,
  // applied going forward. The import IS the human confirmation — the owner
  // clicked it.
  const confirmImported = () =>
    markImportedConfirmed(
      { sourceKey: row.sourceKey, externalId: row.externalId },
      changedBy,
    );
  const importSource = row.sourceKey;
  const importRef = row.externalId;

  const existing =
    importSource && importRef
      ? await db.product.findUnique({
          where: { importSource_importRef: { importSource, importRef } },
          select: {
            id: true,
            needsRewrite: true,
            ownerTouched: true,
            sizeTier: true,
          },
        })
      : null;

  // Cross-pipeline dedupe (audit H6): the deploy-time sheet import stores the
  // same source under `sheet:<key>` — approving a re-scraped row for a source
  // that is already live via the sheet would create a duplicate product under
  // the bare key. Treat the sheet row as the live product and mark imported.
  if (!existing && importSource && importRef) {
    const sheetTwin = await db.product.findUnique({
      where: {
        importSource_importRef: {
          importSource: `sheet:${importSource}`,
          importRef,
        },
      },
      select: { id: true },
    });
    if (sheetTwin) {
      await db.scrapedProduct.update({
        where: { id: row.id },
        data: { reviewStatus: "IMPORTED", importedProductId: sheetTwin.id },
      });
      await confirmImported();
      return "skipped";
    }
  }

  // H5, applied to the scraper path as well as the sheet importer. An owner
  // edit outranks everything: the scrape refreshes availability and leaves the
  // content and the gallery exactly as the owner left them.
  //
  // This used to read `needsRewrite` alone, which is not the same question. A
  // studio save sets ownerTouched but only clears needsRewrite when the
  // operator ticks "confirm rewrite" — and most edits are not rewrites. So an
  // edited-but-still-flagged product fell through to the update below, which
  // overwrites the copy AND deletes every image before recreating them from
  // the source.
  const action = decideMerge(existing);
  if (existing && action === "refresh-availability") {
    await db.product.update({
      where: { id: existing.id },
      data: { inStock: row.status !== "out_of_stock" },
    });
    await db.scrapedProduct.update({
      where: { id: row.id },
      data: { reviewStatus: "IMPORTED", importedProductId: existing.id },
    });
    await confirmImported();
    return "protected";
  }
  if (existing && action === "skip") {
    await db.scrapedProduct.update({
      where: { id: row.id },
      data: { reviewStatus: "IMPORTED", importedProductId: existing.id },
    });
    await confirmImported();
    return "skipped";
  }

  const imageAlts = toStringArray(row.imageAlts);
  const sourceUrls = toStringArray(row.images).slice(0, MAX_IMPORT_IMAGES);
  const folderSlug = slugify(row.slug || row.title);

  // Mirror sequentially BEFORE the DB write so slow downloads never sit inside
  // a transaction; failures keep the original URL.
  let urls = sourceUrls;
  if (mirrorImages) {
    urls = [];
    for (let i = 0; i < sourceUrls.length; i++) {
      urls.push(await mirrorScrapedImage(sourceUrls[i], folderSlug, i));
    }
  }
  const imageCreate = urls.map((url, i) => ({
    url,
    alt: imageAlts[i] ?? row.title,
    order: i,
  }));

  // Scraped fields + shared smart defaults (care notes, SEO, show-price) so the
  // imported draft carries every field the bulk uploader expects. Still DRAFT +
  // needsRewrite — reference material until rewritten as original copy.
  const productData = {
    title: row.title,
    ...enrichScrapedFields(row),
  };

  if (existing) {
    await db.productImage.deleteMany({ where: { productId: existing.id } });
    const product = await db.product.update({
      where: { id: existing.id },
      data: {
        ...productData,
        needsRewrite: true,
        categoryId,
        // Fill only: an uncurated draft that somehow carries a tier (a Bulk
        // Import column, an earlier import) keeps it. This branch overwrites
        // copy and images because decideMerge said nobody edited them; a
        // tier is a filing decision and a non-null one is never revisited
        // by a re-scrape.
        ...(sizeTier && !existing.sizeTier ? { sizeTier } : {}),
        images: { create: imageCreate },
      },
      select: { id: true },
    });
    await db.scrapedProduct.update({
      where: { id: row.id },
      data: { reviewStatus: "IMPORTED", importedProductId: product.id },
    });
    await confirmImported();
    return "updated";
  }

  const slug = await uniqueSlug(
    row.slug || slugify(row.title),
    async (candidate) =>
      Boolean(
        await db.product.findUnique({
          where: { slug: candidate },
          select: { id: true },
        }),
      ),
  );
  const product = await createWithUniqueSlug(slug, (candidateSlug) =>
    db.product.create({
      data: {
        ...productData,
        slug: candidateSlug,
        occasions: [],
        status: "DRAFT",
        needsRewrite: true,
        importSource,
        importRef,
        categoryId,
        ...(sizeTier ? { sizeTier } : {}),
        images: { create: imageCreate },
      },
      select: { id: true },
    }),
  );
  await db.scrapedProduct.update({
    where: { id: row.id },
    data: { reviewStatus: "IMPORTED", importedProductId: product.id },
  });
  await confirmImported();
  return "created";
}

// ————————————————————— Add to catalog (per-product category) —————————————————————

const addToCatalogSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        categoryId: z.string().min(1),
        // The list's suggestion or the operator's pick; omitted or null
        // leaves the draft untiered for the publish guard to ask about.
        sizeTier: z.enum(PRODUCT_SIZE_TIERS).nullable().default(null),
      }),
    )
    .min(1, "Select at least one product."),
  mirrorImages: z.boolean(),
});

export type AddScrapedToCatalogInput = z.input<typeof addToCatalogSchema>;

/**
 * Approve + import a selection of staged products, EACH into its own catalog
 * category (auto-mapped or operator-picked in the source-detail list). Rows
 * whose category is missing/unknown are skipped. DRAFT + needsRewrite always.
 */
export async function addScrapedToCatalog(
  input: AddScrapedToCatalogInput,
): Promise<ActionResult<ImportScrapedReport>> {
  return runAction<ImportScrapedReport>(async () => {
    const session = await requireStaff();
    const parsed = addToCatalogSchema.parse(input);

    const wantIds = [...new Set(parsed.items.map((i) => i.categoryId))];
    const validCats = await db.category.findMany({
      where: { id: { in: wantIds } },
      select: { id: true, slug: true },
    });
    const slugByCat = new Map(validCats.map((c) => [c.id, c.slug]));
    const catByRow = new Map(parsed.items.map((i) => [i.id, i.categoryId]));
    const tierByRow = new Map(parsed.items.map((i) => [i.id, i.sizeTier]));
    const ids = parsed.items.map((i) => i.id);

    // Approve everything selected (unless already imported) so it all imports.
    await db.scrapedProduct.updateMany({
      where: { id: { in: ids }, reviewStatus: { not: "IMPORTED" } },
      data: { reviewStatus: "APPROVED" },
    });

    const rows = await db.scrapedProduct.findMany({
      where: { id: { in: ids }, reviewStatus: "APPROVED" },
    });

    let skipped = new Set(ids).size - rows.length;
    let imported = 0;
    let updated = 0;
    let protectedCount = 0;
    const errors: ImportScrapedReport["errors"] = [];

    for (const row of rows) {
      const categoryId = catByRow.get(row.id);
      const categorySlug = categoryId ? slugByCat.get(categoryId) : undefined;
      if (!categoryId || !categorySlug) {
        skipped += 1;
        continue;
      }
      try {
        const outcome = await importOneScrapedRow(
          row,
          categoryId,
          parsed.mirrorImages,
          session.user.id,
          tierByRow.get(row.id) ?? null,
        );
        if (outcome === "created") imported += 1;
        else if (outcome === "updated") updated += 1;
        else if (outcome === "protected") protectedCount += 1;
        else skipped += 1;
      } catch (error) {
        console.error(`Add-to-catalog failed for "${row.title}":`, error);
        errors.push({
          title: row.title,
          message:
            error instanceof Error
              ? error.message
              : "Import failed unexpectedly.",
        });
      }
    }

    await logActivity({
      userId: session.user.id,
      action: "scraper-add-catalog",
      entity: "Product",
      entityId: null,
      meta: { imported, updated, skipped },
    });
    revalidatePath(REVIEW_PATH);
    revalidatePath(PRODUCTS_PATH);

    return { imported, updated, skipped, protected: protectedCount, errors };
  });
}
