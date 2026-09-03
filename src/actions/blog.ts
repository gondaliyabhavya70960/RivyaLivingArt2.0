"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  requireStaff,
  revalidatePublic,
  runAction,
  type ActionResult,
} from "@/actions/helpers";
import { logActivity, snapshotBefore } from "@/lib/activity";
import { db } from "@/lib/db";
import { nullIfEmpty } from "@/lib/utils";
import { normalizeTranslations, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { createWithUniqueSlug, slugify, uniqueSlug } from "@/lib/slug";
import { Prisma } from "@/generated/prisma/client";
import {
  CONTENT_STATUSES,
  type ContentStatusValue,
} from "@/lib/content-status";

const STUDIO_PATH = "/studio/blog";

/** Publish timestamps are minted here, never in components. */
const publishStamp = () => new Date();

// ————————————————————— Posts —————————————————————

const optionalUrl = z
  .union([z.literal(""), z.url("Enter a valid URL.")])
  .optional();

const upsertPostSchema = z.object({
  id: z.string().min(1).optional(),
  title: z
    .string()
    .trim()
    .min(2, "Title needs at least 2 characters.")
    .max(200),
  excerpt: z.string().trim().max(600).optional(),
  /** Tiptap document JSON. */
  content: z.record(z.string(), z.unknown()),
  coverImage: optionalUrl,
  authorName: z.string().trim().min(1, "Author name is required.").max(120),
  blogCategoryId: z.string().min(1).nullable().optional(),
  /** B0's `BlogPost.categoryId` → shop `Category` — the "Related collection"
   *  select (11: Taxonomy tab), distinct from `blogCategoryId` above (the
   *  journal's own taxonomy). Feeds the article's related-collections strip. */
  categoryId: z.string().min(1).nullable().optional(),
  tagIds: z.array(z.string().min(1)).default([]),
  status: z.enum(CONTENT_STATUSES),
  publishedAt: z.iso.datetime("Invalid publish date.").nullable().optional(),
  seoTitle: z.string().trim().max(300).optional(),
  seoDescription: z.string().trim().max(500).optional(),
  translations: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export type UpsertBlogPostInput = z.input<typeof upsertPostSchema>;

export async function upsertBlogPost(
  input: UpsertBlogPostInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const session = await requireStaff();

  const parsed = upsertPostSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid post data.",
    };
  }
  const data = parsed.data;

  if (data.blogCategoryId) {
    const category = await db.blogCategory.findUnique({
      where: { id: data.blogCategoryId },
      select: { id: true },
    });
    if (!category) {
      return { ok: false, error: "The selected category no longer exists." };
    }
  }
  if (data.categoryId) {
    const collection = await db.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!collection) {
      return { ok: false, error: "The selected collection no longer exists." };
    }
  }

  const existing = data.id
    ? await db.blogPost.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          status: true,
          blogCategoryId: true,
          categoryId: true,
        },
      })
    : null;
  if (data.id && !existing) {
    return { ok: false, error: "Post not found — it may have been deleted." };
  }

  return runAction(async () => {
    // An explicit date always wins; publishing without one stamps "now".
    let publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    if (data.status === "PUBLISHED" && !publishedAt) {
      publishedAt = publishStamp();
    }

    // Tags that were deleted mid-edit are silently dropped instead of
    // failing the whole save.
    const tagRefs = await db.tag.findMany({
      where: { id: { in: data.tagIds } },
      select: { id: true },
    });

    const normalizedTranslations = normalizeTranslations(
      data.translations,
      TRANSLATABLE_FIELDS.blogPost,
    );

    const base = {
      title: data.title,
      excerpt: data.excerpt ?? "",
      content: data.content as Prisma.InputJsonValue,
      coverImage: nullIfEmpty(data.coverImage),
      authorName: data.authorName,
      blogCategoryId: data.blogCategoryId ?? null,
      categoryId: data.categoryId ?? null,
      status: data.status,
      publishedAt,
      seoTitle: nullIfEmpty(data.seoTitle),
      seoDescription: nullIfEmpty(data.seoDescription),
      translations:
        normalizedTranslations === null
          ? Prisma.DbNull
          : (normalizedTranslations as Prisma.InputJsonValue),
    };

    // Slug is minted once on create and never changes on edit.
    const post = existing
      ? await db.blogPost.update({
          where: { id: existing.id },
          data: { ...base, tags: { set: tagRefs } },
        })
      : await createWithUniqueSlug(
          await uniqueSlug(data.title, async (candidate) =>
            Boolean(
              await db.blogPost.findUnique({
                where: { slug: candidate },
                select: { id: true },
              }),
            ),
          ),
          (slug) =>
            db.blogPost.create({
              data: { ...base, slug, tags: { connect: tagRefs } },
            }),
        );

    await logActivity({
      userId: session.user.id,
      action: existing ? "update" : "create",
      entity: "BlogPost",
      entityId: post.id,
      meta: {
        title: post.title,
        status: post.status,
        ...(existing
          ? {
              before: snapshotBefore(existing, [
                "title",
                "excerpt",
                "status",
                "blogCategoryId",
                "categoryId",
              ]),
            }
          : {}),
      },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePath(`${STUDIO_PATH}/${post.id}`);
    revalidatePublic("blogPost", post.slug);

    return { id: post.id, slug: post.slug };
  });
}

const idsSchema = z
  .array(z.string().min(1))
  .min(1, "Select at least one item.");

export async function deleteBlogPosts(
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
    const { count: deleted } = await db.blogPost.deleteMany({
      where: { id: { in: parsed.data } },
    });

    await logActivity({
      userId: session.user.id,
      action: parsed.data.length > 1 ? "bulk-delete" : "delete",
      entity: "BlogPost",
      meta: { count: deleted, ids: parsed.data },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePublic("blogPost");
    return { deleted };
  });
}

export async function setBlogPostsStatus(
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
    const where = { id: { in: parsed.data.ids } };

    const ops: Prisma.PrismaPromise<Prisma.BatchPayload>[] = [];
    if (parsed.data.status === "PUBLISHED") {
      // Publishing stamps a publish time on rows that never had one;
      // explicitly dated posts keep their date.
      ops.push(
        db.blogPost.updateMany({
          where: { ...where, publishedAt: null },
          data: { publishedAt: publishStamp() },
        }),
      );
    }
    ops.push(
      db.blogPost.updateMany({ where, data: { status: parsed.data.status } }),
    );

    const results = await db.$transaction(ops);
    const updated = results[results.length - 1].count;

    await logActivity({
      userId: session.user.id,
      action: parsed.data.status === "PUBLISHED" ? "publish" : "unpublish",
      entity: "BlogPost",
      meta: { count: updated },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePublic("blogPost");
    return { updated };
  });
}

// ————————————————————— Categories & tags —————————————————————

const nameSchema = z.string().trim().min(1, "Name is required.").max(120);

/**
 * Create-if-missing by name: two names that slugify identically are the
 * same entity, so the existing row is returned with `created: false`.
 */
export async function upsertBlogCategory(
  name: string,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const session = await requireStaff();

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid name.",
    };
  }

  return runAction(async () => {
    const slug = slugify(parsed.data) || "category";
    const existing = await db.blogCategory.findUnique({ where: { slug } });
    if (existing) return { id: existing.id, created: false };

    const created = await db.blogCategory.create({
      data: { name: parsed.data, slug },
    });

    await logActivity({
      userId: session.user.id,
      action: "create",
      entity: "BlogCategory",
      entityId: created.id,
      meta: { name: created.name },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePublic("blogPost");
    return { id: created.id, created: true };
  });
}

const taxonomyTranslationsSchema = z.object({
  kind: z.enum(["category", "tag"]),
  id: z.string().min(1),
  translations: z.unknown(),
});

/**
 * Per-language names for a blog category or tag.
 *
 * These two labels were the last content on the site that rendered English in
 * all nine locales no matter what the owner did — there was nowhere to type a
 * translation, because the column did not exist. The slug is untouched: it is
 * the URL the category filter is linked by, and translating it would break
 * every link that already points at it.
 */
export async function setTaxonomyTranslations(
  input: unknown,
): Promise<ActionResult> {
  const session = await requireStaff();

  const parsed = taxonomyTranslationsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }
  const { kind, id, translations } = parsed.data;

  return runAction(async () => {
    const cleaned = normalizeTranslations(
      translations,
      kind === "category"
        ? TRANSLATABLE_FIELDS.blogCategory
        : TRANSLATABLE_FIELDS.tag,
    );
    // Shared between the two models, so the JSON value is cast once rather
    // than inferred per call — same idiom as `custom-pages.ts`.
    const data = {
      translations: (cleaned ?? Prisma.DbNull) as
        | Prisma.InputJsonValue
        | typeof Prisma.DbNull,
    };

    const row =
      kind === "category"
        ? await db.blogCategory.update({ where: { id }, data })
        : await db.tag.update({ where: { id }, data });

    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: kind === "category" ? "BlogCategory" : "Tag",
      entityId: row.id,
      meta: { name: row.name, translations: Object.keys(cleaned ?? {}).length },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePublic("blogPost");
    return undefined;
  });
}

