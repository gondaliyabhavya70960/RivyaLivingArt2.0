"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  requireStaff,
  revalidatePublic,
  runAction,
  type ActionResult,
} from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { CATALOG_NAV_TAG } from "@/lib/catalog-nav";
import { db } from "@/lib/db";
import { normalizeTranslations, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { SHOP_FIRST_PAGE_TAG } from "@/lib/shop";
import { createWithUniqueSlug, slugify, uniqueSlug } from "@/lib/slug";

const STUDIO_PATH = "/studio/categories";

/**
 * Cross-request data caches that carry category names/order/counts (M-P4/
 * M-P5): the header mega-menu and the cached default /shop first page. Every
 * category mutation must expire both alongside its revalidatePath calls.
 */
function revalidateCategoryCaches() {
  revalidateTag(CATALOG_NAV_TAG, "max");
  revalidateTag(SHOP_FIRST_PAGE_TAG, "max");
}

const upsertSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(2000).optional(),
  image: z.string().trim().max(2048).optional(),
  translations: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
  order: z.number().int().min(0).optional(),
});

export type UpsertCategoryInput = z.input<typeof upsertSchema>;

/**
 * Create or update a category. The slug is generated once on create
 * (via uniqueSlug) and never changes on update, so public URLs stay stable.
 */
export async function upsertCategory(
  input: UpsertCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = upsertSchema.parse(input);

    // Prune per-locale overrides to known locales + translatable fields; an
    // empty result writes SQL NULL so the column stays clean (public site
    // unchanged). `data` feeds both the update and create branches below.
    const normalized = normalizeTranslations(
      parsed.translations,
      TRANSLATABLE_FIELDS.category,
    );
    const data = {
      name: parsed.name,
      description: parsed.description || null,
      image: parsed.image || null,
      translations:
        normalized === null
          ? Prisma.DbNull
          : (normalized as Prisma.InputJsonValue),
    };

    let id: string;
    if (parsed.id) {
      // Slug intentionally untouched — immutable after creation.
      const updated = await db.category.update({
        where: { id: parsed.id },
        data: {
          ...data,
          ...(parsed.order !== undefined ? { order: parsed.order } : {}),
        },
      });
      id = updated.id;
    } else {
      // Exists-check needs no own-id exclusion: this branch only runs on
      // create, and updates never regenerate the slug.
      const slug = await uniqueSlug(slugify(parsed.name), async (candidate) =>
        Boolean(
          await db.category.findFirst({
            where: { slug: candidate },
            select: { id: true },
          }),
        ),
      );
      // Append to the end of the current ordering by default.
      const maxOrder = await db.category.aggregate({ _max: { order: true } });
      const created = await createWithUniqueSlug(slug, (candidateSlug) =>
        db.category.create({
          data: {
            ...data,
            slug: candidateSlug,
            order: parsed.order ?? (maxOrder._max.order ?? -1) + 1,
          },
        }),
      );
      id = created.id;
    }

    await logActivity({
      userId: session.user.id,
      action: parsed.id ? "update" : "create",
      entity: "Category",
      entityId: id,
      meta: { name: parsed.name },
    });
    revalidatePath(STUDIO_PATH);
    revalidatePublic("category");
    revalidateCategoryCaches();
    return { id };
  });
}

const deleteSchema = z.array(z.string().min(1)).min(1);

/**
 * Bulk delete. Refuses to delete any batch in which a category still has
 * products — the caller gets a friendly error naming the offenders.
 */
export async function deleteCategories(
  input: string[],
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const session = await requireStaff();
    const ids = deleteSchema.parse(input);

    const grouped = await db.product.groupBy({
      by: ["categoryId"],
      where: { categoryId: { in: ids } },
      _count: { _all: true },
    });
    const blockedIds = grouped
      .filter((g) => g._count._all > 0)
      .map((g) => g.categoryId);

    if (blockedIds.length > 0) {
      const blocked = await db.category.findMany({
        where: { id: { in: blockedIds } },
        select: { name: true },
        orderBy: { order: "asc" },
      });
      return { blockedNames: blocked.map((c) => c.name) };
    }

    await db.$transaction([
      db.category.deleteMany({ where: { id: { in: ids } } }),
    ]);
    await logActivity({
      userId: session.user.id,
      action: ids.length > 1 ? "bulk-delete" : "delete",
      entity: "Category",
      meta: { count: ids.length, ids },
    });
    revalidatePath(STUDIO_PATH);
    revalidatePublic("category");
    revalidateCategoryCaches();
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
      } products — move or delete those products first. (${blockedNames.join(", ")})`,
    };
  }
  return { ok: true };
}

const reorderSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

/**
 * Swap a category with its neighbour in display order. Works in index
 * space so duplicate `order` values (e.g. several defaults of 0) are
 * normalised as a side effect.
 */
export async function reorderCategory(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = reorderSchema.parse({ id, direction });

    const all = await db.category.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, order: true },
    });
    const index = all.findIndex((c) => c.id === parsed.id);
    if (index === -1) throw new Error("Category not found");

    const target = parsed.direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= all.length) return undefined; // already at the edge

    [all[index], all[target]] = [all[target], all[index]];

    const writes = all.flatMap((c, i) =>
      c.order === i
        ? []
        : [db.category.update({ where: { id: c.id }, data: { order: i } })],
    );
    if (writes.length > 0) await db.$transaction(writes);

    await logActivity({
      userId: session.user.id,
      action: "reorder",
      entity: "Category",
      entityId: parsed.id,
      meta: { direction: parsed.direction },
    });
    revalidatePath(STUDIO_PATH);
    revalidatePublic("category");
    revalidateCategoryCaches();
    return undefined;
  });
}
