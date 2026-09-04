"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  requireStaff,
  revalidatePublic,
  runAction,
  type ActionResult,
} from "@/actions/helpers";
import {
  CUSTOM_BLOCKS,
  describeBlockArrangementProblem,
  describeBlockDataProblem,
  defaultBlockData,
  isCustomBlockType,
  type CustomBlockType,
} from "@/lib/custom-blocks";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { CUSTOM_PAGE_TRANSLATABLE } from "@/lib/custom-pages";
import { normalizeTranslations } from "@/lib/localize";
import { nullIfEmpty } from "@/lib/utils";
import { slugify, uniqueSlug } from "@/lib/slug";
import { Prisma } from "@/generated/prisma/client";
import { CONTENT_STATUSES } from "@/lib/content-status";

/**
 * Custom landing pages — the write half of /studio/custom-pages.
 *
 * Unlike the copy and image registries, there is no staged/live split here.
 * A landing page has one already: `status` plus `publishAt`. An unpublished
 * page is invisible to visitors and fully previewable by staff, which is what
 * a draft is — adding a second draft layer on top would give the owner two
 * different meanings for "not live yet".
 *
 * The band-rhythm and one-hero rules run on the arrangement as it WOULD BE,
 * before the row is written, and they refuse rather than warn.
 */

const STUDIO_PATH = "/studio/custom-pages";

function revalidate(slug?: string) {
  revalidatePath(STUDIO_PATH);
  // revalidatePublic also expires /sitemap.xml, which now lists these pages.
  revalidatePublic("customPage", slug);
}

/* ═══════════════════════ the page ═══════════════════════ */

const pageSchema = z.object({
  id: z.string().min(1).optional(),
  /** Read on create only — a live URL must not move under a customer. */
  slug: z.string().trim().max(120).optional(),
  title: z.string().trim().min(2, "Give the page a title.").max(200),
  status: z.enum(CONTENT_STATUSES).default("DRAFT"),
  /** ISO string from the form's datetime-local input, or empty for "now". */
  publishAt: z.string().trim().max(40).optional(),
  noindex: z.boolean().default(false),
  seoTitle: z.string().trim().max(300).optional(),
  seoDescription: z.string().trim().max(500).optional(),
  ogImage: z.string().trim().max(600).optional(),
  translations: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export type UpsertCustomPageInput = z.input<typeof pageSchema>;

function parsePublishAt(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Create or update a landing page's own fields. Blocks are edited separately. */
export async function upsertCustomPage(
  input: UpsertCustomPageInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const session = await requireStaff(["ADMIN", "EDITOR"]);

  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the page's details.",
    };
  }
  const data = parsed.data;

  const common = {
    title: data.title,
    status: data.status,
    publishAt: parsePublishAt(data.publishAt),
    noindex: data.noindex,
    seoTitle: nullIfEmpty(data.seoTitle),
    seoDescription: nullIfEmpty(data.seoDescription),
    ogImage: nullIfEmpty(data.ogImage),
    translations: (normalizeTranslations(
      data.translations,
      CUSTOM_PAGE_TRANSLATABLE,
    ) ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
    updatedById: session.user.id,
  };

  try {
    if (data.id) {
      const row = await db.customPage.update({
        where: { id: data.id },
        data: common,
        select: { id: true, slug: true },
      });
      await logActivity({
        userId: session.user.id,
        action: "update",
        entity: "CustomPage",
        entityId: row.id,
      });
      revalidate(row.slug);
      return { ok: true, data: row };
    }

    const base = slugify(data.slug || data.title);
    if (!base) {
      return {
        ok: false,
        error: "Give the page a title it can make a URL from.",
      };
    }
    const slug = await uniqueSlug(base, async (candidate) =>
      Boolean(
        await db.customPage.findUnique({
          where: { slug: candidate },
          select: { id: true },
        }),
      ),
    );

    const row = await db.customPage.create({
      data: { ...common, slug },
      select: { id: true, slug: true },
    });
    await logActivity({
      userId: session.user.id,
      action: "create",
      entity: "CustomPage",
      entityId: row.id,
    });
    revalidate(row.slug);
    return { ok: true, data: row };
  } catch (error) {
    console.error("Custom page save failed:", error);
    return { ok: false, error: "Could not save the page. Please try again." };
  }
}

/**
 * Copy a landing page and everything on it.
 *
 * Seasonal drops repeat: next year's Diwali page is this year's with new
 * pictures and new dates. Without this an owner rebuilds seven blocks from
 * scratch to change four of them.
 *
 * The copy is ALWAYS a draft, whatever the original was, and it never inherits
 * `publishAt`. Duplicating a live page must not put a second live page on the
 * site at the same moment — that is a second copy of the same campaign
 * competing with itself in search.
 */
export async function duplicateCustomPage(
  id: string,
): Promise<ActionResult<{ id: string; slug: string }>> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);

    const source = await db.customPage.findUnique({
      where: { id },
      include: { blocks: { orderBy: { order: "asc" } } },
    });
    if (!source) throw new Error("That page no longer exists.");

    // "diwali-2026" → "diwali-2026-copy", then -2, -3 … from uniqueSlug.
    const slug = await uniqueSlug(`${source.slug}-copy`, async (candidate) =>
      Boolean(
        await db.customPage.findUnique({
          where: { slug: candidate },
          select: { id: true },
        }),
      ),
    );

    const copy = await db.customPage.create({
      data: {
        slug,
        title: `${source.title} (copy)`,
        status: "DRAFT",
        publishAt: null,
        noindex: source.noindex,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        ogImage: source.ogImage,
        translations: (source.translations ??
          Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
        updatedById: session.user.id,
        blocks: {
          create: source.blocks.map((block) => ({
            type: block.type,
            order: block.order,
            data: block.data as Prisma.InputJsonValue,
            translations: (block.translations ??
              Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
          })),
        },
      },
      select: { id: true, slug: true },
    });

    await logActivity({
      userId: session.user.id,
      action: "create",
      entity: "CustomPage",
      entityId: copy.id,
      meta: { duplicatedFrom: source.slug, blocks: source.blocks.length },
    });
    revalidate();
    return copy;
  });
}

