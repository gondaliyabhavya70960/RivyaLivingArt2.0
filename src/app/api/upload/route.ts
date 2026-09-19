import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { clientIp, rateLimit, retryAfterHeaders } from "@/lib/rate-limit";
import { slugify } from "@/lib/slug";
import { putFile } from "@/lib/storage";

// PUBLIC reference-image upload endpoint for the WhatsApp order forms.
// Two paths:
//   1. Vercel Blob client uploads (production): the browser asks for a
//      scoped client token via JSON, then uploads straight to Blob —
//      files never transit this function, so the 4.5MB body limit and
//      function duration don't apply.
//   2. Multipart FormData fallback (local dev / Blob-less envs): files
//      land here and are persisted through the storage driver.

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;

export async function POST(request: Request): Promise<NextResponse> {
  // Per-IP throttle on the whole public endpoint — covers BOTH the Blob
  // client-token path and the multipart fallback (SEC-004), so anonymous
  // callers can't mint unlimited upload tokens / push unbounded files.
  const ip = clientIp(request.headers);
  const limited = rateLimit(`upload:${ip}`, { limit: 30, windowMs: 600_000 });
  if (!limited.ok) {
    // The wait is NAMED rather than described. `upload-client.ts` renders
    // `payload.error` verbatim to the visitor, and "a few minutes" was a guess
    // the server did not have to make — it knows exactly when the oldest hit
    // in the window expires. `Retry-After` carries the same number for any
    // client that is not a person.
    const minutes = Math.ceil(limited.retryAfterSeconds / 60);
    return NextResponse.json(
      {
        error:
          minutes <= 1
            ? "Too many uploads — please wait a minute and try again."
            : `Too many uploads — please wait about ${minutes} minutes and try again.`,
      },
      { status: 429, headers: retryAfterHeaders(limited.retryAfterSeconds) },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (
    process.env.BLOB_READ_WRITE_TOKEN &&
    contentType.includes("application/json")
  ) {
    return handleBlobClientUpload(request);
  }

  return handleMultipartFallback(request);
}

/** @vercel/blob client-upload token exchange + completion webhook. */
async function handleBlobClientUpload(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody;

    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Public endpoint — only allow the reference-image prefix so the
        // token can't be abused to write anywhere else in the store.
        if (!pathname.startsWith("refs/")) {
          throw new Error("Invalid upload path.");
        }
        return {
          allowedContentTypes: Object.keys(ALLOWED_TYPES),
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // No-op: this is a public form — the order action persists the
        // final URLs on the Inquiry, nothing to write here.
      },
    });

    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Upload failed — please try again.",
      },
      { status: 400 },
    );
  }
}

/** Multipart fallback: local dev and environments without Vercel Blob.
 *  (Rate limiting is applied once in POST, before this branch.) */
async function handleMultipartFallback(
  request: Request,
): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected image files as multipart form data." },
      { status: 400 },
    );
  }

  const files = form
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files received." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Please attach at most ${MAX_FILES} reference images.` },
      { status: 400 },
    );
  }

  for (const file of files) {
    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        {
          error: `"${file.name}" isn't a supported image — use JPG, PNG or WebP.`,
        },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `"${file.name}" is over 5MB — please choose a smaller image.`,
        },
        { status: 400 },
      );
    }
  }

  try {
    const stored = await Promise.all(
      files.map(async (file) => {
        const ext = ALLOWED_TYPES[file.type];
        const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "reference";
        return putFile(Buffer.from(await file.arrayBuffer()), {
          pathname: `refs/${base}${ext}`,
          contentType: file.type,
        });
      }),
    );

    return NextResponse.json({
      files: stored.map(({ url, pathname }) => ({ url, pathname })),
    });
  } catch (error) {
    console.error("Reference upload failed:", error);
    return NextResponse.json(
      { error: "Upload failed — please try again." },
      { status: 500 },
    );
  }
}
