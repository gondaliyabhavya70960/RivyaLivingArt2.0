"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { PRODUCT_LIMITS } from "@/lib/studio-limits";
import {
  type ProductSizeTier,
  describeSizeTierPublishProblem,
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_NAME,
} from "@/lib/product-size-tier";
import { db } from "@/lib/db";
import { CATALOG_NAV_TAG } from "@/lib/catalog-nav";
import { SHOP_FIRST_PAGE_TAG } from "@/lib/shop";
import { nullIfEmpty } from "@/lib/utils";
import { normalizeTranslations, TRANSLATABLE_FIELDS } from "@/lib/localize";
import {
  requireStaff,
  revalidatePublic,
  runAction,
  type ActionResult,
} from "@/actions/helpers";
import { logActivity, snapshotBefore } from "@/lib/activity";
import {
  applySizeTierBackfill,
  planSizeTierBackfill,
  summarizeSizeTierPlan,
} from "@/lib/catalog-size-tier-backfill";
import { deleteFile } from "@/lib/storage";
import { findMediaUsages } from "@/lib/media-usages";
import { createWithUniqueSlug, uniqueSlug } from "@/lib/slug";
import { OCCASIONS } from "@/components/studio/products/occasions";
import {
  describeConfirmBlockers,
  describeConfirmRefusal,
} from "@/lib/scraper/confirm";
import {
  buildProductWhere,
  productListFilterSchema,
  type ProductListFilter,
} from "@/components/studio/products/product-filter";
import {
  CONTENT_STATUSES,
  type ContentStatusValue,
} from "@/lib/content-status";

const optionalUrl = z
  .union([z.literal(""), z.url("Enter a valid URL.")])
  .optional();

const PRODUCT_IMAGE_ROLES = ["HERO", "DETAIL", "IN_ROOM", "PROCESS"] as const;

const imageSchema = z.object({
  url: z.string().min(1),
  alt: z.string().max(PRODUCT_LIMITS.imageAlt).default(""),
  order: z.number().int().nonnegative(),
  /** What the shot is FOR (11: MediaSection's per-image role select) —
   *  optional, so an unset image behaves exactly as it always has. */
  role: z.enum(PRODUCT_IMAGE_ROLES).nullable().optional(),
});

const customFieldSchema = z.object({
  label: z.string().trim().min(1, "Every customization field needs a label."),
  type: z.enum(["SELECT", "TEXT", "SWATCH", "SIZE", "NUMBER", "FILE"]),
  options: z.array(z.string().trim().min(1)).default([]),
  required: z.boolean().default(false),
  helpText: z.string().max(PRODUCT_LIMITS.customFieldHelpText).optional(),
  order: z.number().int().nonnegative(),
});

const upsertProductSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: z
      .string()
      .trim()
      .min(PRODUCT_LIMITS.titleMin, "Title needs at least 2 characters."),
    displayName: z.string().max(PRODUCT_LIMITS.displayName).optional(),
    shortTagline: z.string().max(PRODUCT_LIMITS.shortTagline).optional(),
    description: z.string().optional(),
    priceMin: z.number().int().nonnegative().nullable().optional(),
    priceMax: z.number().int().nonnegative().nullable().optional(),
    showPrice: z.boolean(),
    inStock: z.boolean().default(true),
    tier: z
      .number()
      .int()
      .min(PRODUCT_LIMITS.tierMin)
      .max(PRODUCT_LIMITS.tierMax)
      .nullable()
      .default(null),
    // The owner's size architecture — a different column from `tier` above,
    // which is import provenance. Nullable: three writers create products
    // without passing this form, so the studio enforces it at PUBLISH.
    sizeTier: z.enum(PRODUCT_SIZE_TIERS).nullable().default(null),
    timeline: z.string().max(PRODUCT_LIMITS.timeline).optional(),
    materials: z.string().max(PRODUCT_LIMITS.materials).optional(),
    dimensions: z.string().max(PRODUCT_LIMITS.dimensions).optional(),
    occasions: z.array(z.enum(OCCASIONS)).default([]),
    lexical: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(PRODUCT_LIMITS.lexicalLabel),
          value: z.string().trim().min(1).max(PRODUCT_LIMITS.lexicalValue),
        }),
      )
      .max(PRODUCT_LIMITS.lexicalRows)
      .default([]),
    madeWithIds: z
      .array(z.string().min(1))
      .max(PRODUCT_LIMITS.madeWithRows)
      .default([]),
    careNotes: z.string().optional(),
    categoryId: z.string().min(1, "Pick a category."),
    featured: z.boolean(),
    videoUrl: optionalUrl,
    model3dUrl: optionalUrl,
    seoTitle: z.string().max(PRODUCT_LIMITS.seoTitle).optional(),
    seoDescription: z.string().max(PRODUCT_LIMITS.seoDescription).optional(),
    ogImage: optionalUrl,
    translations: z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .optional(),
    status: z.enum(CONTENT_STATUSES),
    confirmRewrite: z.boolean(),
    images: z.array(imageSchema).default([]),
    customFields: z.array(customFieldSchema).default([]),
  })
  .refine(
    (d) => d.priceMin == null || d.priceMax == null || d.priceMin <= d.priceMax,
    {
      message: "Minimum price cannot exceed maximum price.",
      path: ["priceMax"],
    },
  );

export type UpsertProductInput = z.input<typeof upsertProductSchema>;

/**
 * Product search for the provenance-link picker (gap 3). Staff-only; small
 * page of title matches with tier for the picker's ecosystem label.
 */
export async function searchProductsForLink(
  q: string,
): Promise<ActionResult<{ id: string; title: string; tier: number | null }[]>> {
  return runAction(async () => {
    await requireStaff();
    const query = z.string().trim().min(1).max(120).parse(q);
    return db.product.findMany({
      where: { title: { contains: query, mode: "insensitive" } },
      orderBy: [{ status: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: { id: true, title: true, tier: true },
    });
  });
}

/**
 * Product search for a landing page's product grid.
 *
 * Returns SLUGS, not ids: `productGridSchema.slugs` is what the block stores
 * and what the storefront resolves by, and slugs are minted once and never
 * change here. It also returns the first image and the publish status, because
 * an owner picks a piece by recognising the photograph — and a grid quietly
 * full of drafts renders empty on the live page.
 */
/**
 * The pieces a grid block already holds, by slug.
 *
 * Without this the picker opens on raw slugs — the very thing it replaced —
 * because only a product returned by a search this session has a title and a
 * photograph to show. A slug whose product was deleted or renamed simply comes
 * back missing, and the picker keeps showing it: that row is the owner's
 * evidence that the grid is about to render short.
 */
export async function productsForGridBySlugs(slugs: string[]): Promise<
  ActionResult<
    {
      slug: string;
      title: string;
      image: string | null;
      published: boolean;
    }[]
  >
> {
  return runAction(async () => {
    await requireStaff();
    const wanted = z.array(z.string().trim().max(200)).max(60).parse(slugs);
    if (wanted.length === 0) return [];
    const rows = await db.product.findMany({
      where: { slug: { in: wanted } },
      select: {
        slug: true,
        title: true,
        status: true,
        images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
      },
    });
    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      image: r.images[0]?.url ?? null,
      published: r.status === "PUBLISHED",
    }));
  });
}

export async function searchProductsForGrid(q: string): Promise<
  ActionResult<
    {
      slug: string;
      title: string;
      image: string | null;
      published: boolean;
    }[]
  >
> {
  return runAction(async () => {
    await requireStaff();
    const query = z.string().trim().max(120).parse(q);
    const rows = await db.product.findMany({
      where: query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
            ],
          }
        : {},
      // Published first, then the owner's curated picks — the same order the
      // storefront's "featured" sort uses, so the picker opens on the pieces
      // most likely to be wanted.
      orderBy: [
        { status: "desc" },
        { featured: "desc" },
        { createdAt: "desc" },
      ],
      take: 20,
      select: {
        slug: true,
        title: true,
        status: true,
        images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
      },
    });
    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      image: r.images[0]?.url ?? null,
      published: r.status === "PUBLISHED",
    }));
  });
}

