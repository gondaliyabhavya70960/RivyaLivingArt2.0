"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { MEDIA_FOLDERS } from "@/components/studio/media/folders";
import { logActivity } from "@/lib/activity";
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
};

/**
 * Paged listing for the media-picker dialog (audit §32): staff-only like
 * every media action, image-focused search by pathname. Cursor = last row id.
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
        type: "IMAGE",
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
      select: { id: true, url: true, pathname: true },
    });

    const inUse = await findMediaUsages(rows.map((r) => r.url));
    const deletable = rows.filter((r) => !inUse.has(r.url));
    const skipped = rows
      .filter((r) => inUse.has(r.url))
      .map((r) => r.pathname.split("/").pop() ?? r.pathname);

    for (const row of deletable) {
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
