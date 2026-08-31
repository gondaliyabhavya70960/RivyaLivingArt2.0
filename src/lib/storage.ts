import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredFile = { url: string; pathname: string };

/**
 * Storage abstraction: Vercel Blob in production (BLOB_READ_WRITE_TOKEN
 * present — auto-injected by the Vercel Blob integration), local disk
 * under public/uploads for credential-less development. Media rows store
 * `pathname`, so the driver can always delete by it.
 */
const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const LOCAL_ROOT = path.join(process.cwd(), "public", "uploads");

function sanitizePathname(pathname: string): string {
  const clean = pathname.replace(/^\/+/, "").replaceAll("\\", "/");
  if (clean.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) {
    throw new Error(`Invalid storage pathname: ${pathname}`);
  }
  return clean;
}

export async function putFile(
  data: Buffer,
  {
    pathname,
    contentType = "application/octet-stream",
  }: { pathname: string; contentType?: string },
): Promise<StoredFile> {
  const clean = sanitizePathname(pathname);

  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(clean, data, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });
    return { url: blob.url, pathname: blob.pathname };
  }

  // Local driver: keep pathnames unique the same way Blob does.
  const ext = path.posix.extname(clean);
  const unique = `${clean.slice(0, clean.length - ext.length)}-${crypto
    .randomUUID()
    .slice(0, 8)}${ext}`;
  const target = path.join(LOCAL_ROOT, unique);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return { url: `/uploads/${unique}`, pathname: unique };
}

export async function deleteFile(pathname: string): Promise<void> {
  const clean = sanitizePathname(pathname);

  if (blobEnabled()) {
    const { del } = await import("@vercel/blob");
    await del(clean).catch((e) => {
      console.error(`Blob delete failed for ${clean}:`, e);
    });
    return;
  }

  await unlink(path.join(LOCAL_ROOT, clean)).catch(() => {
    // Already gone — deleting media must never crash the request.
  });
}

export function guessMediaType(
  contentType: string,
): "IMAGE" | "VIDEO" | "MODEL3D" | "DOCUMENT" {
  if (contentType.startsWith("image/")) return "IMAGE";
  if (contentType.startsWith("video/")) return "VIDEO";
  if (contentType.includes("gltf") || contentType.includes("usd")) return "MODEL3D";
  return "DOCUMENT";
}

/**
 * Extensions we accept in the studio media library. SVG is deliberately
 * EXCLUDED (SEC-003): an SVG can embed <script>/onload and, when served
 * same-origin, becomes stored XSS. If SVG is ever needed, sanitize it with
 * DOMPurify (SVG profile) on upload and serve it as an attachment.
 */
export const ACCEPTED_UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "model/gltf-binary": ".glb",
  "model/vnd.usdz+zip": ".usdz",
};
