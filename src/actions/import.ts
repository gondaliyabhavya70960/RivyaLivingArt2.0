"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, revalidatePublic, type ActionResult } from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { nullIfEmpty } from "@/lib/utils";
import { safeFetch } from "@/lib/scraper/ssrf";
import {
  fetchGoogleSheetCsv,
  ImportError,
  markdownToTiptap,
  parseCsv,
  parseXlsx,
} from "@/lib/import/parse";
import {
  IMPORT_TYPE_KEYS,
  MAX_IMPORT_ROWS,
  CUSTOM_FIELD_SLOTS,
  type ImportTypeKey,
} from "@/lib/import/templates";
import {
  intOrNull,
  normalizeStatus,
  parseBool,
  parseOccasions,
  splitList,
  validateRows,
  type ValidatedRow,
} from "@/lib/import/validate";
import { slugify } from "@/lib/slug";
import { ACCEPTED_UPLOAD_TYPES, putFile } from "@/lib/storage";
import type { Prisma } from "@/generated/prisma/client";

const BATCH_SIZE = 10;
const MIRROR_MAX_BYTES = 8 * 1024 * 1024; // matches the media library cap

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
function toFriendlyError(error: unknown, fallback: string): ActionResult<never> {
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
    const validated = await validateRows(
      typeKey,
      rows.slice(0, MAX_IMPORT_ROWS),
    );

    const counts = { create: 0, update: 0, error: 0, total: validated.length };
    for (const row of validated) counts[row.status] += 1;

    return { ok: true, data: { rows: validated, counts, totalRows, truncated } };
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
    .max(MAX_IMPORT_ROWS, `Imports are capped at ${MAX_IMPORT_ROWS} rows per file.`),
});

export type RunImportInput = z.input<typeof runSchema>;

export type ImportReport = {
  created: number;
  updated: number;
  /** Rows rejected by server-side re-validation (also listed in errors). */
  skipped: number;
  errors: { row: number; message: string }[];
};

/** Shared lookups built once per import instead of once per row. */
type ImportContext = {
  categoryIdBySlug: Map<string, string>;
  blogCategoryIdBySlug: Map<string, string>;
  /** Next display order for rows that do not specify one. */
  nextOrder: number;
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
    const { typeKey, rows } = parsed.data;

    // Re-validate server-side — the client only echoes previewed rows,
    // but nothing stops a stale or hand-crafted payload.
    const validated = await validateRows(typeKey, rows);

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
    const ctx = await buildContext(typeKey, attempt);

    let created = 0;
    let updated = 0;
    for (let start = 0; start < attempt.length; start += BATCH_SIZE) {
      const batch = attempt.slice(start, start + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((row) => importRow(typeKey, row.data, ctx)),
      );
      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          if (result.value === "created") created += 1;
          else updated += 1;
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
        errors: errors.length,
        total: rows.length,
      },
    });
    for (const path of REVALIDATE_PATHS[typeKey]) revalidatePath(path);
    const publicEntity = PUBLIC_ENTITY[typeKey];
    if (publicEntity) revalidatePublic(publicEntity);

    return { ok: true, data: { created, updated, skipped, errors } };
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
): Promise<ImportContext> {
  const ctx: ImportContext = {
    categoryIdBySlug: new Map(),
    blogCategoryIdBySlug: new Map(),
    nextOrder: 0,
  };

  if (typeKey === "products" || typeKey === "portfolio") {
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
      if (category) categoryBySlug.set(slugify(category) || "category", category);
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
): Promise<"created" | "updated"> {
  switch (typeKey) {
    case "products":
      return importProductRow(row, ctx);
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

function buildImageList(
  row: Record<string, string>,
): { url: string; alt: string; order: number }[] {
  const urls = splitList(row.images);
  const alts = splitList(row.image_alts);
  return urls.map((url, i) => ({ url, alt: alts[i] ?? "", order: i }));
}

/**
 * Mirror a remote image into our storage (folder "products") and register
 * it in the media library. Non-fatal by design: any failure — unreachable
 * host, non-image response, oversize file — keeps the original URL so the
 * row still imports.
 */
async function mirrorProductImage(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) return url; // already a local /uploads path
  if (url.includes(".blob.vercel-storage.com")) return url; // already ours

  try {
    const response = await safeFetch(url, { signal: AbortSignal.timeout(20_000) });
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
        decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "").replace(
          /\.[^.]+$/,
          "",
        ),
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

function parseCustomFields(row: Record<string, string>): {
  label: string;
  type: "SELECT" | "TEXT" | "SWATCH" | "SIZE" | "NUMBER" | "FILE";
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
      type: (row[`custom${i}_type`]?.trim().toUpperCase() ?? "TEXT") as
        | "SELECT"
        | "TEXT"
        | "SWATCH"
        | "SIZE"
        | "NUMBER"
        | "FILE",
      options: splitList(row[`custom${i}_options`]),
      required: parseBool(row[`custom${i}_required`]) ?? false,
      order: fields.length,
    });
  }
  return fields;
}