export async function upsertProduct(
  input: UpsertProductInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const session = await requireStaff();

  const parsed = upsertProductSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid product data.",
    };
  }
  const data = parsed.data;

  const category = await db.category.findUnique({
    where: { id: data.categoryId },
    select: { id: true },
  });
  if (!category) {
    return { ok: false, error: "The selected category no longer exists." };
  }

  const existing = data.id
    ? await db.product.findUnique({ where: { id: data.id } })
    : null;
  if (data.id && !existing) {
    return {
      ok: false,
      error: "Product not found — it may have been deleted.",
    };
  }

  // PUBLISH GUARD — scraped reference content must be rewritten first.
  if (
    existing?.needsRewrite &&
    data.status === "PUBLISHED" &&
    !data.confirmRewrite
  ) {
    return {
      ok: false,
      error:
        "This product still contains scraped reference content. Confirm the rewrite before publishing.",
    };
  }

  // PUBLISH GUARD — nothing NEW reaches the storefront without a size tier.
  // Scoped to the transition rather than the state on purpose: the column is
  // new, so the whole existing catalogue is untiered, and refusing every save
  // of an already-published row would lock the owner out of editing any of it.
  const sizeTierProblem = describeSizeTierPublishProblem({
    nextStatus: data.status,
    currentStatus: existing?.status ?? null,
    sizeTier: data.sizeTier,
  });
  if (sizeTierProblem) return { ok: false, error: sizeTierProblem };

  // Prune per-locale overrides to known locales + translatable fields; an empty
  // result writes SQL NULL so the column stays clean (public site unchanged).
  const normalizedTranslations = normalizeTranslations(
    data.translations,
    TRANSLATABLE_FIELDS.product,
  );
  const translationsWrite: Prisma.InputJsonValue | typeof Prisma.DbNull =
    normalizedTranslations === null
      ? Prisma.DbNull
      : (normalizedTranslations as Prisma.InputJsonValue);

  return runAction(async () => {
    const base = {
      title: data.title,
      displayName: nullIfEmpty(data.displayName),
      shortTagline: nullIfEmpty(data.shortTagline),
      description: data.description ?? "",
      priceMin: data.priceMin ?? null,
      priceMax: data.priceMax ?? null,
      showPrice: data.showPrice,
      inStock: data.inStock,
      tier: data.tier,
      sizeTier: data.sizeTier,
      timeline: nullIfEmpty(data.timeline),
      materials: nullIfEmpty(data.materials),
      dimensions: nullIfEmpty(data.dimensions),
      occasions: data.occasions,
      lexical: data.lexical,
      // H5: every studio save marks the row owner-touched — sheet re-imports
      // and scraper promotions then refresh availability only. The timestamp
      // answers the question the boolean cannot: which side edited last.
      ownerTouched: true,
      studioEditedAt: new Date(),
      careNotes: nullIfEmpty(data.careNotes),
      categoryId: data.categoryId,
      featured: data.featured,
      videoUrl: nullIfEmpty(data.videoUrl),
      model3dUrl: nullIfEmpty(data.model3dUrl),
      seoTitle: nullIfEmpty(data.seoTitle),
      seoDescription: nullIfEmpty(data.seoDescription),
      ogImage: nullIfEmpty(data.ogImage),
      translations: translationsWrite,
      status: data.status,
      // Confirming the rewrite clears the flag; otherwise keep whatever
      // the scraper set (new manual products are never flagged).
      needsRewrite: data.confirmRewrite
        ? false
        : (existing?.needsRewrite ?? false),
    };

    // Slug is minted once on create and never changes on edit.
    const slug = existing
      ? existing.slug
      : await uniqueSlug(data.title, async (candidate) =>
          Boolean(
            await db.product.findUnique({
              where: { slug: candidate },
              select: { id: true },
            }),
          ),
        );

    const product = await createWithUniqueSlug(slug, (candidateSlug) =>
      db.$transaction(async (tx) => {
        // Gap 3 provenance: the picker's list replaces the link set wholesale
        // (`set` on update, `connect` on create — `set` is update-only in
        // Prisma's nested writes); a row can never link itself.
        const linkIds = data.madeWithIds.filter((id) => id !== existing?.id);
        const row = existing
          ? await tx.product.update({
              where: { id: existing.id },
              data: {
                ...base,
                madeWith: { set: linkIds.map((id) => ({ id })) },
              },
            })
          : await tx.product.create({
              data: {
                ...base,
                slug: candidateSlug,
                madeWith: { connect: linkIds.map((id) => ({ id })) },
              },
            });

        // Replace-all strategy for both child collections.
        await tx.productImage.deleteMany({ where: { productId: row.id } });
        if (data.images.length > 0) {
          await tx.productImage.createMany({
            data: data.images.map((img, i) => ({
              productId: row.id,
              url: img.url,
              alt: img.alt,
              order: img.order ?? i,
              role: img.role ?? null,
            })),
          });
        }

        await tx.customizationField.deleteMany({
          where: { productId: row.id },
        });
        if (data.customFields.length > 0) {
          await tx.customizationField.createMany({
            data: data.customFields.map((field, i) => ({
              productId: row.id,
              label: field.label,
              type: field.type,
              options: field.options,
              required: field.required,
              helpText: nullIfEmpty(field.helpText),
              order: field.order ?? i,
            })),
          });
        }

        return row;
      }),
    );

    await logActivity({
      userId: session.user.id,
      action: existing ? "update" : "create",
      entity: "Product",
      entityId: product.id,
      meta: {
        title: product.title,
        status: product.status,
        rewriteConfirmed: data.confirmRewrite || undefined,
        // The before-picture six smaller entities already record, on the one
        // with 4,385 rows — where an accidental edit is most expensive and
        // hardest to spot. Only on an update: a create has no before.
        before: existing
          ? snapshotBefore(existing, [
              "title",
              "status",
              "priceMin",
              "priceMax",
              "shortTagline",
              "inStock",
              "featured",
            ])
          : undefined,
      },
    });

    revalidatePath("/studio/products");
    revalidatePath(`/studio/products/${product.id}`);
    revalidatePublic("product", product.slug);
    // PDPs run revalidate=86400 now — a save must invalidate the cached page
    // on demand (revalidatePublic's slug path misses the locale segment).
    revalidatePath("/[locale]/product/[slug]", "page");
    // Publish state changes move mega-menu counts and the cached /shop
    // first page (M-P4/M-P5).
    revalidateTag(CATALOG_NAV_TAG, "max");
    revalidateTag(SHOP_FIRST_PAGE_TAG, "max");
    // (create / status or category change moves the mega-menu counts).

    return { id: product.id, slug: product.slug };
  });
}

