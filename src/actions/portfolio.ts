"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import {
  PORTFOLIO_LIMITS,
  YEAR_MESSAGE,
  YEAR_PATTERN,
} from "@/lib/studio-limits";
import { db } from "@/lib/db";
import { nullIfEmpty } from "@/lib/utils";
import { normalizeTranslations, TRANSLATABLE_FIELDS } from "@/lib/localize";
import {
  requireStaff,
  revalidatePublic,
  runAction,
  type ActionResult,
} from "@/actions/helpers";
import { logActivity, snapshotBefore } from "@/lib/activity";
import { deleteFile } from "@/lib/storage";
import { findMediaUsages } from "@/lib/media-usages";
import { uniqueSlug } from "@/lib/slug";
import {
  CONTENT_STATUSES,
  type ContentStatusValue,
} from "@/lib/content-status";

const STUDIO_PATH = "/studio/portfolio";

const optionalUrl = z
  .union([z.literal(""), z.url("Enter a valid URL.")])
  .optional();

const imageSchema = z.object({
  url: z.string().min(1),
  alt: z.string().max(PORTFOLIO_LIMITS.imageAlt).default(""),
  /// What this frame shows, in the owner's words — printed beside the plate
  /// number on the piece's page. Empty is stored as NULL, not "".
  caption: z.string().max(PORTFOLIO_LIMITS.imageCaption).default(""),
  /// Per-locale { caption }. The gallery is written replace-all, so these
  /// travel with the row on every save or they would be dropped by it.
  translations: z.unknown().optional(),
  order: z.number().int().nonnegative(),
});

/** ADM-style case study meta — free-text, all optional. */
const resultsMetaSchema = z.object({
  type: z.string().max(PORTFOLIO_LIMITS.metaText).optional(),
  material: z.string().max(PORTFOLIO_LIMITS.metaText).optional(),
  size: z.string().max(PORTFOLIO_LIMITS.metaText).optional(),
  timeline: z.string().max(PORTFOLIO_LIMITS.metaText).optional(),
  technique: z.string().max(PORTFOLIO_LIMITS.metaText).optional(),
  complexity: z.string().max(PORTFOLIO_LIMITS.metaComplexity).optional(),
  /** Quiet hairline chips on the public case page. */
  tags: z
    .array(z.string().trim().min(1).max(PORTFOLIO_LIMITS.metaTag))
    .max(PORTFOLIO_LIMITS.metaTags)
    .optional(),
});

const upsertPortfolioSchema = z.object({
  id: z.string().min(1).optional(),
  title: z
    .string()
    .trim()
    .min(PORTFOLIO_LIMITS.titleMin, "Title needs at least 2 characters."),
  story: z.string(),
  brief: z.string().optional(),
  process: z.string().optional(),
  clientNote: z.string().optional(),
  location: z.string().max(PORTFOLIO_LIMITS.location).optional(),
  year: z
    .union([z.literal(""), z.string().regex(YEAR_PATTERN, YEAR_MESSAGE)])
    .optional(),
  beforeImageUrl: optionalUrl,
  afterImageUrl: optionalUrl,
  videoUrl: optionalUrl,
  resultsMeta: resultsMetaSchema,
  categoryId: z.string().min(1).nullable().optional(),
  status: z.enum(CONTENT_STATUSES),
  translations: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
  images: z.array(imageSchema).default([]),
});

export type UpsertPortfolioInput = z.input<typeof upsertPortfolioSchema>;

/** Drop empty/whitespace values so the stored JSON only has real entries. */
const cleanResultsMeta = (
  meta: z.infer<typeof resultsMetaSchema>,
): Record<string, string | string[]> => {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (Array.isArray(value)) {
      const tags = value.map((t) => t.trim()).filter(Boolean);
      if (tags.length) out[key] = tags;
      continue;
    }
    const trimmed = value?.trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
};

