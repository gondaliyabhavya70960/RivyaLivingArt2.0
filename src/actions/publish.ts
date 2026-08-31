"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { locales } from "@/i18n/config";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  buildPublishReport,
  summarisePublish,
  type PublishReport,
  type StagedCopy,
  type StagedImage,
} from "@/lib/publish";
import { COPY_SLOTS, copySlot } from "@/lib/site-copy";
import { SITE_COPY_TAG } from "@/lib/site-copy-server";
import {
  SITE_IMAGE_SLOTS,
  siteImageSlot,
  type SiteImageKey,
} from "@/lib/site-images";
import { SITE_IMAGES_TAG } from "@/lib/site-images-server";

/**
 * Publishing — promoting a surface's staged edits to live, in one step.
 *
 * **Scope is a surface, not a field.** Both registries already group their
 * slots by the page they appear on ("Homepage", "About", …), so "publish the
 * About page" is a query rather than a new concept, and an owner rewriting a
 * page releases it as one change rather than as forty.
 *
 * The whole promotion is one transaction. A half-published page — new headline
 * over the old photograph — is worse than either version.
 */

const STUDIO_PATH = "/studio/site-copy";

/** The copy and image slots that belong to one surface. */
function slotsForSurface(surface: string) {
  return {
    copyKeys: COPY_SLOTS.filter((s) => s.group === surface).map((s) => s.key),
    imageKeys: SITE_IMAGE_SLOTS.filter((s) => s.group === surface).map(
      (s) => s.key,
    ),
  };
}

/** Everything staged on one surface, resolved into the shape the rules take. */
async function readStaged(surface: string) {
  const { copyKeys, imageKeys } = slotsForSurface(surface);

  const [copyRows, imageRows] = await Promise.all([
    copyKeys.length
      ? db.siteCopy.findMany({
          where: { key: { in: copyKeys }, draftValue: { not: null } },
        })
      : [],
    imageKeys.length
      ? db.siteImage.findMany({
          where: { key: { in: imageKeys }, draft: { not: Prisma.DbNull } },
        })
      : [],
  ]);

  const copy: StagedCopy[] = [];
  for (const row of copyRows) {
    const slot = copySlot(row.key);
    // Only a real change counts: a draft equal to the published value is
    // "reset to what it already was" and should not appear as pending work.
    if (!slot || !row.draftValue || row.draftValue === row.value) continue;
    copy.push({ slot, locale: row.locale, value: row.draftValue });
  }

  // Alt text for the images being published — resolved AFTER the copy
  // promotion this same publish will perform, because alt lives in SiteCopy
  // and an owner who adds a description and publishes in one step must not be
  // blocked by the description they just wrote.
  const stagedAltByKey = new Map(
    copy
      .filter((c) => c.locale === "en")
      .map((c) => [c.slot.key, c.value] as const),
  );

  const images: StagedImage[] = [];
  for (const row of imageRows) {
    if (!isKnownImageKey(row.key)) continue;
    const slot = siteImageSlot(row.key);
    const draft = row.draft as Record<string, unknown> | null;
    const url =
      typeof draft?.url === "string" && draft.url.trim() ? draft.url : row.url;

    let alt: string | null = null;
    if (slot.altKey) {
      const staged = stagedAltByKey.get(slot.altKey);
      if (staged !== undefined) alt = staged;
      else {
        const published = await db.siteCopy.findUnique({
          where: { key_locale: { key: slot.altKey, locale: "en" } },
          select: { value: true },
        });
        // No row means the slot is using the shipped catalogue wording, which
        // is present for every altKey — so absence here is "not overridden",
        // never "missing".
        alt = published?.value ?? "shipped";
      }
    }
    images.push({ slot, url, alt });
  }

  return { copy, images, copyRows, imageRows };
}

function isKnownImageKey(key: string): key is SiteImageKey {
  return SITE_IMAGE_SLOTS.some((s) => s.key === key);
}

/** What is waiting to go live on one surface, and what would stop it. */
export async function getPublishReport(
  surface: string,
): Promise<ActionResult<PublishReport>> {
  return runAction(async () => {
    await requireStaff();
    const { copy, images } = await readStaged(surface);
    return buildPublishReport(copy, images);
  });
}

/**
 * Promote everything staged on one surface.
 *
 * Snapshots the state being REPLACED first, so a revision always describes
 * what was overwritten. Then copies draft → live and clears the draft, in one
 * transaction, and expires both content tags.
 */