const idsSchema = z
  .array(z.string().min(1))
  .min(1, "Select at least one product.");

/**
 * Bulk actions accept either explicit row ids (page-scoped selection) or the
 * list page's CURRENT validated filter ("select all N matching" — audit
 * L-AD1). A filter is re-validated with the same schema the list page uses
 * and turned into a where clause SERVER-SIDE — a raw Prisma `where` from the
 * client is never accepted — then resolved to concrete ids so downstream
 * logic (rewrite guard, DeletedImport tombstones, activity counts) is
 * identical for both shapes.
 */
export type BulkProductTarget = string[] | { filter: ProductListFilter };

const targetSchema = z.union([
  idsSchema,
  z.object({ filter: productListFilterSchema }),
]);

async function resolveTargetIds(
  target: BulkProductTarget,
): Promise<{ ids: string[] } | { error: string }> {
  if (Array.isArray(target) && target.length === 0) {
    return { error: "Select at least one product." };
  }
  const parsed = targetSchema.safeParse(target);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }
  if (Array.isArray(parsed.data)) return { ids: parsed.data };

  const rows = await db.product.findMany({
    where: buildProductWhere(parsed.data.filter),
    select: { id: true },
  });
  if (rows.length === 0) {
    return { error: "No products match the current filter." };
  }
  return { ids: rows.map((row) => row.id) };
}

