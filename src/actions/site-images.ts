"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { SITE_IMAGES_TAG } from "@/lib/site-images-server";
import { isSiteImageKey, SITE_IMAGE_FALLBACKS } from "@/lib/site-images";
import {
  blobStorageConfigured,
  importBundledSiteImages,
  type ImportDefaultsSummary,
} from "@/lib/site-images-import";

/**
 * Site-image slot actions — the write half of /studio/site-images.
 *
 * Every write revalidates the `site-images` tag rather than a path: these
 * pictures appear across the whole storefront (the mega menu is in the layout),
 * so invalidating one route would leave the rest serving the old image until
 * their own TTL expired.
 */

const STUDIO_PATH = "/studio/site-images";

const keySchema = z.string().refine(isSiteImageKey, "Unknown image slot");

/**
 * A slot's staged changes, defensively — merged into rather than replaced, so
 * setting a focal point does not silently discard a staged phone crop.
 */
function readDraft(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

/**
 * A slot value must be something `next/image` can actually render.
 *
 * Site-root paths are always fine (the bundled defaults and the local upload
 * driver both produce them). A remote URL has to be a host in
 * `next.config.ts`'s `remotePatterns` — Vercel Blob, Cloudinary, the owner's
 * catalogue host — because the optimizer throws at REQUEST time on anything
 * else, which would turn a typo in this form into a 500 on the storefront.
 * Uploading or picking from the library always yields an accepted host, so
 * this only ever catches a hand-pasted URL.
 */
const urlSchema = z
  .string()
  .trim()
  .min(1, "Pick an image first")
  .refine(
    (v) => v.startsWith("/") || isOptimizableImageSrc(v),
    "Upload the image or pick it from the library — a URL from another site cannot be rendered.",
  );

function revalidate() {
  revalidateTag(SITE_IMAGES_TAG, "max");
  revalidatePath(STUDIO_PATH);
}

/** Point one slot at an image. */
export async function setSiteImage(input: {
  key: string;
  url: string;
  mediaId?: string | null;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const key = keySchema.parse(input.key);
    const url = urlSchema.parse(input.url);
    const mediaId = input.mediaId?.trim() || null;

    const existing = await db.siteImage.findUnique({ where: { key } });
    if (existing) {
      // Stage it — see the Phase E note in actions/site-copy.ts. The published
      // `url` is untouched until the surface is published.
      await db.siteImage.update({
        where: { key },
        data: { draft: { ...readDraft(existing.draft), url }, mediaId },
      });
    } else {
      // A slot with no row is still PUBLISHED — as its bundled default, which
      // is what a visitor is looking at. So the first edit stages like every
      // other: `url` holds the default that stays live, `draft` holds the
      // owner's choice until the surface is published.
      //
      // This branch used to write the owner's pick into BOTH halves, which
      // put a new photograph on the storefront the instant they pressed Save
      // — no preview, no Publish, no way to stage it. Its copy twin had the
      // same bug and was fixed in 38413f2; this is that fix's sibling, found
      // by the defect sweep that went looking for exactly this shape.
      await db.siteImage.create({
        data: { key, url: SITE_IMAGE_FALLBACKS[key], mediaId, draft: { url } },
      });
    }

    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: "SiteImage",
      entityId: key,
      meta: { url },
    });
    revalidate();
    return undefined;
  });
}

/**
 * Set or clear the separate crop used below 768px.
 *
 * A slot with no row yet cannot have a mobile crop on its own — the desktop
 * image would still be the bundled default, and a row carrying only a mobile
 * URL would be a half-configured slot. So this upserts with the resolved
 * desktop URL, which for an untouched slot is its bundled file.
 */
export async function setSiteImageMobile(input: {
  key: string;
  /** Empty string clears the mobile crop and renders the desktop file again. */
  url: string;
  mediaId?: string | null;
  /** The slot's current desktop URL, needed when no row exists yet. */
  desktopUrl: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const key = keySchema.parse(input.key);
    const desktopUrl = urlSchema.parse(input.desktopUrl);
    const clearing = !input.url.trim();
    const mobileUrl = clearing ? null : urlSchema.parse(input.url);
    const mobileMediaId = clearing ? null : input.mediaId?.trim() || null;

    const existing = await db.siteImage.findUnique({ where: { key } });
    await db.siteImage.upsert({
      where: { key },
      create: {
        key,
        url: desktopUrl,
        mobileMediaId,
        draft: { url: desktopUrl, mobileUrl },
      },
      update: {
        mobileMediaId,
        draft: { ...readDraft(existing?.draft), mobileUrl },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: clearing ? "reset-mobile" : "update-mobile",
      entity: "SiteImage",
      entityId: key,
      meta: clearing ? {} : { mobileUrl },
    });
    revalidate();
    return undefined;
  });
}