/**
 * Bulk delete. Refuses the whole batch while any category still has
 * posts — the error names the offenders.
 */
export async function deleteBlogCategories(
  input: string[],
): Promise<ActionResult> {
  const session = await requireStaff();

  const parsed = idsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const result = await runAction(async () => {
    const grouped = await db.blogPost.groupBy({
      by: ["blogCategoryId"],
      where: { blogCategoryId: { in: parsed.data } },
      _count: { _all: true },
    });
    const blockedIds = grouped
      .filter((g) => g._count._all > 0)
      .map((g) => g.blogCategoryId)
      .filter((id): id is string => id !== null);

    if (blockedIds.length > 0) {
      const blocked = await db.blogCategory.findMany({
        where: { id: { in: blockedIds } },
        select: { name: true },
        orderBy: { name: "asc" },
      });
      return { blockedNames: blocked.map((c) => c.name) };
    }

    await db.blogCategory.deleteMany({ where: { id: { in: parsed.data } } });

    await logActivity({
      userId: session.user.id,
      action: parsed.data.length > 1 ? "bulk-delete" : "delete",
      entity: "BlogCategory",
      meta: { count: parsed.data.length, ids: parsed.data },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePublic("blogPost");
    return { blockedNames: [] as string[] };
  });

  if (!result.ok) return result;

  const blockedNames = result.data?.blockedNames ?? [];
  if (blockedNames.length > 0) {
    const n = blockedNames.length;
    return {
      ok: false,
      error: `${n} ${
        n === 1 ? "category still contains" : "categories still contain"
      } posts — move or delete those posts first. (${blockedNames.join(", ")})`,
    };
  }
  return { ok: true };
}

/** Create-if-missing by name — same semantics as upsertBlogCategory. */
export async function upsertTag(
  name: string,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const session = await requireStaff();

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid name.",
    };
  }

  return runAction(async () => {
    const slug = slugify(parsed.data) || "tag";
    const existing = await db.tag.findUnique({ where: { slug } });
    if (existing) return { id: existing.id, created: false };

    const created = await db.tag.create({ data: { name: parsed.data, slug } });

    await logActivity({
      userId: session.user.id,
      action: "create",
      entity: "Tag",
      entityId: created.id,
      meta: { name: created.name },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePublic("blogPost");
    return { id: created.id, created: true };
  });
}

/** Bulk delete — detaching a tag from its posts is always safe. */
export async function deleteTags(ids: string[]): Promise<ActionResult> {
  const session = await requireStaff();

  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  return runAction(async () => {
    const { count } = await db.tag.deleteMany({
      where: { id: { in: parsed.data } },
    });

    await logActivity({
      userId: session.user.id,
      action: parsed.data.length > 1 ? "bulk-delete" : "delete",
      entity: "Tag",
      meta: { count, ids: parsed.data },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePublic("blogPost");
    return undefined;
  });
}