export async function setProductsStatus(
  target: BulkProductTarget,
  status: ContentStatusValue,
): Promise<
  ActionResult<{
    updated: number;
    skippedRewrite: number;
    skippedUntiered: number;
  }>
> {
  const session = await requireStaff();

  const parsedStatus = z.enum(CONTENT_STATUSES).safeParse(status);
  if (!parsedStatus.success) {
    return { ok: false, error: "Invalid request." };
  }
  const resolved = await resolveTargetIds(target);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  return runAction(async () => {
    let targetIds = resolved.ids;
    let skippedRewrite = 0;
    let skippedUntiered = 0;

    if (parsedStatus.data === "PUBLISHED") {
      // Scraped reference content is never bulk-published silently.
      const blocked = await db.product.findMany({
        where: { id: { in: targetIds }, needsRewrite: true },
        select: { id: true },
      });
      const blockedIds = new Set(blocked.map((p) => p.id));
      skippedRewrite = blockedIds.size;
      targetIds = targetIds.filter((id) => !blockedIds.has(id));

      // The same publish guard the single-product form applies, and scoped the
      // same way — `status: { not: "PUBLISHED" }` makes this the TRANSITION,
      // not the state. A row that is already live stays live: this action is
      // also how the owner re-publishes a batch, and refusing that would make
      // a new column retroactively unpublish the catalogue.
      const untiered = await db.product.findMany({
        where: {
          id: { in: targetIds },
          sizeTier: null,
          status: { not: "PUBLISHED" },
        },
        select: { id: true },
      });
      const untieredIds = new Set(untiered.map((p) => p.id));
      skippedUntiered = untieredIds.size;
      targetIds = targetIds.filter((id) => !untieredIds.has(id));
    }

    const updated =
      targetIds.length > 0
        ? (
            await db.product.updateMany({
              where: { id: { in: targetIds } },
              data: { status: parsedStatus.data },
            })
          ).count
        : 0;

    await logActivity({
      userId: session.user.id,
      action: parsedStatus.data === "PUBLISHED" ? "publish" : "unpublish",
      entity: "Product",
      meta: { count: updated, skippedRewrite, skippedUntiered },
    });

    revalidatePath("/studio/products");
    revalidatePublic("product");
    // PDPs run revalidate=86400 now — bulk status flips must invalidate the
    // cached pages on demand, not wait out the day-long ISR window.
    revalidatePath("/[locale]/product/[slug]", "page");
    // Publish state changes move mega-menu counts and the cached /shop
    // first page (M-P4/M-P5).
    revalidateTag(CATALOG_NAV_TAG, "max");
    revalidateTag(SHOP_FIRST_PAGE_TAG, "max");
    // (publish/unpublish changes the mega-menu per-category counts).
    return { updated, skippedRewrite, skippedUntiered };
  });
}