/**
 * Move the crop so the subject survives it.
 *
 * A 4:5 slot filled with a 16:9 photograph crops the centre, which for a maker
 * portrait is a torso. Values are 0–1 on each axis and map straight to
 * `object-position`; (0.5, 0.5) is CSS's own default, so it reads as "reset".
 */
export async function setSiteImageFocal(input: {
  key: string;
  x: number;
  y: number;
  /** The slot's current desktop URL, needed when no row exists yet. */
  desktopUrl: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const key = keySchema.parse(input.key);
    const desktopUrl = urlSchema.parse(input.desktopUrl);
    const focal = z.number().min(0).max(1);
    const focalX = focal.parse(input.x);
    const focalY = focal.parse(input.y);

    const existing = await db.siteImage.findUnique({ where: { key } });
    await db.siteImage.upsert({
      where: { key },
      create: { key, url: desktopUrl, draft: { url: desktopUrl, focalX, focalY } },
      update: { draft: { ...readDraft(existing?.draft), focalX, focalY } },
    });

    await logActivity({
      userId: session.user.id,
      action: "update-focal",
      entity: "SiteImage",
      entityId: key,
      meta: { focalX, focalY },
    });
    revalidate();
    return undefined;
  });
}

/** Drop the override so the slot falls back to its bundled default. */
export async function resetSiteImage(key: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const slotKey = keySchema.parse(key);

    // deleteMany, not delete: resetting an already-default slot is a no-op,
    // not an error.
    await db.siteImage.deleteMany({ where: { key: slotKey } });

    await logActivity({
      userId: session.user.id,
      action: "reset",
      entity: "SiteImage",
      entityId: slotKey,
    });
    revalidate();
    return undefined;
  });
}

/**
 * Copy every bundled default into storage (Vercel Blob in production, the
 * local disk driver in development) and point its slot at the uploaded copy.
 *
 * This is the "get my images off the filesystem and into the library" button.
 * Afterwards every slot is backed by a Media row the owner can see, swap and
 * re-use from the picker, and the files in `public/media` are only the safety
 * net behind a slot that gets reset.
 *
 * The work itself lives in `@/lib/site-images-import` because the deploy
 * bootstrap runs the same routine, so a new environment comes up Blob-backed
 * without anyone having to log in and press this. Idempotent either way: a
 * slot that already has an override is skipped.
 */
export async function importBundledDefaults(): Promise<
  ActionResult<ImportDefaultsSummary>
> {
  // Not wrapped in runAction: that collapses every failure to "Something went
  // wrong", and the one failure worth explaining here needs its own sentence.
  // Same shape as deleteTags in actions/blog.ts.
  let session;
  try {
    session = await requireStaff(["ADMIN"]);
  } catch {
    return { ok: false, error: "You are not allowed to do that." };
  }

  // Without a Blob token `putFile` falls back to the local disk driver, which
  // on a serverless function writes into a filesystem discarded when the
  // invocation ends: the upload would appear to succeed and every slot it
  // touched would then point at a URL serving nothing. Refuse, and say what
  // is missing rather than corrupting sixty-two slots.
  if (!blobStorageConfigured()) {
    return {
      ok: false,
      error:
        "Blob storage is not connected for this environment, so an import would save files that immediately disappear. Add a Vercel Blob store to the project (it sets BLOB_READ_WRITE_TOKEN) and redeploy, then try again.",
    };
  }

  try {
    const summary = await importBundledSiteImages(db);
    await logActivity({
      userId: session.user.id,
      action: "import-defaults",
      entity: "SiteImage",
      meta: { ...summary },
    });
    revalidate();
    return { ok: true, data: summary };
  } catch (error) {
    console.error("Site-image import failed:", error);
    return { ok: false, error: "The import did not finish. Please try again." };
  }
}
