"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { MEDIA_FOLDERS } from "@/components/studio/media/folders";
import { logActivity, snapshotBefore } from "@/lib/activity";
import { findMediaUsages } from "@/lib/media-usages";
import { db } from "@/lib/db";
import { seoFilename, splitFilename } from "@/lib/media-filename";
import { finalizeAsset } from "@/lib/media-ingest";
import {
  ACCEPTED_UPLOAD_TYPES,
  deleteFile,
  guessMediaType,
  putFile,
} from "@/lib/storage";

const STUDIO_PATH = "/studio/media";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB default
const MAX_BYTES_LARGE = 16 * 1024 * 1024; // 16 MB for videos and GLB models

const folderSchema = z.enum(MEDIA_FOLDERS).catch("other");
// A caller ASKING to move or organize into a folder gets no silent fallback —
// `folderSchema` above is lenient because an upload must never be blocked by
// a bad folder value; a deliberate move/replace has no such excuse, and a
// typo'd folder should be refused rather than quietly filed under "other".
const strictFolderSchema = z.enum(MEDIA_FOLDERS);

export type UploadedMedia = {
  id: string;
  url: string;
  pathname: string;
  type: "IMAGE" | "VIDEO" | "MODEL3D" | "DOCUMENT";
  /** True when the bytes were already in the library and the row was reused. */
  duplicate?: boolean;
};

function maxBytesFor(contentType: string): number {
  return contentType.startsWith("video/") || contentType === "model/gltf-binary"
    ? MAX_BYTES_LARGE
    : MAX_BYTES;
}

const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const LOCAL_ROOT = path.join(process.cwd(), "public", "uploads");

/**
 * "Replace file" needs the SAME pathname semantics `putFile` (`@/lib/
 * storage.ts`) already has — same two-driver split, same local root — but the
 * opposite uniqueness rule: `putFile` always mints a fresh pathname (Blob's
 * `addRandomSuffix`, local's `-<uuid>` suffix) so two uploads never collide,
 * while a replace must land at the row's EXISTING pathname so every place
 * that already points at this file's url keeps working without being found
 * and rewritten. `storage.ts` has no "overwrite in place" mode to import —
 * this repo's other exact precedent for one is `catalog-mirror.ts`'s
 * `storeCatalogImage`, which the same driver split for the same reason.
 */
async function overwriteAtPathname(
  data: Buffer,
  pathname: string,
  contentType: string,
): Promise<string> {
  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(pathname, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  }
  const target = path.join(LOCAL_ROOT, pathname);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return `/uploads/${pathname}`;
}

/**
 * Multi-file upload. Per-file failures (unsupported type, oversize,
 * storage error) are collected instead of aborting the batch: any
 * successful subset returns ok:true with the stored rows — the caller
 * compares counts to surface a partial-failure toast. Only a batch in
 * which nothing uploaded returns ok:false, naming the offenders.
 */