export async function deleteProducts(
  target: BulkProductTarget,
): Promise<ActionResult<{ deleted: number }>> {
  const session = await requireStaff();

  // Filter targets resolve to concrete ids FIRST so the tombstone snapshot
  // below covers every matched row, exactly as with an explicit selection.
  const resolved = await resolveTargetIds(target);
  if ("error" in resolved) return { ok: false, error: resolved.error };
  const targetIds = resolved.ids;

  return runAction(async () => {
    // Snapshot gallery urls before the cascade wipes ProductImage rows.
    const images = await db.productImage.findMany({
      where: { productId: { in: targetIds } },
      select: { url: true },
    });
    const urls = [...new Set(images.map((img) => img.url))];

    // Tombstone imported rows BEFORE deleting (audit H5): the deploy-time
    // sheet import honors DeletedImport pairs, so an owner deletion is
    // permanent instead of silently resurrecting on the next import run.
    const imported = await db.product.findMany({
      where: {
        id: { in: targetIds },
        importSource: { not: null },
        importRef: { not: null },
      },
      select: { importSource: true, importRef: true },
    });
    if (imported.length > 0) {
      await db.deletedImport.createMany({
        data: imported.map((p) => ({
          importSource: p.importSource!,
          importRef: p.importRef!,
        })),
        skipDuplicates: true,
      });
    }

    const [{ count: deleted }] = await db.$transaction([
      db.product.deleteMany({ where: { id: { in: targetIds } } }),
    ]);

    // Best-effort storage + Media cleanup, guarded like deleteMediaItems: only
    // remove files no OTHER content still references — a URL reused as a
    // category cover, a testimonial avatar, or another product/portfolio's
    // media must survive this delete (ENG-806/UIUX-605). Batched instead of a
    // per-URL round-trip. A failed file delete must not undo the product delete.
    let imagesCleaned = 0;
    if (urls.length > 0) {
      const inUse = await findMediaUsages(urls);
      const orphaned = await db.media.findMany({
        where: { url: { in: urls.filter((url) => !inUse.has(url)) } },
        select: { id: true, pathname: true },
      });
      for (const media of orphaned) {
        await deleteFile(media.pathname).catch((error) => {
          console.error(`Storage delete failed for ${media.pathname}:`, error);
        });
      }
      if (orphaned.length > 0) {
        await db.media.deleteMany({
          where: { id: { in: orphaned.map((m) => m.id) } },
        });
      }
      imagesCleaned = orphaned.length;
    }

    await logActivity({
      userId: session.user.id,
      action: "bulk-delete",
      entity: "Product",
      meta: { count: deleted, imagesCleaned },
    });

    revalidatePath("/studio/products");
    revalidatePublic("product");
    // PDPs run revalidate=86400 now — deletes must drop the cached pages on
    // demand so a removed product 404s instead of serving for a day.
    revalidatePath("/[locale]/product/[slug]", "page");
    // Publish state changes move mega-menu counts and the cached /shop
    // first page (M-P4/M-P5).
    revalidateTag(CATALOG_NAV_TAG, "max");
    revalidateTag(SHOP_FIRST_PAGE_TAG, "max");
    // (deletes change the mega-menu per-category counts).
    return { deleted };
  });
}

/**
 * Bulk "Change category" (audit M-A4): re-files the selected products —
 * or every product matching the current list filter — under an existing
 * category. The sheet import's keyword mapper misfiles at 4.4k scale
 * ("Baby Bandana Bibs" → Printer Parts & Tools); this is the cleanup tool.
 */
export async function setProductsCategory(
  target: BulkProductTarget,
  categoryId: string,
): Promise<ActionResult<{ updated: number }>> {
  const session = await requireStaff();

  const parsedCategory = z.string().min(1).safeParse(categoryId);
  if (!parsedCategory.success) {
    return { ok: false, error: "Invalid request." };
  }
  const resolved = await resolveTargetIds(target);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  const category = await db.category.findUnique({
    where: { id: parsedCategory.data },
    select: { id: true, name: true },
  });
  if (!category) {
    return { ok: false, error: "The selected category no longer exists." };
  }

  return runAction(async () => {
    const { count: updated } = await db.product.updateMany({
      where: { id: { in: resolved.ids } },
      data: { categoryId: category.id },
    });

    await logActivity({
      userId: session.user.id,
      action: "bulk-recategorize",
      entity: "Product",
      meta: {
        count: updated,
        categoryId: category.id,
        categoryName: category.name,
      },
    });

    revalidatePath("/studio/products");
    revalidatePublic("product");
    // PDPs run revalidate=86400 now — a category move changes breadcrumbs,
    // related shelves and canonical placement, so invalidate on demand.
    revalidatePath("/[locale]/product/[slug]", "page");
    // Publish state changes move mega-menu counts and the cached /shop
    // first page (M-P4/M-P5).
    revalidateTag(CATALOG_NAV_TAG, "max");
    revalidateTag(SHOP_FIRST_PAGE_TAG, "max");
    // (re-filing products changes the mega-menu per-category counts).
    return { updated };
  });
}

