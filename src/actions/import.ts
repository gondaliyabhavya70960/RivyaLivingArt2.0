"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  requireStaff,
  revalidatePublic,
  type ActionResult,
} from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { nullIfEmpty } from "@/lib/utils";
import { decideMerge, type MergeAction } from "@/lib/scraper/merge-policy";
import {
  fetchGoogleSheetCsv,
  ImportError,
  markdownToTiptap,
  parseCsv,
  parseXlsx,
} from "@/lib/import/parse";
import {
  buildProductImportContext,
  importProductRow,
  type ProductImportContext,
} from "@/lib/import/product-row";
import type { ImportOrigin } from "@/lib/import/scrape-export";
import {
  IMPORT_TYPE_KEYS,
  MAX_IMPORT_ROWS,
  type ImportTypeKey,
} from "@/lib/import/templates";
import {
  buildImageList,
  identityKey,
  intOrNull,
  loadExistingProducts,
  normalizeStatus,
  splitList,
  validateRows,
  type ValidatedRow,
} from "@/lib/import/validate";
import { slugify } from "@/lib/slug";
import type { Prisma } from "@/generated/prisma/client";

const BATCH_SIZE = 10;

const REVALIDATE_PATHS: Record<ImportTypeKey, string[]> = {
  products: ["/studio/products"],
  categories: ["/studio/categories"],
  "blog-posts": ["/studio/blog"],
  faqs: ["/studio/faqs"],
  testimonials: ["/studio/testimonials"],
  portfolio: ["/studio/portfolio"],
  pages: ["/studio/pages"],
};

/**
 * Public entity per import type (ENG-801). Types with no public surface
 * (pages need a per-row slug and are omitted here) skip public revalidation.
 */
const PUBLIC_ENTITY: Partial<
  Record<ImportTypeKey, Parameters<typeof revalidatePublic>[0]>
> = {
  products: "product",
  categories: "category",
  "blog-posts": "blogPost",
  faqs: "faq",
  testimonials: "testimonial",
  portfolio: "portfolio",
};

/**
 * Both import actions manage their own try/catch instead of runAction:
 * ImportError messages (private sheet, scraper-export guard, bad file)
 * are user-facing and must reach the client verbatim, which runAction's
 * generic error blurring would prevent.
 */
function toFriendlyError(
  error: unknown,
  fallback: string,
): ActionResult<never> {
  if (error instanceof ImportError) return { ok: false, error: error.message };
  console.error("Bulk import failed:", error);
  if (error instanceof Error && error.message === "Unauthorized") {
    return { ok: false, error: "You are not allowed to do that." };
  }
  return { ok: false, error: fallback };
}

// ————————————————————— Preview —————————————————————

const previewSchema = z.object({
  typeKey: z.enum(IMPORT_TYPE_KEYS),
  source: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("sheet"),
      url: z.string().trim().min(1, "Paste a Google Sheets link."),
    }),
    z.object({ kind: z.literal("file") }),
  ]),
  fileName: z.string().trim().max(300).optional(),
  fileB64: z
    .string()
    .max(11_500_000, "That file is too large — keep imports under 8 MB.")
    .optional(),
});

export type PreviewImportInput = z.input<typeof previewSchema>;