export async function uploadMediaFiles(
  formData: FormData,
): Promise<ActionResult<UploadedMedia[]>> {
  const result = await runAction(async () => {
    const session = await requireStaff();

    const folder = folderSchema.parse(formData.get("folder"));
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    const uploaded: UploadedMedia[] = [];
    const failed: string[] = [];

    for (const [index, file] of files.entries()) {
      const ext = ACCEPTED_UPLOAD_TYPES[file.type];
      if (!ext) {
        failed.push(`${file.name} (unsupported type)`);
        continue;
      }
      const limit = maxBytesFor(file.type);
      if (file.size > limit) {
        failed.push(`${file.name} (over ${limit / (1024 * 1024)} MB)`);
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const facts = await finalizeAsset(buffer, file.type);

        // Dedupe before storing anything. The owner WILL upload the same
        // varmala shot four times; four blobs and four rows means four
        // places to fix when the picture changes, and a library nobody can
        // find anything in.
        const existing = await db.media.findUnique({
          where: { checksum: facts.checksum },
          select: { id: true, url: true, pathname: true, type: true },
        });
        if (existing) {
          uploaded.push({
            id: existing.id,
            url: existing.url,
            pathname: existing.pathname,
            type: existing.type,
            duplicate: true,
          });
          continue;
        }

        const base = seoFilename(file.name, folder, index);
        const stored = await putFile(buffer, {
          pathname: `${folder}/${base}${ext}`,
          contentType: file.type,
        });
        const type = guessMediaType(file.type);
        const media = await db.media.create({
          data: {
            url: stored.url,
            pathname: stored.pathname,
            type,
            folder,
            bytes: file.size,
            originalName: splitFilename(file.name).stem.slice(0, 200),
            checksum: facts.checksum,
            width: facts.width,
            height: facts.height,
            blurDataUrl: facts.blurDataUrl,
            dominantHex: facts.dominantHex,
            // What we actually know: a person put this file here. Whether it
            // came out of a camera or a model is theirs to declare — nothing
            // in the bytes says, and guessing would be worse than not knowing.
            provenance: "UPLOAD",
          },
        });
        uploaded.push({
          id: media.id,
          url: media.url,
          pathname: media.pathname,
          type,
        });
      } catch (error) {
        console.error(`Media upload failed for ${file.name}:`, error);
        failed.push(`${file.name} (storage error)`);
      }
    }

    if (uploaded.length > 0) {
      await logActivity({
        userId: session.user.id,
        action: "upload",
        entity: "Media",
        meta: {
          count: uploaded.length,
          folder,
          pathnames: uploaded.map((u) => u.pathname),
          ...(failed.length > 0 ? { failed } : {}),
        },
      });
      revalidatePath(STUDIO_PATH);
    }

    return { uploaded, failed };
  });

  if (!result.ok) return result;

  const { uploaded, failed } = result.data ?? { uploaded: [], failed: [] };
  if (uploaded.length === 0) {
    return {
      ok: false,
      error:
        failed.length > 0
          ? `Nothing was uploaded — ${failed.join(", ")}.`
          : "No files were received.",
    };
  }
  return { ok: true, data: uploaded };
}

const altSchema = z.object({
  id: z.string().min(1),
  alt: z.string().trim().max(300),
});

/**
 * The asset's own description of itself.
 *
 * One per picture, not one per placement: a slot, a product gallery or a
 * landing-page block that has nothing of its own inherits this. Writing the
 * same sentence in four places is how three of them end up stale.
 */
const provenanceSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  provenance: z.enum(["UPLOAD", "BUNDLED", "AI"]),
});

/**
 * Declare where files came from.
 *
 * Upload records what the system can actually observe — a person put this
 * here — and nothing in an image's bytes says whether a model drew it. So the
 * AI mark is the owner's to set, in bulk, because it is almost always a batch
 * of them at once.
 */
export async function setMediaProvenance(
  input: z.input<typeof provenanceSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = provenanceSchema.parse(input);
    const { count } = await db.media.updateMany({
      where: { id: { in: parsed.ids } },
      data: { provenance: parsed.provenance },
    });
    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: "Media",
      meta: { field: "provenance", value: parsed.provenance, count },
    });
    revalidatePath(STUDIO_PATH);
    return undefined;
  });
}

export async function setMediaAlt(
  input: z.input<typeof altSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = altSchema.parse(input);
    await db.media.update({
      where: { id: parsed.id },
      data: { alt: parsed.alt || null },
    });
    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: "Media",
      entityId: parsed.id,
      meta: { field: "alt" },
    });
    revalidatePath(STUDIO_PATH);
    return undefined;
  });
}

const listSchema = z.object({
  folder: z.string().optional(),
  q: z.string().max(120).optional(),
  cursor: z.string().optional(),
  // Batch D · media system: the picker used to force IMAGE unconditionally
  // (docs/transformation-audit.md §10.1's "no ... pickable" gap — a caller
  // wanting a testimonial film or a video block had no way to reach one
  // through this dialog). Default stays IMAGE so every existing call site,
  // none of which passes `type`, is unaffected.
  type: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
});

export type PickerMediaItem = {
  id: string;
  url: string;
  pathname: string;
  type: "IMAGE" | "VIDEO" | "MODEL3D" | "DOCUMENT";
  folder: string;
  /** The asset's own description, so a picker can prefill an alt field. */
  alt: string | null;
  width: number | null;
  height: number | null;
  /** VIDEO only — the frame shown in place of a thumbnail. */
  posterUrl: string | null;
  /** VIDEO only — whole seconds, shown as mono m:ss beside the tile. */
  duration: number | null;
};