async function importProductRow(
  row: Record<string, string>,
  ctx: ImportContext,
): Promise<"created" | "updated"> {
  const slug = row.slug.trim();
  const categoryId = ctx.categoryIdBySlug.get(row.category_slug.trim());
  if (!categoryId) throw new Error(`Unknown category ${row.category_slug}`);

  // needsRewrite is intentionally untouched on update: bulk import must
  // never silently clear the scraper's rewrite guard.
  //
  // tier / in_stock (audit L-AD2): validated upstream (tier 1-4 int,
  // in_stock TRUE/FALSE). An EMPTY cell is "no opinion" — omitted from the
  // write so an update never clobbers an existing tier or stock flag; on
  // create the schema defaults apply (tier null, inStock true).
  const tier = intOrNull(row.tier);
  const inStock = parseBool(row.in_stock);
  const base = {
    ...(tier !== null && tier >= 1 && tier <= 4 ? { tier } : {}),
    ...(inStock !== null ? { inStock } : {}),
    title: row.title.trim(),
    shortTagline: nullIfEmpty(row.short_tagline),
    description: row.description?.trim() ?? "",
    priceMin: intOrNull(row.price_min),
    priceMax: intOrNull(row.price_max),
    showPrice: parseBool(row.show_price) ?? true,
    timeline: nullIfEmpty(row.timeline),
    materials: nullIfEmpty(row.materials),
    dimensions: nullIfEmpty(row.dimensions),
    occasions: parseOccasions(row.occasions),
    careNotes: nullIfEmpty(row.care_notes),
    status: normalizeStatus(row.status),
    featured: parseBool(row.featured) ?? false,
    videoUrl: nullIfEmpty(row.video_url),
    model3dUrl: nullIfEmpty(row.model3d_url),
    categoryId,
    seoTitle: nullIfEmpty(row.seo_title),
    seoDescription: nullIfEmpty(row.seo_description),
  };

  // Mirror remote gallery images into our storage before touching the DB
  // so a slow download never sits inside the transaction.
  const images: { url: string; alt: string; order: number }[] = [];
  const sources = buildImageList(row);
  for (const image of sources) {
    images.push({ ...image, url: await mirrorProductImage(image.url) });
  }

  const customFields = parseCustomFields(row);

  const existing = await db.product.findUnique({
    where: { slug },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    const product = existing
      ? await tx.product.update({ where: { id: existing.id }, data: base })
      : await tx.product.create({ data: { ...base, slug } });

    // Replace-all strategy for both child collections — mirrors upsertProduct.
    await tx.productImage.deleteMany({ where: { productId: product.id } });
    if (images.length > 0) {
      await tx.productImage.createMany({
        data: images.map((image) => ({ ...image, productId: product.id })),
      });
    }

    await tx.customizationField.deleteMany({ where: { productId: product.id } });
    if (customFields.length > 0) {
      await tx.customizationField.createMany({
        data: customFields.map((field) => ({ ...field, productId: product.id })),
      });
    }
  });

  return existing ? "updated" : "created";
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
    ? (ctx.blogCategoryIdBySlug.get(slugify(categoryName) || "category") ?? null)
    : null;
  const tagSlugs = [
    ...new Set(splitList(row.tags).map((tag) => slugify(tag) || "tag")),
  ];

  const base = {
    title: row.title.trim(),
    excerpt: row.excerpt?.trim() ?? "",
    content,
    coverImage: nullIfEmpty(row.cover_image),
    authorName: row.author_name?.trim() || "ResinRiva Studio",
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
    data: { question, answer: row.answer.trim(), order: order ?? ctx.nextOrder++ },
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
  const data = {
    location: nullIfEmpty(row.location),
    avatarUrl: nullIfEmpty(row.avatar_url),
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
  await db.testimonial.create({
    data: {
      ...data,
      name,
      quote,
      rating: rating ?? 5,
      order: order ?? ctx.nextOrder++,
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

    await tx.portfolioImage.deleteMany({ where: { portfolioId: portfolio.id } });
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
    content: (await markdownToTiptap(row.content ?? "")) as Prisma.InputJsonValue,
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