export type ImportPreview = {
  rows: ValidatedRow[];
  counts: { create: number; update: number; error: number; total: number };
  /** Rows found in the file before the cap was applied. */
  totalRows: number;
  truncated: boolean;
  /**
   * products template only: the H5 merge verdict per row (by `row.index`),
   * computed against the CURRENT catalog before anything is written — same
   * decision `import-tiers.ts`'s deploy-time fill and the scraper's promote
   * path already make, reused here rather than re-invented. `ownerEditedCount`
   * is how many rows the wizard's "will overwrite" warning names; it counts
   * "refresh-availability" verdicts (an owner-edited row) — "skip" rows
   * (already-clean, un-owner-touched) are excluded from the *warning* since
   * running the import again on them changes nothing, but their verdict is
   * still present in `verdicts` for the row-by-row display.
   */
  productMerge?: {
    verdicts: Record<number, MergeAction>;
    ownerEditedCount: number;
    /** Scraper origin only: rows whose match is the catalog fill's own
     *  `sheet:<key>` row. The writer leaves those untouched (the promote
     *  path's rule) and marks their staged twins imported; the row carries
     *  a message saying so, and this is the count the notice names. */
    sheetTwinCount: number;
  };
  /**
   * `"scraper"` when the file is a Product Scraper export read as Products
   * (`src/lib/import/scrape-export.ts`): every row lands as a draft with the
   * rewrite guard on, deduplicated on the promote path's own keys. Absent
   * for an ordinary file.
   */
  origin?: ImportOrigin;
  /** Scraper origin only — what the validator filled in, and what it could
   *  not, so the wizard can say so before the owner presses Import. */
  scrapeExport?: {
    autoMappedCategories: number;
    suggestedTiers: number;
    unmappedCategories: number;
  };
};

export async function previewImport(
  input: PreviewImportInput,
): Promise<ActionResult<ImportPreview>> {
  try {
    await requireStaff();
    const parsed = previewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid import request.",
      };
    }
    const { typeKey, source, fileName, fileB64 } = parsed.data;

    let rows: Record<string, string>[];
    if (source.kind === "sheet") {
      rows = parseCsv(await fetchGoogleSheetCsv(source.url));
    } else {
      if (!fileB64) {
        throw new ImportError("No file received — pick a .csv or .xlsx file.");
      }
      const buffer = Buffer.from(fileB64, "base64");
      rows = /\.xlsx?$/i.test(fileName ?? "")
        ? await parseXlsx(buffer)
        : parseCsv(buffer.toString("utf8"));
    }

    if (rows.length === 0) {
      throw new ImportError(
        "No data rows found — the first row must be the column headers, followed by at least one row of content.",
      );
    }

    const totalRows = rows.length;
    const truncated = totalRows > MAX_IMPORT_ROWS;
    const validation = await validateRows(
      typeKey,
      rows.slice(0, MAX_IMPORT_ROWS),
    );
    const validated = validation.rows;

    const counts = { create: 0, update: 0, error: 0, total: validated.length };
    for (const row of validated) counts[row.status] += 1;

    let productMerge: ImportPreview["productMerge"];
    if (typeKey === "products") {
      // The same lookup the writer makes — by slug for an ordinary file, by
      // the (source_key, external_id) pair for a scraper export — so the
      // verdict shown here is the verdict the run applies.
      const attempt = validated.filter((row) => row.status !== "error");
      const existingByKey = await loadExistingProducts(
        attempt.map((row) => row.data),
        validation.origin,
      );

      const verdicts: Record<number, MergeAction> = {};
      let ownerEditedCount = 0;
      let sheetTwinCount = 0;
      for (const row of attempt) {
        const key = identityKey("products", row.data, validation.origin);
        const match = key ? existingByKey.get(key) : undefined;
        const verdict = decideMerge(
          match
            ? {
                ownerTouched: match.ownerTouched,
                needsRewrite: match.needsRewrite,
              }
            : null,
        );
        verdicts[row.index] = verdict;
        // A catalog-fill twin is decided FIRST and never counted as
        // owner-edited: the writer returns "protected" for it whatever the
        // overwrite box says, so counting it would put the row under a
        // warning whose checkbox promises an action the writer refuses.
        if (
          validation.origin === "scraper" &&
          match?.importSource?.startsWith("sheet:")
        ) {
          sheetTwinCount += 1;
          row.messages.push(
            "Already in the catalogue from the catalog fill — left as it is; its staged row is marked imported.",
          );
        } else if (verdict === "refresh-availability") {
          ownerEditedCount += 1;
        }
      }
      productMerge = { verdicts, ownerEditedCount, sheetTwinCount };
    }

    return {
      ok: true,
      data: {
        rows: validated,
        counts,
        totalRows,
        truncated,
        ...(productMerge ? { productMerge } : {}),
        ...(validation.origin
          ? {
              origin: validation.origin,
              scrapeExport: {
                autoMappedCategories: validation.autoMappedCategories,
                suggestedTiers: validation.suggestedTiers,
                unmappedCategories: validation.unmappedCategories,
              },
            }
          : {}),
      },
    };
  } catch (error) {
    return toFriendlyError(
      error,
      "Could not read that file. Check the format and try again.",
    );
  }
}

