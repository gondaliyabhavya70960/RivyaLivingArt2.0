"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  requireStaff,
  revalidatePublic,
  runAction,
  type ActionResult,
} from "@/actions/helpers";
import { isLegalPageSlug } from "@/components/studio/pages/legal";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { nullIfEmpty } from "@/lib/utils";
import { normalizeTranslations, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { slugify, uniqueSlug } from "@/lib/slug";
import { Prisma } from "@/generated/prisma/client";

const STUDIO_PATH = "/studio/pages";

const upsertSchema = z.object({
  id: z.string().min(1).optional(),
  /** Only read on create — existing slugs are immutable. */
  slug: z.string().trim().max(120).optional(),
  title: z
    .string()
    .trim()
    .min(2, "Title needs at least 2 characters.")
    .max(200),
  /** Tiptap document JSON. */
  content: z.record(z.string(), z.unknown()),
  seoTitle: z.string().trim().max(300).optional(),
  seoDescription: z.string().trim().max(500).optional(),
  translations: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export type UpsertPageInput = z.input<typeof upsertSchema>;

/**
 * Create or update a page. The slug is minted once on create (from the
 * given slug, falling back to the title) and never changes afterwards —
 * the seeded "privacy" and "terms" pages in particular keep their slugs
 * forever because the public footer links to them.
 */
export async function upsertPage(
  input: UpsertPageInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const session = await requireStaff();

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid page data.",
    };
  }
  const data = parsed.data;

  // Creation is closed. Only `(v2)/privacy` and `(v2)/terms` read a Page row,
  // each hardcoding its own slug, so a new page would have no URL — 404 for
  // every visitor, and unlinkable besides, since `KNOWN_ROUTES` lists no Page
  // slug. The Studio no longer offers it, and this is the guard that matters:
  // a Server Action is reachable without the screen that used to call it.
  // Reopening this means building the renderer first, not deleting these lines.
  if (!data.id) {
    return {
      ok: false,
      error:
        "New pages are not available: the storefront has no route for one, so it would be unreachable. The Privacy and Terms pages can be edited.",
    };
  }

  const existing = await db.page.findUnique({
    where: { id: data.id },
    select: { id: true, slug: true },
  });
  if (!existing) {
    return { ok: false, error: "Page not found — it may have been deleted." };
  }

  // Prune per-locale overrides to known locales + translatable fields; an
  // empty result writes SQL NULL so the column stays clean.
  const normalizedTranslations = normalizeTranslations(
    data.translations,
    TRANSLATABLE_FIELDS.page,
  );
  const translationsWrite: Prisma.InputJsonValue | typeof Prisma.DbNull =
    normalizedTranslations === null
      ? Prisma.DbNull
      : (normalizedTranslations as Prisma.InputJsonValue);

  return runAction(async () => {
    const base = {
      title: data.title,
      content: data.content as Prisma.InputJsonValue,
      seoTitle: nullIfEmpty(data.seoTitle),
      seoDescription: nullIfEmpty(data.seoDescription),
      translations: translationsWrite,
    };

    // Slug is immutable, so a public URL stays stable. `existing` is
    // guaranteed above — creation is refused before this point.
    const page = existing
      ? await db.page.update({ where: { id: existing.id }, data: base })
      : await db.page.create({
          data: {
            ...base,
            slug: await uniqueSlug(
              slugify(data.slug || data.title) || "page",
              async (candidate) =>
                Boolean(
                  await db.page.findUnique({
                    where: { slug: candidate },
                    select: { id: true },
                  }),
                ),
            ),
          },
        });

    await logActivity({
      userId: session.user.id,
      action: existing ? "update" : "create",
      entity: "Page",
      entityId: page.id,
      meta: { title: page.title, slug: page.slug },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePath(`${STUDIO_PATH}/${page.id}`);
    // The public route goes through revalidatePublic, which expands it across
    // all nine locales. The bare `/${page.slug}` that used to sit here covered
    // English only, so an edit to the Hindi privacy policy did not appear.
    if (page.slug) revalidatePublic("page", page.slug);

    return { id: page.id, slug: page.slug };
  });
}

const idsSchema = z
  .array(z.string().min(1))
  .min(1, "Select at least one page.");

/**
 * Bulk delete. The seeded legal pages ("privacy" / "terms") are
 * load-bearing — the public footer links to them — so a batch containing
 * either is refused outright, naming the offending rows.
 */
export async function deletePages(
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

  const rows = await db.page.findMany({
    where: { id: { in: parsed.data } },
    select: { id: true, slug: true, title: true },
  });

  const blocked = rows.filter((row) => isLegalPageSlug(row.slug));
  if (blocked.length > 0) {
    const names = blocked.map((row) => `“${row.title}”`).join(" and ");
    return {
      ok: false,
      error:
        blocked.length === 1
          ? `${names} is a legal page the site links to — it cannot be deleted. Unselect it and try again.`
          : `${names} are legal pages the site links to — they cannot be deleted. Unselect them and try again.`,
    };
  }

  return runAction(async () => {
    const { count: deleted } = await db.page.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });

    await logActivity({
      userId: session.user.id,
      action: rows.length > 1 ? "bulk-delete" : "delete",
      entity: "Page",
      meta: { count: deleted, slugs: rows.map((row) => row.slug) },
    });

    revalidatePath(STUDIO_PATH);
    for (const row of rows) {
      if (row.slug) revalidatePublic("page", row.slug);
    }
    return { deleted };
  });
}