export async function upsertPortfolio(
  input: UpsertPortfolioInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const session = await requireStaff();

  const parsed = upsertPortfolioSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid portfolio data.",
    };
  }
  const data = parsed.data;

  if (data.categoryId) {
    const category = await db.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!category) {
      return { ok: false, error: "The selected category no longer exists." };
    }
  }

  const existing = data.id
    ? await db.portfolio.findUnique({ where: { id: data.id } })
    : null;
  if (data.id && !existing) {
    return {
      ok: false,
      error: "Portfolio piece not found — it may have been deleted.",
    };
  }

  // Prune per-locale overrides to known locales + translatable fields; an empty
  // result writes SQL NULL so the column stays clean (public site unchanged).
  const normalizedTranslations = normalizeTranslations(
    data.translations,
    TRANSLATABLE_FIELDS.portfolio,
  );
  const translationsWrite: Prisma.InputJsonValue | typeof Prisma.DbNull =
    normalizedTranslations === null
      ? Prisma.DbNull
      : (normalizedTranslations as Prisma.InputJsonValue);

  return runAction(async () => {
    const base = {
      title: data.title,
      story: data.story,
      brief: nullIfEmpty(data.brief ?? ""),
      process: nullIfEmpty(data.process ?? ""),
      clientNote: nullIfEmpty(data.clientNote ?? ""),
      location: nullIfEmpty(data.location ?? ""),
      year: data.year ? Number(data.year) : null,
      beforeImageUrl: nullIfEmpty(data.beforeImageUrl),
      afterImageUrl: nullIfEmpty(data.afterImageUrl),
      videoUrl: nullIfEmpty(data.videoUrl),
      resultsMeta: cleanResultsMeta(data.resultsMeta),
      categoryId: data.categoryId ?? null,
      translations: translationsWrite,
      status: data.status,
    };

    // Slug is minted once on create and never changes on edit.
    const slug = existing
      ? existing.slug
      : await uniqueSlug(data.title, async (candidate) =>
          Boolean(
            await db.portfolio.findUnique({
              where: { slug: candidate },
              select: { id: true },
            }),
          ),
        );

    const portfolio = await db.$transaction(async (tx) => {
      const row = existing
        ? await tx.portfolio.update({ where: { id: existing.id }, data: base })
        : await tx.portfolio.create({ data: { ...base, slug } });

      // Replace-all strategy for the gallery.
      await tx.portfolioImage.deleteMany({ where: { portfolioId: row.id } });
      if (data.images.length > 0) {
        await tx.portfolioImage.createMany({
          data: data.images.map((img, i) => ({
            portfolioId: row.id,
            url: img.url,
            alt: img.alt,
            caption: nullIfEmpty(img.caption),
            translations: (normalizeTranslations(img.translations, [
              "caption",
            ]) ?? Prisma.DbNull) as
              | Prisma.InputJsonValue
              | typeof Prisma.DbNull,
            order: img.order ?? i,
          })),
        });
      }

      return row;
    });

    await logActivity({
      userId: session.user.id,
      action: existing ? "update" : "create",
      entity: "Portfolio",
      entityId: portfolio.id,
      meta: {
        title: portfolio.title,
        status: portfolio.status,
        ...(existing
          ? {
              before: snapshotBefore(existing, [
                "title",
                "status",
                "categoryId",
                "year",
                "location",
              ]),
            }
          : {}),
      },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePath(`${STUDIO_PATH}/${portfolio.id}`);
    revalidatePublic("portfolio", portfolio.slug);

    return { id: portfolio.id, slug: portfolio.slug };
  });
}

const idsSchema = z
  .array(z.string().min(1))
  .min(1, "Select at least one portfolio piece.");

export async function setPortfoliosStatus(
  ids: string[],
  status: ContentStatusValue,
): Promise<ActionResult<{ updated: number }>> {
  const session = await requireStaff();

  const parsed = z
    .object({ ids: idsSchema, status: z.enum(CONTENT_STATUSES) })
    .safeParse({ ids, status });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  return runAction(async () => {
    const { count: updated } = await db.portfolio.updateMany({
      where: { id: { in: parsed.data.ids } },
      data: { status: parsed.data.status },
    });

    await logActivity({
      userId: session.user.id,
      action: parsed.data.status === "PUBLISHED" ? "publish" : "unpublish",
      entity: "Portfolio",
      meta: { count: updated },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePublic("portfolio");
    return { updated };
  });
}

export async function deletePortfolios(
  ids: string[],
): Promise<ActionResult<{ deleted: number }>> {
  const session = await requireStaff();

  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  return runAction(async () => {
    // Snapshot media urls before the cascade wipes PortfolioImage rows —
    // gallery images plus the before/after shots uploaded for these pieces.
    const [rows, images] = await Promise.all([
      db.portfolio.findMany({
        where: { id: { in: parsed.data } },
        select: { beforeImageUrl: true, afterImageUrl: true },
      }),
      db.portfolioImage.findMany({
        where: { portfolioId: { in: parsed.data } },
        select: { url: true },
      }),
    ]);
    const urls = [
      ...new Set([
        ...images.map((img) => img.url),
        ...rows.flatMap((row) =>
          [row.beforeImageUrl, row.afterImageUrl].filter((url): url is string =>
            Boolean(url),
          ),
        ),
      ]),
    ];

    const [{ count: deleted }] = await db.$transaction([
      db.portfolio.deleteMany({ where: { id: { in: parsed.data } } }),
    ]);

    // Best-effort storage + Media cleanup, guarded like deleteMediaItems: only
    // remove files no OTHER content still references — a URL reused as a
    // category cover, a testimonial avatar, or another product/portfolio's
    // media must survive this delete (ENG-806/UIUX-605). Batched instead of a
    // per-URL round-trip. A failed file delete must not undo the delete.
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
      entity: "Portfolio",
      meta: { count: deleted, imagesCleaned },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePublic("portfolio");
    return { deleted };
  });
}