/**
 * Paged listing for the media-picker dialog (audit §32): staff-only like
 * every media action, search by pathname. Cursor = last row id. Image-only
 * unless the caller opts into `type: "VIDEO"`.
 */
export async function listMediaForPicker(
  input: z.input<typeof listSchema>,
): Promise<
  ActionResult<{ items: PickerMediaItem[]; nextCursor: string | null }>
> {
  return runAction(async () => {
    await requireStaff();
    const parsed = listSchema.parse(input);
    const take = 30;
    const rows = await db.media.findMany({
      where: {
        ...(parsed.folder ? { folder: parsed.folder } : {}),
        ...(parsed.q
          ? {
              OR: [
                { pathname: { contains: parsed.q, mode: "insensitive" } },
                { originalName: { contains: parsed.q, mode: "insensitive" } },
                { alt: { contains: parsed.q, mode: "insensitive" } },
              ],
            }
          : {}),
        type: parsed.type,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
      take: take + 1,
      select: {
        id: true,
        url: true,
        pathname: true,
        type: true,
        folder: true,
        alt: true,
        width: true,
        height: true,
        posterUrl: true,
        duration: true,
      },
    });
    const hasMore = rows.length > take;
    const items = rows.slice(0, take);
    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  });
}

const deleteSchema = z.array(z.string().min(1)).min(1);

/**
 * Bulk delete. In-use files are refused (ENG-806 / UIUX-605) so cleanup can
 * never break a live gallery, cover or the site chrome; only genuinely
 * orphaned files are removed. Storage removal for those is best effort — a
 * blob that is already gone must never keep its database row alive.
 */
export async function deleteMediaItems(
  ids: string[],
): Promise<ActionResult<{ deleted: number; skipped: string[] }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = deleteSchema.parse(ids);

    const rows = await db.media.findMany({
      where: { id: { in: parsed } },
      select: { id: true, url: true, pathname: true, isDemo: true },
    });

    const inUse = await findMediaUsages(rows.map((r) => r.url));
    const deletable = rows.filter((r) => !inUse.has(r.url));
    const skipped = rows
      .filter((r) => inUse.has(r.url))
      .map((r) => r.pathname.split("/").pop() ?? r.pathname);

    for (const row of deletable) {
      // A Content Lab demo row's `pathname` was never written to storage —
      // it names a fixture, not a blob — so calling deleteFile for it would
      // either 404 harmlessly (best-effort, already swallowed below) or, on
      // local disk, throw trying to unlink a path that was never a real
      // file. Skipping it here is the accurate description of what happens,
      // not just a safe no-op.
      if (row.isDemo) continue;
      await deleteFile(row.pathname).catch((error) => {
        console.error(`Storage delete failed for ${row.pathname}:`, error);
      });
    }

    if (deletable.length > 0) {
      await db.media.deleteMany({
        where: { id: { in: deletable.map((r) => r.id) } },
      });
      await logActivity({
        userId: session.user.id,
        action: deletable.length > 1 ? "bulk-delete" : "delete",
        entity: "Media",
        meta: {
          count: deletable.length,
          pathnames: deletable.map((r) => r.pathname),
          ...(skipped.length > 0 ? { skippedInUse: skipped } : {}),
        },
      });
      revalidatePath(STUDIO_PATH);
    }

    return { deleted: deletable.length, skipped };
  });
}

const TAG_MAX = 32;
const TAGS_MAX = 20;
const tagsSchema = z.array(z.string().trim().min(1).max(TAG_MAX)).max(TAGS_MAX);

const updateMetaSchema = z.object({
  id: z.string().min(1),
  alt: z.string().trim().max(300).optional(),
  caption: z.string().trim().max(500).optional(),
  tags: tagsSchema.optional(),
  favourite: z.boolean().optional(),
});

/**
 * Full metadata edit for one file — the detail drawer's Save, and a bulk
 * favourite toggle's one-call-per-id fan-out (there is no bulk-favourite
 * action; the selection sizes this runs over are small enough that N calls
 * costs nothing a dedicated endpoint would meaningfully improve on).
 *
 * Every field is a PARTIAL update: only a key the caller actually passed is
 * written, checked on the raw input rather than the parsed one so an
 * explicit `alt: ""` (clear the description) is distinguishable from `alt`
 * simply not being part of this call.
 */
