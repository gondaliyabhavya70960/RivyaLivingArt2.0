import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PrismaClient } from "@/generated/prisma/client";
import { SITE_IMAGE_SLOTS } from "@/lib/site-images";
import { guessMediaType, putFile } from "@/lib/storage";
import { blurFor } from "@/lib/lqip";

/**
 * Copy the bundled site-image defaults into storage and point their slots at
 * the uploaded copies.
 *
 * Shared by the two callers that need it: the "Import bundled images" button
 * on /studio/site-images, and the deploy bootstrap (prisma/bootstrap.ts) so a
 * new environment ends up Blob-backed without anyone having to log in and
 * press it. Deliberately NOT a server action and NOT `server-only` — the
 * bootstrap is a plain tsx script, not a request.
 *
 * Callers own the guards: the studio action requires an ADMIN session, and the
 * bootstrap requires a real Blob token (see `blobStorageConfigured`).
 */

export type ImportDefaultsSummary = {
  uploaded: number;
  skipped: number;
  failed: string[];
};

/** Extension → MIME for the bundled defaults. Mirrors ACCEPTED_UPLOAD_TYPES. */
const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/**
 * Whether storage will actually reach Vercel Blob rather than the local disk
 * driver. The bootstrap MUST check this: a build container's filesystem is
 * thrown away when the build ends, so importing without a token would write
 * `/uploads/…` URLs into the production database that resolve to nothing.
 */
export const blobStorageConfigured = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/**
 * Whether a bundled default was drawn by a model or taken with a camera.
 *
 * The §15.4 masters under `public/media/v3` were generated through the
 * Higgsfield MCP prompt by prompt and are recorded that way in
 * `docs/media-v3-manifest.json`. Everything else this repository ships is
 * photography — the maker's hands (§15.2 is explicit that the maker is never
 * AI) and the process video with its poster.
 *
 * `public/redesign` is the SECOND generated set and counts the same way. The
 * Liquid Luxury brand assets (`docs/reference-design/awwwards-redesign-spec.md` §4, "Delivered
 * Asset Suite — generated for this redesign") and the Drive catalog library
 * under `catalog/` are models' work end to end. Classifying them BUNDLED would
 * have told the Studio's §12.5 provenance filter that fourteen generated
 * pictures were photographs — the exact claim that filter exists to make
 * checkable — so the prefix is listed here rather than left to the default.
 *
 * The path is the honest test because the path is what the manifest is keyed
 * on. Exported so the rule can be asserted rather than trusted.
 */
const AI_PREFIXES = ["/media/v3/", "/redesign/"];

export function bundledProvenance(file: string): "AI" | "BUNDLED" {
  return AI_PREFIXES.some((prefix) => file.startsWith(prefix))
    ? "AI"
    : "BUNDLED";
}

export async function importBundledSiteImages(
  db: PrismaClient,
): Promise<ImportDefaultsSummary> {
  const existing = new Set(
    (await db.siteImage.findMany({ select: { key: true } })).map((r) => r.key),
  );

  // One upload per distinct FILE, not per slot: twenty-one files back
  // sixty-two slots, and uploading the same bytes repeatedly would be
  // eleven blobs the owner then has to recognise as the same picture.
  const byFile = new Map<string, string[]>();
  for (const slot of SITE_IMAGE_SLOTS) {
    if (existing.has(slot.key)) continue;
    byFile.set(slot.fallback, [...(byFile.get(slot.fallback) ?? []), slot.key]);
  }

  const summary: ImportDefaultsSummary = {
    uploaded: 0,
    skipped: existing.size,
    failed: [],
  };
  /** Distinct failure messages → how many files hit each. */
  const reasons = new Map<string, number>();

  for (const [file, keys] of byFile) {
    try {
      // `file` comes from the registry, never from a request — but resolve and
      // re-check anyway so a future edit cannot escape public/.
      const publicRoot = path.join(process.cwd(), "public");
      const abs = path.join(publicRoot, file);
      if (!abs.startsWith(publicRoot + path.sep)) {
        throw new Error("outside public/");
      }
      const contentType = CONTENT_TYPES[path.posix.extname(file)];
      if (!contentType) throw new Error("unsupported type");

      const bytes = await readFile(abs);
      const stored = await putFile(bytes, {
        pathname: `site/${path.posix.basename(file)}`,
        contentType,
      });
      const media = await db.media.create({
        data: {
          url: stored.url,
          pathname: stored.pathname,
          type: guessMediaType(contentType),
          folder: "site",
          bytes: bytes.byteLength,
          provenance: bundledProvenance(file),
          // Carry the bundled LQIP across with the bytes. `blurFor` is keyed
          // on the PUBLIC path, and this import is the moment that path stops
          // being the slot's url — from here the slot points at Blob storage,
          // where `blurFor` finds nothing and `blurForMany` falls back to this
          // column. Without this line every site image silently loses its
          // placeholder the first time an owner presses "Import bundled
          // images", or the first time bootstrap runs it on a fresh deploy:
          // the blur would work everywhere except production.
          blurDataUrl: blurFor(file) ?? null,
        },
      });

      await db.siteImage.createMany({
        data: keys.map((key) => ({ key, url: stored.url, mediaId: media.id })),
        skipDuplicates: true,
      });
      summary.uploaded += 1;
    } catch (error) {
      // One unreadable file must not strand the other twenty. Record the
      // MESSAGE, not the Error: when the whole set fails for one reason — a
      // private store, an expired token — twenty-five identical stack traces
      // bury the one sentence that explains it.
      const message = error instanceof Error ? error.message : String(error);
      reasons.set(message, (reasons.get(message) ?? 0) + 1);
      summary.failed.push(path.posix.basename(file));
    }
  }

  // Say why, once per distinct cause. This is the line worth reading.
  for (const [message, count] of reasons) {
    console.error(
      `Site-image import: ${count} file(s) failed — ${message}`,
    );
  }

  return summary;
}