/**
 * Bulk "Set product tier" — the tool that makes the size taxonomy reachable
 * on a catalogue that already has ~4,385 rows in it.
 *
 * THE FORM ALONE WOULD NOT HAVE BEEN ENOUGH. `Product.sizeTier` shipped
 * nullable because three writers create products without passing the studio
 * form, so the backlog is not an edge case — on the day the column landed it
 * was the entire catalogue. Tiering it one product at a time is not a job an
 * owner does; pairing this with the list's "No tier yet" filter is what turns
 * it into one pass per tier.
 *
 * Deliberately NOT clearable. A "— none" option here would let one misclick
 * un-tier a filtered selection of thousands, and the single-product form
 * already offers it for the one row where it is a real correction.
 */
export async function setProductsSizeTier(
  target: BulkProductTarget,
  sizeTier: string,
): Promise<ActionResult<{ updated: number }>> {
  const session = await requireStaff();

  const parsedTier = z.enum(PRODUCT_SIZE_TIERS).safeParse(sizeTier);
  if (!parsedTier.success) {
    return { ok: false, error: "Invalid request." };
  }
  const resolved = await resolveTargetIds(target);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  return runAction(async () => {
    const { count: updated } = await db.product.updateMany({
      where: { id: { in: resolved.ids } },
      data: { sizeTier: parsedTier.data },
    });

    await logActivity({
      userId: session.user.id,
      action: "bulk-size-tier",
      entity: "Product",
      meta: {
        count: updated,
        sizeTier: parsedTier.data,
        sizeTierName: SIZE_TIER_NAME[parsedTier.data],
      },
    });

    revalidateSizeTierReaders();
    return { updated };
  });
}

/**
 * Everything on the public site that branches on `sizeTier` since docs/plan/07
 * steps 7–8: the PDP's per-tier order presets, the shop's ?sizeTier= facet
 * and its cached first page, and the large-format band's collectible cards.
 * The Studio list and the content-gaps backlog card read it too.
 */
function revalidateSizeTierReaders() {
  revalidatePath("/studio/products");
  revalidatePath("/studio/content-gaps");
  revalidatePath("/[locale]/product/[slug]", "page");
  revalidatePath("/[locale]/large-resin-art", "page");
  revalidateTag(SHOP_FIRST_PAGE_TAG, "max");
}

export type SizeTierSuggestionReport = {
  scanned: number;
  total: number;
  byTier: Record<ProductSizeTier, number>;
  skipped: { supplies: number; unsure: number };
  samples: Record<ProductSizeTier, string[]>;
};

/**
 * The untiered backlog, filed by rule — docs/plan/07 step 3 for a catalogue
 * of ~4,400. `preview` reads and decides without writing, so the Studio can
 * show the counts and sample titles first; `apply` writes exactly that plan
 * (re-checking `sizeTier IS NULL` per row) and records one ActivityLog row.
 * The rule — supplies and workshops never, a person's edited rows never, the
 * category's own tier, a decisive word in the row outranking it — lives in
 * `src/lib/catalog-size-tier.ts`; the same plan runs on every production
 * deploy from `prisma/suggest-size-tiers.ts`.
 */
export async function suggestSizeTiersForBacklog(
  mode: "preview" | "apply",
): Promise<ActionResult<SizeTierSuggestionReport>> {
  const session = await requireStaff();
  return runAction(async () => {
    const plan = await planSizeTierBackfill(db);
    const summary = summarizeSizeTierPlan(plan);
    const report: SizeTierSuggestionReport = {
      scanned: plan.scanned,
      total: summary.total,
      byTier: summary.byTier,
      skipped: plan.skipped,
      samples: plan.samples,
    };
    if (mode === "preview") return report;

    const result = await applySizeTierBackfill(db, plan, {
      actorId: session.user.id,
      source: "studio",
    });
    revalidateSizeTierReaders();
    return { ...report, total: result.total, byTier: result.updated };
  });
}