// ————————————————————— Run —————————————————————

const runSchema = z.object({
  typeKey: z.enum(IMPORT_TYPE_KEYS),
  rows: z
    .array(z.record(z.string(), z.string()))
    .min(1, "Nothing to import — every row failed validation.")
    .max(
      MAX_IMPORT_ROWS,
      `Imports are capped at ${MAX_IMPORT_ROWS} rows per file.`,
    ),
  /** products only: the operator's explicit "yes, replace owner-edited rows
   *  too" — ticked after `previewImport` showed how many that is. Ignored by
   *  every other template. */
  overwriteOwnerEdited: z.boolean().optional().default(false),
});

export type RunImportInput = z.input<typeof runSchema>;

export type ImportReport = {
  created: number;
  updated: number;
  /** Rows rejected by server-side re-validation (also listed in errors). */
  skipped: number;
  /** products only: rows left alone (or refreshed availability-only)
   *  because the owner had edited them and overwriteOwnerEdited wasn't set. */
  protectedCount: number;
  errors: { row: number; message: string }[];
};

/** Shared lookups built once per import instead of once per row. */
type ImportContext = {
  categoryIdBySlug: Map<string, string>;
  blogCategoryIdBySlug: Map<string, string>;
  /** Next display order for rows that do not specify one. */
  nextOrder: number;
  /** Products only — the writer's own context (`product-row.ts`). */
  products?: ProductImportContext;
};

export async function runImport(
  input: RunImportInput,
): Promise<ActionResult<ImportReport>> {
  try {
    const session = await requireStaff();
    const parsed = runSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid import request.",
      };
    }
    const { typeKey, rows, overwriteOwnerEdited } = parsed.data;

    // Re-validate server-side — the client only echoes previewed rows,
    // but nothing stops a stale or hand-crafted payload.
    const validation = await validateRows(typeKey, rows);
    const validated = validation.rows;

    const errors: ImportReport["errors"] = [];
    let skipped = 0;
    for (const row of validated) {
      if (row.status !== "error") continue;
      skipped += 1;
      errors.push({
        row: row.index,
        message: `${rowLabel(row.data)}: ${row.messages.join("; ")}`,
      });
    }

    const attempt = validated.filter((row) => row.status !== "error");
    const ctx = await buildContext(
      typeKey,
      attempt,
      validation.origin,
      session.user.id,
    );

    let created = 0;
    let updated = 0;
    let protectedCount = 0;
    for (let start = 0; start < attempt.length; start += BATCH_SIZE) {
      const batch = attempt.slice(start, start + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((row) =>
          importRow(typeKey, row.data, ctx, overwriteOwnerEdited),
        ),
      );
      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          if (result.value === "created") created += 1;
          else if (result.value === "updated") updated += 1;
          else protectedCount += 1;
        } else {
          console.error(
            `Bulk import row ${batch[i].index} (${typeKey}) failed:`,
            result.reason,
          );
          errors.push({
            row: batch[i].index,
            message: `${rowLabel(batch[i].data)}: could not be saved${uniqueHint(result.reason)}`,
          });
        }
      });
    }

    await logActivity({
      userId: session.user.id,
      action: "bulk-import",
      entity: typeKey,
      meta: {
        created,
        updated,
        skipped,
        protectedCount,
        errors: errors.length,
        total: rows.length,
        ...(overwriteOwnerEdited ? { overwroteOwnerEdited: true } : {}),
        // A scraper export read as Products records that it was one, and
        // what the validator filled in on the way — the run's own audit of
        // how many categories and tiers were ours rather than the file's.
        ...(validation.origin
          ? {
              origin: validation.origin,
              autoMappedCategories: validation.autoMappedCategories,
              suggestedTiers: validation.suggestedTiers,
              unmappedCategories: validation.unmappedCategories,
            }
          : {}),
      },
    });
    for (const path of REVALIDATE_PATHS[typeKey]) revalidatePath(path);
    const publicEntity = PUBLIC_ENTITY[typeKey];
    if (publicEntity) revalidatePublic(publicEntity);

    return {
      ok: true,
      data: { created, updated, skipped, protectedCount, errors },
    };
  } catch (error) {
    return toFriendlyError(error, "Something went wrong. Please try again.");
  }
}

