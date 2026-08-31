"use client";

/**
 * Client-side reference-image upload pipeline for the public order forms:
 * validate → compress → upload. Prefers the Vercel Blob client-upload
 * path (files go straight to Blob, bypassing the 4.5MB function body
 * limit); on ANY failure it falls back to a single multipart POST that
 * the /api/upload route persists via the storage driver.
 */

export const REFERENCE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_REFERENCE_IMAGES = 5;
export const MAX_REFERENCE_IMAGE_MB = 5;

const MAX_FILE_BYTES = MAX_REFERENCE_IMAGE_MB * 1024 * 1024;

/** Friendly-throws when a file can't be accepted. Exported for previews. */
export function validateReferenceImages(files: File[]): void {
  if (files.length > MAX_REFERENCE_IMAGES) {
    throw new Error(
      `Please attach at most ${MAX_REFERENCE_IMAGES} reference images.`,
    );
  }
  for (const file of files) {
    if (!(REFERENCE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      throw new Error(
        `"${file.name}" isn't a supported image — please use JPG, PNG or WebP.`,
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(
        `"${file.name}" is over ${MAX_REFERENCE_IMAGE_MB}MB — please choose a smaller image.`,
      );
    }
  }
}

/** Shrink a photo before upload; on any compression failure use the original. */
async function compressImage(file: File): Promise<File> {
  try {
    const imageCompression = (await import("browser-image-compression"))
      .default;
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
    });
    if (compressed.size >= file.size) return file;
    return new File([compressed], file.name, {
      type: compressed.type || file.type,
    });
  } catch {
    return file;
  }
}

/**
 * Uploads reference images and returns their public URLs, reporting
 * progress as whole files complete. Throws a user-presentable Error on
 * validation failure or when both upload paths fail.
 */
export async function uploadReferenceImages(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ url: string }[]> {
  if (files.length === 0) return [];
  validateReferenceImages(files);

  const total = files.length;
  onProgress?.(0, total);

  const compressed = await Promise.all(files.map(compressImage));

  try {
    // Preferred: direct-to-Blob client uploads (token minted by /api/upload).
    const { upload } = await import("@vercel/blob/client");
    const results: { url: string }[] = [];
    let done = 0;
    for (const file of compressed) {
      const blob = await upload(`refs/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      results.push({ url: blob.url });
      done += 1;
      onProgress?.(done, total);
    }
    return results;
  } catch {
    // Fallback: one multipart POST with every file (local dev, Blob-less
    // envs, or any client-upload hiccup).
    const formData = new FormData();
    for (const file of compressed) formData.append("files", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    type UploadResponse = { files?: { url: string }[]; error?: string };
    let payload: UploadResponse | null = null;
    try {
      payload = (await response.json()) as UploadResponse;
    } catch {
      // Non-JSON error body — fall through to the generic error below.
    }

    if (!response.ok || !payload?.files) {
      throw new Error(
        payload?.error || "Image upload failed — please try again.",
      );
    }

    onProgress?.(total, total);
    return payload.files.map(({ url }) => ({ url }));
  }
}