export async function toggleFeatured(
  id: string,
  featured: boolean,
): Promise<ActionResult<{ featured: boolean }>> {
  const session = await requireStaff();

  const parsed = z
    .object({ id: z.string().min(1), featured: z.boolean() })
    .safeParse({ id, featured });
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }

  return runAction(async () => {
    const product = await db.product.update({
      where: { id: parsed.data.id },
      data: { featured: parsed.data.featured },
      select: { id: true, featured: true, title: true },
    });

    await logActivity({
      userId: session.user.id,
      action: product.featured ? "feature" : "unfeature",
      entity: "Product",
      entityId: product.id,
      meta: { title: product.title },
    });

    revalidatePath("/studio/products");
    revalidatePublic("product");
    return { featured: product.featured };
  });
}

/* ————————————————— Confirmation (the final list) ————————————————— */

export type ConfirmReport = {
  confirmed: number;
  /** Rows refused, each with the reason naming the missing fields. */
  refused: { title: string; reason: string }[];
};

/**
 * Bless a SELECTION for the final list.
 *
 * This is the only thing in the codebase that sets `confirmedAt`. There is no
 * path from scraping, importing or editing that reaches it — the invariant is
 * that a human chose each row.
 *
 * Refusals are per-row and named. A batch where three products lack images
 * confirms the rest and reports those three, rather than failing the whole
 * press and leaving the operator to guess which ones.
 */
export async function confirmProducts(
  target: BulkProductTarget,
): Promise<ActionResult<ConfirmReport>> {
  return runAction(async () => {
    const session = await requireStaff();
    // Same target contract as every other bulk action: an explicit id list, or
    // "everything matching the current filter". Confirmation must honour
    // "select filtered" like its siblings — but every row it touches is still
    // checked individually below, so a filter cannot wave anything through.
    const resolved = await resolveTargetIds(target);
    if ("error" in resolved) throw new Error(resolved.error);

    const rows = await db.product.findMany({
      where: { id: { in: resolved.ids } },
      select: {
        id: true,
        title: true,
        description: true,
        showPrice: true,
        priceMin: true,
        needsRewrite: true,
        _count: { select: { images: true } },
      },
    });

    const ready: string[] = [];
    const refused: { title: string; reason: string }[] = [];
    for (const row of rows) {
      const blockers = describeConfirmBlockers({
        title: row.title,
        description: row.description,
        showPrice: row.showPrice,
        priceMin: row.priceMin,
        needsRewrite: row.needsRewrite,
        imageCount: row._count.images,
      });
      const refusal = describeConfirmRefusal(row.title, blockers);
      if (refusal) refused.push({ title: row.title, reason: refusal });
      else ready.push(row.id);
    }

    if (ready.length > 0) {
      await db.product.updateMany({
        where: { id: { in: ready } },
        data: { confirmedAt: new Date(), confirmedById: session.user.id },
      });
      await logActivity({
        userId: session.user.id,
        action: "confirm",
        entity: "Product",
        meta: { count: ready.length, refused: refused.length },
      });
      revalidatePath("/studio/products");
    }

    return { confirmed: ready.length, refused };
  });
}

/**
 * Take a product back off the final list.
 *
 * Clears the blessing; it does NOT delete the product, its history, or the
 * activity record of the confirmation. Unconfirming is a correction, not an
 * erasure.
 */
export async function unconfirmProducts(
  target: BulkProductTarget,
): Promise<ActionResult<{ unconfirmed: number }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const resolved = await resolveTargetIds(target);
    if ("error" in resolved) throw new Error(resolved.error);

    const res = await db.product.updateMany({
      where: { id: { in: resolved.ids }, confirmedAt: { not: null } },
      data: { confirmedAt: null, confirmedById: null },
    });

    await logActivity({
      userId: session.user.id,
      action: "unconfirm",
      entity: "Product",
      meta: { count: res.count },
    });
    revalidatePath("/studio/products");
    return { unconfirmed: res.count };
  });
}