// ————————————————————— Shared row helpers —————————————————————

const rowLabel = (data: Record<string, string>) =>
  `"${data.slug || data.title || data.name || data.question || "row"}"`;

const uniqueHint = (reason: unknown) =>
  typeof reason === "object" &&
  reason !== null &&
  "code" in reason &&
  (reason as { code?: string }).code === "P2002"
    ? " — a row with the same unique value already exists"
    : "";

async function buildContext(
  typeKey: ImportTypeKey,
  rows: ValidatedRow[],
  origin: ImportOrigin | undefined,
  changedBy: string | null,
): Promise<ImportContext> {
  const ctx: ImportContext = {
    categoryIdBySlug: new Map(),
    blogCategoryIdBySlug: new Map(),
    nextOrder: 0,
  };

  if (typeKey === "products") {
    ctx.products = await buildProductImportContext(
      rows.map((row) => row.data),
      origin,
      changedBy,
    );
  }

  if (typeKey === "portfolio") {
    const categories = await db.category.findMany({
      select: { id: true, slug: true },
    });
    ctx.categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  }

  if (typeKey === "blog-posts") {
    // Pre-create every referenced blog category and tag ONCE (skipping
    // duplicates) — concurrent per-row connectOrCreate would race on the
    // unique slug when several rows share a new tag.
    const categoryBySlug = new Map<string, string>();
    const tagBySlug = new Map<string, string>();
    for (const row of rows) {
      const category = row.data.category?.trim();
      if (category)
        categoryBySlug.set(slugify(category) || "category", category);
      for (const tag of splitList(row.data.tags)) {
        tagBySlug.set(slugify(tag) || "tag", tag);
      }
    }
    if (categoryBySlug.size > 0) {
      await db.blogCategory.createMany({
        data: [...categoryBySlug].map(([slug, name]) => ({ slug, name })),
        skipDuplicates: true,
      });
    }
    if (tagBySlug.size > 0) {
      await db.tag.createMany({
        data: [...tagBySlug].map(([slug, name]) => ({ slug, name })),
        skipDuplicates: true,
      });
    }
    const blogCategories = await db.blogCategory.findMany({
      select: { id: true, slug: true },
    });
    ctx.blogCategoryIdBySlug = new Map(
      blogCategories.map((c) => [c.slug, c.id]),
    );
  }

  if (
    typeKey === "categories" ||
    typeKey === "faqs" ||
    typeKey === "testimonials"
  ) {
    // Rows without an explicit order append after existing content — the
    // same behaviour as creating items one by one in the studio.
    const agg =
      typeKey === "categories"
        ? await db.category.aggregate({ _max: { order: true } })
        : typeKey === "faqs"
          ? await db.faq.aggregate({ _max: { order: true } })
          : await db.testimonial.aggregate({ _max: { order: true } });
    ctx.nextOrder = (agg._max.order ?? -1) + 1;
  }

  return ctx;
}