export async function deleteCustomPage(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const row = await db.customPage.delete({
      where: { id },
      select: { slug: true },
    });
    await logActivity({
      userId: session.user.id,
      action: "delete",
      entity: "CustomPage",
      entityId: id,
    });
    revalidate(row.slug);
    return undefined;
  });
}

/* ═══════════════════════ the blocks ═══════════════════════ */

/**
 * Check an arrangement before writing it.
 *
 * Takes the blocks as they WOULD BE, so the refusal lands before the row is
 * written rather than after — the same shape as the section board's check.
 */
async function checkArrangement(
  pageId: string,
  change: {
    add?: { type: CustomBlockType; data?: unknown };
    removeId?: string;
    update?: { id: string; data: unknown };
    order?: string[];
  },
): Promise<string | null> {
  const rows = await db.customBlock.findMany({
    where: { pageId },
    orderBy: { order: "asc" },
    select: { id: true, type: true, data: true },
  });

  let next = rows.flatMap((row) =>
    isCustomBlockType(row.type)
      ? [{ id: row.id, type: row.type, data: row.data as unknown }]
      : [],
  );

  if (change.removeId) next = next.filter((b) => b.id !== change.removeId);
  if (change.update) {
    next = next.map((b) =>
      b.id === change.update!.id ? { ...b, data: change.update!.data } : b,
    );
  }
  if (change.order) {
    const byId = new Map(next.map((b) => [b.id, b]));
    const ordered = change.order.flatMap((id) => {
      const block = byId.get(id);
      return block ? [block] : [];
    });
    // Total: a block the caller forgot keeps its place in the tail rather than
    // falling off the page.
    for (const block of next) {
      if (!change.order.includes(block.id)) ordered.push(block);
    }
    next = ordered;
  }
  if (change.add) {
    next = [
      ...next,
      { id: "new", type: change.add.type, data: change.add.data },
    ];
  }

  return describeBlockArrangementProblem(next);
}