export async function updateMediaMeta(
  input: z.input<typeof updateMetaSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = updateMetaSchema.parse(input);
    const raw = input as Record<string, unknown>;

    const before = await db.media.findUnique({
      where: { id: parsed.id },
      select: { alt: true, caption: true, tags: true, favourite: true },
    });
    if (!before) throw new Error("That file no longer exists.");

    const data: {
      alt?: string | null;
      caption?: string | null;
      tags?: string[];
      favourite?: boolean;
    } = {};
    if ("alt" in raw) data.alt = parsed.alt || null;
    if ("caption" in raw) data.caption = parsed.caption || null;
    if ("tags" in raw) data.tags = parsed.tags ?? [];
    if ("favourite" in raw) data.favourite = parsed.favourite ?? false;

    if (Object.keys(data).length === 0) return undefined;

    await db.media.update({ where: { id: parsed.id }, data });
    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: "Media",
      entityId: parsed.id,
      meta: {
        fields: Object.keys(data),
        before: snapshotBefore(before, ["alt", "caption", "favourite"]),
      },
    });
    revalidatePath(STUDIO_PATH);
    return undefined;
  });
}

const moveSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  folder: strictFolderSchema,
});

/** Bulk re-file into a different one of the six fixed folders. */
export async function moveMedia(
  ids: string[],
  folder: string,
): Promise<ActionResult<{ moved: number }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = moveSchema.parse({ ids, folder });
    const { count } = await db.media.updateMany({
      where: { id: { in: parsed.ids } },
      data: { folder: parsed.folder },
    });
    await logActivity({
      userId: session.user.id,
      action: "move",
      entity: "Media",
      meta: { count, folder: parsed.folder, ids: parsed.ids },
    });
    if (count > 0) revalidatePath(STUDIO_PATH);
    return { moved: count };
  });
}

const bulkAltSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  alt: z.string().trim().max(300),
});

/**
 * The SAME description on every selected picture — the sweep tool for a
 * batch that is genuinely one subject shot several times (a set of angle
 * shots of one commission, say), not a substitute for per-picture alt text.
 */
export async function bulkUpdateAlt(
  ids: string[],
  alt: string,
): Promise<ActionResult<{ updated: number }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = bulkAltSchema.parse({ ids, alt });
    const { count } = await db.media.updateMany({
      where: { id: { in: parsed.ids }, type: "IMAGE" },
      data: { alt: parsed.alt || null },
    });
    await logActivity({
      userId: session.user.id,
      action: "bulk-update",
      entity: "Media",
      meta: { field: "alt", count, ids: parsed.ids },
    });
    if (count > 0) revalidatePath(STUDIO_PATH);
    return { updated: count };
  });
}

/**
 * Swap the bytes behind an existing row WITHOUT changing its url — every
 * place that already points at this file (a product gallery entry, a site-
 * image slot override, a landing-page block) keeps working with no re-select
 * needed. `overwriteAtPathname` above is what makes that possible: same
 * pathname in, same pathname out, only the stored bytes change.
 *
 * Refuses a replacement that changes the asset's TYPE (an image cannot
 * become a video in place) — everything downstream of `Media.type` assumes
 * it is stable for a row's lifetime. A same-family extension mismatch (a
 * .jpg replaced with .png bytes) is allowed: the URL's trailing extension is
 * cosmetic, `Content-Type` on the stored object is what a browser and
 * next/image actually trust.
 */
