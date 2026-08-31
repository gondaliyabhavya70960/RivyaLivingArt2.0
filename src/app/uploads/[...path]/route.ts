import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const ROOT = path.join(process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".glb": "model/gltf-binary",
  ".usdz": "model/vnd.usdz+zip",
};

/**
 * Dev-only fallback for the local storage driver: `next start` serves
 * public/ from the build-time manifest, so files uploaded AFTER the build
 * would 404 without this. In production media lives on Vercel Blob and
 * this route never matches anything.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (segments.some((s) => s === ".." || s === "." || s.includes("\\"))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(ROOT, ...segments);
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const headers: Record<string, string> = {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=60",
      // Never let the browser MIME-sniff a served file into something
      // executable (SEC-003 defense-in-depth).
      "X-Content-Type-Options": "nosniff",
    };
    // Any legacy SVG (no longer uploadable) is forced to download under a
    // locked-down policy so it can never execute inline.
    if (ext === ".svg") {
      headers["Content-Disposition"] = "attachment";
      headers["Content-Security-Policy"] = "default-src 'none'; sandbox";
    }
    return new NextResponse(new Uint8Array(data), { headers });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