const blockTypeSchema = z
  .string()
  .refine(isCustomBlockType, "That is not a block this site has.");

/** Add a block to the end of a page. */
export async function addCustomBlock(input: {
  pageId: string;
  type: string;
}): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);
    const type = blockTypeSchema.parse(input.type) as CustomBlockType;

    const problem = await checkArrangement(input.pageId, {
      add: { type, data: defaultBlockData(type) },
    });
    if (problem) throw new Error(problem);

    const last = await db.customBlock.findFirst({
      where: { pageId: input.pageId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const row = await db.customBlock.create({
      data: {
        pageId: input.pageId,
        type,
        order: (last?.order ?? -1) + 1,
        data: defaultBlockData(type) as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await logActivity({
      userId: session.user.id,
      action: "create",
      entity: "CustomBlock",
      entityId: row.id,
      meta: { type },
    });
    await touch(input.pageId, session.user.id);
    return row;
  });
}

/** Save one block's fields. */
export async function saveCustomBlock(input: {
  id: string;
  data: unknown;
  translations?: Record<string, Record<string, unknown>>;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);
    const block = await db.customBlock.findUnique({
      where: { id: input.id },
      select: { id: true, pageId: true, type: true },
    });
    if (!block || !isCustomBlockType(block.type)) {
      throw new Error("That block is no longer on this page.");
    }

    const fieldProblem = describeBlockDataProblem(block.type, input.data);
    if (fieldProblem) throw new Error(fieldProblem);

    const problem = await checkArrangement(block.pageId, {
      update: { id: block.id, data: input.data },
    });
    if (problem) throw new Error(problem);

    await db.customBlock.update({
      where: { id: block.id },
      data: {
        data: input.data as Prisma.InputJsonValue,
        translations: (normalizeTranslations(
          input.translations,
          CUSTOM_BLOCKS[block.type].translatable.map((f) => f.name),
        ) ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
      },
    });

    await touch(block.pageId, session.user.id);
    return undefined;
  });
}

/** Reorder a page's blocks. */
export async function reorderCustomBlocks(input: {
  pageId: string;
  ids: string[];
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);

    const problem = await checkArrangement(input.pageId, {
      order: input.ids,
    });
    if (problem) throw new Error(problem);

    const rows = await db.customBlock.findMany({
      where: { pageId: input.pageId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    const known = new Set(rows.map((r) => r.id));
    const ordered = input.ids.filter((id) => known.has(id));
    for (const row of rows) if (!ordered.includes(row.id)) ordered.push(row.id);

    await db.$transaction(
      ordered.map((id, index) =>
        db.customBlock.update({ where: { id }, data: { order: index } }),
      ),
    );

    await touch(input.pageId, session.user.id);
    return undefined;
  });
}

export async function deleteCustomBlock(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);
    const block = await db.customBlock.findUnique({
      where: { id },
      select: { pageId: true, type: true },
    });
    if (!block) return undefined;

    await db.customBlock.delete({ where: { id } });
    await logActivity({
      userId: session.user.id,
      action: "delete",
      entity: "CustomBlock",
      entityId: id,
      meta: { type: block.type },
    });
    await touch(block.pageId, session.user.id);
    return undefined;
  });
}

/**
 * Stamp the page and expire its caches after a block change.
 *
 * `updatedAt` is what the sitemap reports as `lastmod`, and a block edit is a
 * change to the page even though the page row did not move.
 */
async function touch(pageId: string, userId: string) {
  const page = await db.customPage.update({
    where: { id: pageId },
    data: { updatedById: userId },
    select: { slug: true },
  });
  revalidate(page.slug);
  revalidatePath(`${STUDIO_PATH}/${pageId}`);
}