function importRow(
  typeKey: ImportTypeKey,
  row: Record<string, string>,
  ctx: ImportContext,
  overwriteOwnerEdited: boolean,
): Promise<"created" | "updated" | "protected"> {
  switch (typeKey) {
    case "products":
      if (!ctx.products) throw new Error("Product import context missing.");
      return importProductRow(row, ctx.products, overwriteOwnerEdited);
    case "categories":
      return importCategoryRow(row, ctx);
    case "blog-posts":
      return importBlogPostRow(row, ctx);
    case "faqs":
      return importFaqRow(row, ctx);
    case "testimonials":
      return importTestimonialRow(row, ctx);
    case "portfolio":
      return importPortfolioRow(row, ctx);
    case "pages":
      return importPageRow(row);
  }
}

// ————————————————————— Per-type importers —————————————————————

async function importCategoryRow(
  row: Record<string, string>,
  ctx: ImportContext,
): Promise<"created" | "updated"> {
  const slug = row.slug.trim();
  const data = {
    name: row.name.trim(),
    description: nullIfEmpty(row.description),
    image: nullIfEmpty(row.image),
  };
  const order = intOrNull(row.order);

  const existing = await db.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    await db.category.update({
      where: { id: existing.id },
      data: { ...data, ...(order !== null ? { order } : {}) },
    });
    return "updated";
  }
  await db.category.create({
    data: { ...data, slug, order: order ?? ctx.nextOrder++ },
  });
  return "created";
}

async function importBlogPostRow(
  row: Record<string, string>,
  ctx: ImportContext,
): Promise<"created" | "updated"> {
  const slug = row.slug.trim();
  const content = (await markdownToTiptap(
    row.content ?? "",
  )) as Prisma.InputJsonValue;

  const status = normalizeStatus(row.status);
  let publishedAt = row.published_at?.trim()
    ? new Date(row.published_at.trim())
    : null;
  if (status === "PUBLISHED" && !publishedAt) publishedAt = new Date();

  const categoryName = row.category?.trim();
  const blogCategoryId = categoryName
    ? (ctx.blogCategoryIdBySlug.get(slugify(categoryName) || "category") ??
      null)
    : null;
  const tagSlugs = [
    ...new Set(splitList(row.tags).map((tag) => slugify(tag) || "tag")),
  ];

  const base = {
    title: row.title.trim(),
    excerpt: row.excerpt?.trim() ?? "",
    content,
    coverImage: nullIfEmpty(row.cover_image),
    authorName: row.author_name?.trim() || "Rivya Living Art Studio",
    blogCategoryId,
    status,
    publishedAt,
    seoTitle: nullIfEmpty(row.seo_title),
    seoDescription: nullIfEmpty(row.seo_description),
  };

  const existing = await db.blogPost.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    // The row is the source of truth — tags are replaced, not merged.
    await db.blogPost.update({
      where: { id: existing.id },
      data: {
        ...base,
        tags: { set: tagSlugs.map((tagSlug) => ({ slug: tagSlug })) },
      },
    });
    return "updated";
  }
  await db.blogPost.create({
    data: {
      ...base,
      slug,
      tags: { connect: tagSlugs.map((tagSlug) => ({ slug: tagSlug })) },
    },
  });
  return "created";
}