export async function replaceMediaFile(
  id: string,
  formData: FormData,
): Promise<ActionResult<UploadedMedia>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsedId = z.string().min(1).parse(id);

    const existing = await db.media.findUnique({ where: { id: parsedId } });
    if (!existing) throw new Error("That file no longer exists.");

    const file = formData.get("file");
    if (!(file instanceof File))
      throw new Error("No replacement file was received.");

    const ext = ACCEPTED_UPLOAD_TYPES[file.type];
    if (!ext)
      throw new Error(`${file.name || "That file"} is not a supported type.`);

    const newType = guessMediaType(file.type);
    if (newType !== existing.type) {
      throw new Error(
        `The replacement must be the same kind of file — this row is ${existing.type.toLowerCase()}.`,
      );
    }

    const limit = maxBytesFor(file.type);
    if (file.size > limit) {
      throw new Error(`File is over the ${limit / (1024 * 1024)} MB limit.`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const facts = await finalizeAsset(buffer, file.type);
    const storedUrl = await overwriteAtPathname(
      buffer,
      existing.pathname,
      file.type,
    );

    const before = snapshotBefore(existing, [
      "bytes",
      "width",
      "height",
      "checksum",
      "blurDataUrl",
      "dominantHex",
    ]);
    const updated = await db.media.update({
      where: { id: parsedId },
      data: {
        url: storedUrl,
        bytes: buffer.length,
        width: facts.width,
        height: facts.height,
        checksum: facts.checksum,
        blurDataUrl: facts.blurDataUrl,
        dominantHex: facts.dominantHex,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "replace",
      entity: "Media",
      entityId: parsedId,
      meta: { pathname: existing.pathname, before },
    });
    revalidatePath(STUDIO_PATH);
    return {
      id: updated.id,
      url: updated.url,
      pathname: updated.pathname,
      type: updated.type,
    };
  });
}

/**
 * Attach a poster frame to a VIDEO row. The JPEG itself is captured
 * client-side — `media-detail-drawer.tsx` draws the current frame of a
 * playing `<video>` onto a `<canvas>` at 1s and posts the result here — and
 * is stored as its own IMAGE row in the video's folder, exactly like any
 * other upload, rather than as a bare url on the video row: it belongs in the
 * library (findable, deletable, usage-tracked) like every other picture.
 * `Media.posterUrl` then points at that row's url.
 */
export async function setVideoPoster(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ posterUrl: string }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsedId = z.string().min(1).parse(id);

    const video = await db.media.findUnique({ where: { id: parsedId } });
    if (!video) throw new Error("That video no longer exists.");
    if (video.type !== "VIDEO")
      throw new Error("Only a video can have a poster.");

    const file = formData.get("file");
    if (!(file instanceof File))
      throw new Error("No poster image was received.");
    if (file.type !== "image/jpeg") {
      throw new Error("The poster must be a JPEG frame capture.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      throw new Error(
        `Poster is over the ${MAX_BYTES / (1024 * 1024)} MB limit.`,
      );
    }

    const facts = await finalizeAsset(buffer, "image/jpeg");

    // Same dedupe discipline as a normal upload: a poster captured twice from
    // the same clip at the same second has identical bytes, and `checksum`
    // is unique — reuse the row rather than fail the whole action on it.
    const existing = await db.media.findUnique({
      where: { checksum: facts.checksum },
      select: { id: true, url: true },
    });

    let posterUrl: string;
    if (existing) {
      posterUrl = existing.url;
    } else {
      const base = seoFilename(
        `${video.originalName ?? "video"}-poster`,
        video.folder,
        0,
      );
      const stored = await putFile(buffer, {
        pathname: `${video.folder}/${base}.jpg`,
        contentType: "image/jpeg",
      });
      const posterMedia = await db.media.create({
        data: {
          url: stored.url,
          pathname: stored.pathname,
          type: "IMAGE",
          folder: video.folder,
          bytes: buffer.length,
          originalName: splitFilename(
            `${video.originalName ?? "video"}-poster`,
          ).stem.slice(0, 200),
          checksum: facts.checksum,
          width: facts.width,
          height: facts.height,
          blurDataUrl: facts.blurDataUrl,
          dominantHex: facts.dominantHex,
          provenance: "UPLOAD",
        },
      });
      posterUrl = posterMedia.url;
    }

    const durationRaw = formData.get("durationSeconds");
    const durationSeconds =
      typeof durationRaw === "string" && durationRaw.trim() !== ""
        ? Math.round(Number(durationRaw))
        : null;

    await db.media.update({
      where: { id: parsedId },
      data: {
        posterUrl,
        ...(durationSeconds !== null && Number.isFinite(durationSeconds)
          ? { duration: durationSeconds }
          : {}),
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "set-poster",
      entity: "Media",
      entityId: parsedId,
      meta: { posterUrl, reused: Boolean(existing) },
    });
    revalidatePath(STUDIO_PATH);
    return { posterUrl };
  });
}