export async function publishSurface(
  surface: string,
): Promise<ActionResult<{ published: number }>> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);

    const { copy, images, copyRows, imageRows } = await readStaged(surface);
    const report = buildPublishReport(copy, images);
    if (report.blocking.length) {
      throw new Error(
        `${report.blocking[0].where}: ${report.blocking[0].message}`,
      );
    }
    if (copy.length === 0 && images.length === 0) {
      return { published: 0 };
    }

    const payload = {
      copy: Object.fromEntries(
        copyRows.map((r) => [`${r.key}::${r.locale}`, r.value]),
      ),
      images: Object.fromEntries(
        imageRows.map((r) => [
          r.key,
          {
            url: r.url,
            mobileUrl: r.mobileUrl,
            focalX: r.focalX,
            focalY: r.focalY,
          },
        ]),
      ),
    };

    await db.$transaction([
      db.contentRevision.create({
        data: {
          surface,
          payload,
          summary: summarisePublish(copy, images),
          authorId: session.user.id,
        },
      }),
      ...copyRows.map((r) =>
        db.siteCopy.update({
          where: { key_locale: { key: r.key, locale: r.locale } },
          data: { value: r.draftValue ?? r.value, draftValue: null },
        }),
      ),
      ...imageRows.map((r) => {
        const draft = (r.draft ?? {}) as Record<string, unknown>;
        return db.siteImage.update({
          where: { key: r.key },
          data: {
            url: typeof draft.url === "string" ? draft.url : r.url,
            mobileUrl:
              "mobileUrl" in draft
                ? ((draft.mobileUrl as string | null) ?? null)
                : r.mobileUrl,
            focalX: typeof draft.focalX === "number" ? draft.focalX : r.focalX,
            focalY: typeof draft.focalY === "number" ? draft.focalY : r.focalY,
            draft: Prisma.DbNull,
          },
        });
      }),
    ]);

    await logActivity({
      userId: session.user.id,
      action: "publish",
      entity: "Surface",
      entityId: surface,
      meta: { copy: copy.length, images: images.length },
    });

    revalidateTag(SITE_COPY_TAG, "max");
    revalidateTag(SITE_IMAGES_TAG, "max");
    revalidatePath(STUDIO_PATH);
    return { published: copy.length + images.length };
  });
}

/** Throw away everything staged on one surface, leaving the live site alone. */
export async function discardSurfaceDraft(
  surface: string,
): Promise<ActionResult<{ discarded: number }>> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);
    const { copyKeys, imageKeys } = slotsForSurface(surface);

    const [copyResult, imageResult] = await db.$transaction([
      db.siteCopy.updateMany({
        where: { key: { in: copyKeys }, draftValue: { not: null } },
        data: { draftValue: null },
      }),
      db.siteImage.updateMany({
        where: { key: { in: imageKeys }, draft: { not: Prisma.DbNull } },
        data: { draft: Prisma.DbNull },
      }),
    ]);

    await logActivity({
      userId: session.user.id,
      action: "discard-draft",
      entity: "Surface",
      entityId: surface,
      meta: { copy: copyResult.count, images: imageResult.count },
    });
    revalidateTag(SITE_COPY_TAG, "max");
    revalidateTag(SITE_IMAGES_TAG, "max");
    revalidatePath(STUDIO_PATH);
    return { discarded: copyResult.count + imageResult.count };
  });
}

/**
 * Restore an earlier version — INTO THE DRAFT, never straight to live.
 *
 * A mis-clicked restore is then recoverable by discarding the draft, and the
 * owner sees what they are about to put back before a visitor does.
 */
export async function restoreRevision(
  revisionId: string,
): Promise<ActionResult<{ staged: number }>> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const revision = await db.contentRevision.findUniqueOrThrow({
      where: { id: revisionId },
    });

    const payload = revision.payload as {
      copy?: Record<string, string>;
      images?: Record<string, Record<string, unknown>>;
    };

    let staged = 0;
    for (const [composite, value] of Object.entries(payload.copy ?? {})) {
      const [key, locale] = composite.split("::");
      if (!key || !locale || !(locales as readonly string[]).includes(locale)) {
        continue;
      }
      const exists = await db.siteCopy.findUnique({
        where: { key_locale: { key, locale } },
      });
      if (!exists) continue;
      await db.siteCopy.update({
        where: { key_locale: { key, locale } },
        data: { draftValue: value },
      });
      staged += 1;
    }

    for (const [key, snapshot] of Object.entries(payload.images ?? {})) {
      const exists = await db.siteImage.findUnique({ where: { key } });
      if (!exists) continue;
      await db.siteImage.update({
        where: { key },
        // The snapshot came out of a Json column and goes back into one; the
        // cast is the round trip Prisma's input type cannot see through.
        data: { draft: snapshot as Prisma.InputJsonValue },
      });
      staged += 1;
    }

    await logActivity({
      userId: session.user.id,
      action: "restore",
      entity: "ContentRevision",
      entityId: revision.id,
      meta: { surface: revision.surface, staged },
    });
    revalidateTag(SITE_COPY_TAG, "max");
    revalidateTag(SITE_IMAGES_TAG, "max");
    revalidatePath(STUDIO_PATH);
    return { staged };
  });
}