async function importFaqRow(
  row: Record<string, string>,
  ctx: ImportContext,
): Promise<"created" | "updated"> {
  const question = row.question.trim();
  const order = intOrNull(row.order);

  const existing = await db.faq.findFirst({
    where: { question: { equals: question, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    await db.faq.update({
      where: { id: existing.id },
      data: {
        question,
        answer: row.answer.trim(),
        ...(order !== null ? { order } : {}),
      },
    });
    return "updated";
  }
  await db.faq.create({
    data: {
      question,
      answer: row.answer.trim(),
      order: order ?? ctx.nextOrder++,
    },
  });
  return "created";
}

async function importTestimonialRow(
  row: Record<string, string>,
  ctx: ImportContext,
): Promise<"created" | "updated"> {
  const name = row.name.trim();
  const quote = row.quote.trim();
  const rating = intOrNull(row.rating);
  const order = intOrNull(row.order);

  // Only a recognised value is ever written — a blank or malformed cell
  // leaves an existing row's permission untouched on update, and defaults to
  // UNKNOWN (the schema's own default) on create.
  const PERMISSION_VALUES = [
    "UNKNOWN",
    "REQUESTED",
    "GRANTED",
    "DECLINED",
  ] as const;
  const permissionRaw = row.permission_status?.trim().toUpperCase();
  const permissionStatus = PERMISSION_VALUES.find((v) => v === permissionRaw);

  // A slug that does not resolve to a real product is left alone rather than
  // clearing any link the row already has — a typo in one cell of a 500-row
  // sheet must not silently unlink a testimonial from its piece.
  const productSlug = row.product_slug?.trim();
  const linkedProduct = productSlug
    ? await db.product.findUnique({
        where: { slug: productSlug },
        select: { id: true },
      })
    : null;

  const data = {
    location: nullIfEmpty(row.location),
    avatarUrl: nullIfEmpty(row.avatar_url),
    designation: nullIfEmpty(row.designation),
    ...(permissionStatus ? { permissionStatus } : {}),
    ...(linkedProduct ? { productId: linkedProduct.id } : {}),
  };

  const existing = await db.testimonial.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      quote: { equals: quote, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) {
    await db.testimonial.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(rating !== null ? { rating } : {}),
        ...(order !== null ? { order } : {}),
      },
    });
    return "updated";
  }
  // Imported testimonials arrive as drafts — a bulk sheet of quotes has not
  // been through the review pipeline `describeTestimonialProblem` polices
  // (permission included), so nothing an import writes reaches the
  // storefront until a human opens the row.
  await db.testimonial.create({
    data: {
      ...data,
      name,
      quote,
      rating: rating ?? 5,
      order: order ?? ctx.nextOrder++,
      status: "DRAFT",
      permissionStatus: permissionStatus ?? "UNKNOWN",
    },
  });
  return "created";
}

async function importPortfolioRow(
  row: Record<string, string>,
  ctx: ImportContext,
): Promise<"created" | "updated"> {
  const slug = row.slug.trim();

  const resultsMeta: Record<string, string> = {};
  for (const [key, column] of [
    ["type", "meta_type"],
    ["material", "meta_material"],
    ["size", "meta_size"],
    ["timeline", "meta_timeline"],
  ] as const) {
    const value = row[column]?.trim();
    if (value) resultsMeta[key] = value;
  }

  const categorySlug = row.category_slug?.trim();
  const base = {
    title: row.title.trim(),
    story: row.story?.trim() ?? "",
    beforeImageUrl: nullIfEmpty(row.before_image_url),
    afterImageUrl: nullIfEmpty(row.after_image_url),
    videoUrl: nullIfEmpty(row.video_url),
    resultsMeta,
    categoryId: categorySlug
      ? (ctx.categoryIdBySlug.get(categorySlug) ?? null)
      : null,
    status: normalizeStatus(row.status),
  };
  const images = buildImageList(row);

  const existing = await db.portfolio.findUnique({
    where: { slug },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    const portfolio = existing
      ? await tx.portfolio.update({ where: { id: existing.id }, data: base })
      : await tx.portfolio.create({ data: { ...base, slug } });

    await tx.portfolioImage.deleteMany({
      where: { portfolioId: portfolio.id },
    });
    if (images.length > 0) {
      await tx.portfolioImage.createMany({
        data: images.map((image) => ({ ...image, portfolioId: portfolio.id })),
      });
    }
  });

  return existing ? "updated" : "created";
}

async function importPageRow(
  row: Record<string, string>,
): Promise<"created" | "updated"> {
  const slug = row.slug.trim();
  const data = {
    title: row.title.trim(),
    content: (await markdownToTiptap(
      row.content ?? "",
    )) as Prisma.InputJsonValue,
    seoTitle: nullIfEmpty(row.seo_title),
    seoDescription: nullIfEmpty(row.seo_description),
  };

  const existing = await db.page.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    await db.page.update({ where: { id: existing.id }, data });
    return "updated";
  }
  await db.page.create({ data: { ...data, slug } });
  return "created";
}
