"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { locales } from "@/i18n/config";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { copySlot, describeCopyProblem, isCopyKey } from "@/lib/site-copy";
import { SITE_COPY_TAG, shippedCopy } from "@/lib/site-copy-server";

/**
 * Site Copy actions — the write half of /studio/site-copy.
 *
 * Every write revalidates the `site-copy` tag rather than a path. Copy appears
 * on every route in nine locales, and `localePrefix: "as-needed"` gives each
 * locale its own cache entry, so busting paths would mean enumerating ~150
 * URLs and still missing the dynamic ones. Every page reads the overrides
 * through `getSiteCopy()`, which is tagged — so expiring the tag reaches
 * exactly the routes that render the changed string, in every language.
 */

const STUDIO_PATH = "/studio/site-copy";

const keySchema = z.string().refine(isCopyKey, "Unknown copy slot");
const localeSchema = z
  .string()
  .refine(
    (v) => (locales as readonly string[]).includes(v),
    "Unknown language",
  );

function revalidate() {
  revalidateTag(SITE_COPY_TAG, "max");
  revalidatePath(STUDIO_PATH);
}

/**
 * Stage new words for one slot, in one language.
 *
 * Since Phase E a save is a DRAFT: it does not reach a visitor until the
 * surface is published. That is the whole point of the staging column — an
 * owner can rewrite an About page over an afternoon and release it in one
 * step, rather than publishing each sentence as they type it.
 *
 * An empty value clears the row rather than storing `""`: blanking a field is
 * how an owner asks for the shipped default back. When the row has never been
 * published it is deleted outright; when it has, the DRAFT is set to the
 * published value so "reset" is itself something to publish.
 */
export async function setSiteCopy(input: {
  key: string;
  locale: string;
  value: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const key = keySchema.parse(input.key);
    const locale = localeSchema.parse(input.locale);
    const value = input.value.trim();

    if (!value) {
      await db.siteCopy.deleteMany({ where: { key, locale } });
      await logActivity({
        userId: session.user.id,
        action: "reset",
        entity: "SiteCopy",
        entityId: `${locale}:${key}`,
      });
      revalidate();
      return undefined;
    }

    const existing = await db.siteCopy.findUnique({
      where: { key_locale: { key, locale } },
    });

    // The slot is guaranteed by keySchema; this is the shape check that keeps
    // a well-meaning edit from breaking a page — a dropped {count}, a missing
    // <tag>, unbalanced braces. next-intl would throw or render a key path at
    // request time, on a page that is already cached.
    const slot = copySlot(key);
    if (slot) {
      const problem = describeCopyProblem(slot, value);
      if (problem) throw new Error(problem);
    }

    if (existing) {
      // Stage it. The published `value` is untouched until publish runs.
      await db.siteCopy.update({
        where: { key_locale: { key, locale } },
        data: { draftValue: value, updatedById: session.user.id },
      });
    } else {
      // A slot with no row yet is still a DRAFT: the visitor keeps reading the
      // shipped words until the surface is published. So `value` (what IS
      // published) holds the shipped default and `draftValue` the owner's
      // words — the board counts the difference as pending, preview renders
      // the draft, publish copies it over, Reset deletes the row. The first
      // version of this branch wrote the words to BOTH columns, which made
      // the first edit of every slot live instantly, bypassing Publish; the
      // 2026-09-04 audit's smoke check (save → visitor unchanged → Publish →
      // live) caught it. `shippedCopy` is null only for a key the catalogue
      // does not know, which keySchema already refuses.
      const shipped = await shippedCopy(key, locale);
      await db.siteCopy.create({
        data: {
          key,
          locale,
          value: shipped ?? value,
          draftValue: value,
          updatedById: session.user.id,
        },
      });
    }

    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: "SiteCopy",
      entityId: `${locale}:${key}`,
      meta: { length: value.length },
    });
    revalidate();
    return undefined;
  });
}

/** Drop one override so the slot falls back to its shipped default. */
export async function resetSiteCopy(input: {
  key: string;
  locale: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const key = keySchema.parse(input.key);
    const locale = localeSchema.parse(input.locale);

    // deleteMany, not delete: resetting an already-default slot is a no-op,
    // not an error.
    await db.siteCopy.deleteMany({ where: { key, locale } });

    await logActivity({
      userId: session.user.id,
      action: "reset",
      entity: "SiteCopy",
      entityId: `${locale}:${key}`,
    });
    revalidate();
    return undefined;
  });
}

/**
 * Reset every override on one surface, for one language.
 *
 * ADMIN-only and confirmed in the UI: this is the one action here that can
 * undo an afternoon of someone else's writing in a single click.
 */
export async function resetCopyGroup(input: {
  keys: string[];
  locale: string;
}): Promise<ActionResult<{ removed: number }>> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const locale = localeSchema.parse(input.locale);
    const keys = input.keys.filter(isCopyKey);
    if (keys.length === 0) return { removed: 0 };

    const { count } = await db.siteCopy.deleteMany({
      where: { locale, key: { in: keys } },
    });

    await logActivity({
      userId: session.user.id,
      action: "reset-group",
      entity: "SiteCopy",
      entityId: locale,
      meta: { removed: count },
    });
    revalidate();
    return { removed: count };
  });
}
